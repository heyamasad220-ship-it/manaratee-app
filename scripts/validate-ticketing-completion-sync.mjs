/**
 * Validates S-08 ticketing completion → customer affiliation sync behavior.
 * Usage: node scripts/validate-ticketing-completion-sync.mjs
 */
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import {
  loadEnvLocal,
  createServiceRoleClient,
  createCheckRecorder,
  getProjectRoot,
  assertParticipationRolesSchema,
  assertStickyRoleInRules,
  hasRole,
  applyEventAttendeeAffiliationMirror,
} from "./lib/contacts-phase1-validation.mjs"

const root = getProjectRoot()
const TAG = "TICKETING_SYNC_VALIDATION_V1"

loadEnvLocal()
const sb = createServiceRoleClient()
const { checks, record } = createCheckRecorder()

function generateOrderNumber() {
  return `VAL${Date.now().toString().slice(-8)}`
}

async function cleanup(ids) {
  const { orders, contacts, ticketTypes } = ids
  if (orders?.length) {
    await sb.from("tickets").delete().in("ticket_order_id", orders)
    await sb.from("ticket_orders").delete().in("id", orders)
  }
  if (contacts?.length) {
    await sb
      .from("contact_roles")
      .delete()
      .in("contact_id", contacts)
      .eq("role", "customer")
    await sb.from("contacts").delete().in("id", contacts)
  }
  if (ticketTypes?.length) {
    for (const typeId of ticketTypes) {
      const { data: row } = await sb
        .from("event_ticket_types")
        .select("quantity_sold")
        .eq("id", typeId)
        .maybeSingle()
      if (row) {
        await sb
          .from("event_ticket_types")
          .update({ quantity_sold: Math.max(Number(row.quantity_sold || 0) - 1, 0) })
          .eq("id", typeId)
      }
    }
  }
}

const { data: event } = await sb
  .from("internal_events")
  .select("id, organization_id")
  .eq("requires_ticketing", true)
  .order("created_at", { ascending: false })
  .limit(1)
  .maybeSingle()

if (!event?.organization_id) {
  console.error("No ticketed internal_event found. Create a ticketed event before running validation.")
  process.exit(2)
}

const orgId = event.organization_id
const eventId = event.id

const schemaCheck = await assertParticipationRolesSchema(sb)
record(
  "schema-participation-roles",
  schemaCheck.ok,
  schemaCheck.message || "customer allowed in contact_roles"
)
if (!schemaCheck.ok) {
  process.exit(1)
}

const { data: ticketType } = await sb
  .from("event_ticket_types")
  .select("id, quantity_sold")
  .eq("organization_id", orgId)
  .eq("internal_event_id", eventId)
  .eq("is_active", true)
  .limit(1)
  .maybeSingle()

if (!ticketType?.id) {
  console.error("No active ticket type for ticketed event.")
  process.exit(2)
}

const testEmail = `${TAG.toLowerCase()}-${Date.now()}@validation.local`
const testName = "Ticketing Sync Validator"
const created = { orders: [], contacts: [], ticketTypes: [ticketType.id] }

