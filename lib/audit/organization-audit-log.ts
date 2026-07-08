import { createServiceRoleClient } from "@/lib/supabase/service-role"

export type OrganizationAuditCategory = "financial" | "permission"

export const ORGANIZATION_AUDIT_ACTIONS = {
  PAYMENT_UPDATED: "payment.updated",
  PAYMENT_VOIDED: "payment.voided",
  PAYMENT_REFUNDED: "payment.refunded",
  PAYMENT_STRIPE_REFUNDED: "payment.stripe_refunded",
  PAYMENT_ALLOCATED: "payment.allocated",
  PLEDGE_UPDATED: "pledge.updated",
  PLEDGE_PAYMENT_RECORDED: "pledge.payment_recorded",
  PLEDGE_MARKED_PAID: "pledge.marked_paid",
  PLEDGE_CANCELLED: "pledge.cancelled",
  MEMBER_ROLE_CHANGED: "member.role_changed",
  MEMBER_PROFILE_UPDATED: "member.profile_updated",
  MEMBER_PASSWORD_RESET_SENT: "member.password_reset_sent",
  MEMBER_REMOVED: "member.removed",
  ROLE_PERMISSION_CHANGED: "role.permission_changed",
} as const

export type OrganizationAuditAction =
  (typeof ORGANIZATION_AUDIT_ACTIONS)[keyof typeof ORGANIZATION_AUDIT_ACTIONS]

export type WriteOrganizationAuditLogInput = {
  organizationId: string
  category: OrganizationAuditCategory
  action: OrganizationAuditAction | string
  actorUserId?: string | null
  actorEmail?: string | null
  actorDisplayName?: string | null
  targetType?: string | null
  targetId?: string | null
  targetLabel?: string | null
  summary: string
  metadata?: Record<string, unknown>
}

export type OrganizationAuditLogRow = {
  id: string
  organization_id: string
  category: OrganizationAuditCategory
  action: string
  actor_user_id: string | null
  actor_email: string | null
  actor_display_name: string | null
  target_type: string | null
  target_id: string | null
  target_label: string | null
  summary: string
  metadata: Record<string, unknown>
  created_at: string
}

async function resolveActorDisplayName(userId: string | null | undefined) {
  if (!userId) return null

  const admin = createServiceRoleClient()
  const { data } = await admin
    .from("profiles")
    .select("full_name, email")
    .eq("id", userId)
    .maybeSingle()

  if (!data) return null
  const fullName = String(data.full_name || "").trim()
  const email = String(data.email || "").trim()
  return fullName || email || null
}

export async function writeOrganizationAuditLog(input: WriteOrganizationAuditLogInput) {
  try {
    const admin = createServiceRoleClient()
    const actorDisplayName =
      input.actorDisplayName?.trim() ||
      (await resolveActorDisplayName(input.actorUserId)) ||
      null

    const { error } = await admin.from("organization_audit_logs").insert({
      organization_id: input.organizationId,
      category: input.category,
      action: input.action,
      actor_user_id: input.actorUserId ?? null,
      actor_email: input.actorEmail ?? null,
      actor_display_name: actorDisplayName,
      target_type: input.targetType ?? null,
      target_id: input.targetId ?? null,
      target_label: input.targetLabel ?? null,
      summary: input.summary,
      metadata: input.metadata ?? {},
    })

    if (error) {
      console.error("[audit-log] write failed:", error.message)
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error("[audit-log] write failed:", message)
  }
}

export function formatMoney(amount: number) {
  return `$${amount.toFixed(2)}`
}