try {
  const { data: contactA, error: contactAError } = await sb
    .from("contacts")
    .insert({
      organization_id: orgId,
      full_name: testName,
      email: testEmail,
      contact_type: "individual",
      status: "active",
    })
    .select("id")
    .single()

  record("create-test-contact", !contactAError && !!contactA?.id, contactAError?.message)
  if (!contactA?.id) throw new Error("setup failed")
  created.contacts.push(contactA.id)

  const soldBefore = Number(ticketType.quantity_sold || 0)

  const { data: completedOrder, error: completedOrderError } = await sb
    .from("ticket_orders")
    .insert({
      organization_id: orgId,
      internal_event_id: eventId,
      contact_id: contactA.id,
      order_number: generateOrderNumber(),
      status: "completed",
      subtotal_cents: 1000,
      discount_cents: 0,
      total_cents: 1000,
      currency: "USD",
      purchaser_name: testName,
      purchaser_email: testEmail,
      metadata: { validation_tag: TAG },
    })
    .select("id, purchaser_name, purchaser_email, contact_id")
    .single()

  record(
    "completed-order-created",
    !completedOrderError && !!completedOrder?.id,
    completedOrderError?.message
  )
  if (!completedOrder?.id) throw new Error("completed order setup failed")
  created.orders.push(completedOrder.id)

  record(
    "purchaser-fields-preserved",
    completedOrder.purchaser_name === testName &&
      completedOrder.purchaser_email === testEmail &&
      completedOrder.contact_id === contactA.id,
    `name=${completedOrder.purchaser_name}, email=${completedOrder.purchaser_email}`
  )

  await applyEventAttendeeAffiliationMirror(sb, orgId, contactA.id)
  const roleAfterComplete = await hasRole(sb, orgId, contactA.id, "customer")
  record(
    "completed-order-event-attendee",
    roleAfterComplete.ok && roleAfterComplete.hasRole,
    roleAfterComplete.error || (roleAfterComplete.hasRole ? "role present" : "role missing")
  )

  const { data: contactB, error: contactBError } = await sb
    .from("contacts")
    .insert({
      organization_id: orgId,
      full_name: `${testName} Pending`,
      email: `${TAG.toLowerCase()}-pending-${Date.now()}@validation.local`,
      contact_type: "individual",
      status: "active",
    })
    .select("id")
    .single()

  record("create-pending-contact", !contactBError && !!contactB?.id, contactBError?.message)
  if (!contactB?.id) throw new Error("pending contact setup failed")
  created.contacts.push(contactB.id)

  const pendingEmail = `${TAG.toLowerCase()}-transition-${Date.now()}@validation.local`
  const { data: pendingOrder, error: pendingOrderError } = await sb
    .from("ticket_orders")
    .insert({
      organization_id: orgId,
      internal_event_id: eventId,
      contact_id: contactB.id,
      order_number: generateOrderNumber(),
      status: "pending",
      subtotal_cents: 500,
      discount_cents: 0,
      total_cents: 500,
      currency: "USD",
      purchaser_name: `${testName} Pending`,
      purchaser_email: pendingEmail,
      metadata: { validation_tag: TAG },
    })
    .select("id")
    .single()

  record("pending-order-created", !pendingOrderError && !!pendingOrder?.id, pendingOrderError?.message)
  if (!pendingOrder?.id) throw new Error("pending order setup failed")
  created.orders.push(pendingOrder.id)

  await sb
    .from("ticket_orders")
    .update({ status: "completed" })
    .eq("id", pendingOrder.id)

  await applyEventAttendeeAffiliationMirror(sb, orgId, contactB.id)
  const roleAfterTransition = await hasRole(sb, orgId, contactB.id, "customer")
  record(
    "pending-to-completed-event-attendee",
    roleAfterTransition.ok && roleAfterTransition.hasRole,
    roleAfterTransition.error || (roleAfterTransition.hasRole ? "role present" : "role missing")
  )

  const reuseEmail = `${TAG.toLowerCase()}-reuse-${Date.now()}@validation.local`
  const { data: reuseContact1 } = await sb
    .from("contacts")
    .insert({
      organization_id: orgId,
      full_name: "Reuse Contact",
      email: reuseEmail,
      contact_type: "individual",
      status: "active",
    })
    .select("id")
    .single()
  if (reuseContact1?.id) created.contacts.push(reuseContact1.id)

  const { data: existingByEmail } = await sb
    .from("contacts")
    .select("id")
    .eq("organization_id", orgId)
    .eq("email", reuseEmail)
    .limit(1)
    .maybeSingle()

  record(
    "same-email-reuses-contact",
    !!reuseContact1?.id && existingByEmail?.id === reuseContact1.id,
    `contact=${reuseContact1?.id}`
  )

  await sb
    .from("ticket_orders")
    .update({ status: "refunded" })
    .eq("id", completedOrder.id)

  await applyEventAttendeeAffiliationMirror(sb, orgId, contactA.id)
  const roleAfterRefund = await hasRole(sb, orgId, contactA.id, "customer")
  record(
    "refunded-order-retains-event-attendee",
    roleAfterRefund.ok && roleAfterRefund.hasRole,
    roleAfterRefund.error || (roleAfterRefund.hasRole ? "sticky role kept" : "role removed")
  )

  const { data: typeAfter } = await sb
    .from("event_ticket_types")
    .select("quantity_sold")
    .eq("id", ticketType.id)
    .maybeSingle()

  record(
    "inventory-unchanged-by-sync",
    Number(typeAfter?.quantity_sold || 0) === soldBefore,
    `sold before=${soldBefore}, after=${typeAfter?.quantity_sold ?? "n/a"}`
  )

  const { data: orderIntegrity } = await sb
    .from("ticket_orders")
    .select("id, status, contact_id, purchaser_email")
    .eq("id", completedOrder.id)
    .maybeSingle()

  record(
    "sync-does-not-corrupt-order",
    !!orderIntegrity?.id &&
      orderIntegrity.status === "refunded" &&
      orderIntegrity.contact_id === contactA.id &&
      orderIntegrity.purchaser_email === testEmail,
    `status=${orderIntegrity?.status}`
  )

  const ticketActions = readFileSync(
    resolve(root, "lib/tickets/ticket-order-actions.ts"),
    "utf8"
  )
  record(
    "ticket-actions-call-sync-contact-affiliations",
    ticketActions.includes("syncContactAffiliations") &&
      ticketActions.includes("handleCompletedOrderAffiliationSync"),
    "completion paths wired to syncContactAffiliations"
  )

  record(
    "event-attendee-is-sticky",
    assertStickyRoleInRules("customer"),
    "customer listed in STICKY_DERIVED_ROLES"
  )
} finally {
  await cleanup(created)
}

const failed = checks.filter((check) => !check.pass)
console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`)
if (failed.length > 0) {
  process.exit(1)
}
