"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { findOrCreateContact } from "@/lib/contacts/contact-actions"
import { syncContactAffiliations } from "@/lib/contacts/contact-affiliation-sync"
import { attachAuthUserToContactIfLoggedIn } from "@/lib/vendor-hub/link-vendor-contact-auth"
import { AFFILIATION_APPLICATION_TYPES } from "@/lib/contacts/contact-affiliation-rules"
import { hasPermission, PERMISSIONS } from "@/lib/permissions/permissions"
import { syncVendorHubParticipantFromApplication } from "@/lib/vendor-hub/vendor-participant-actions"
import {
  hasPendingOrgVendorApplication,
  isApprovedOrgVendor,
} from "@/lib/vendor-hub/vendor-eligibility-queries"
import {
  VENDOR_ORG_APPLICATION_MODULE,
  VENDOR_ORG_APPLICATION_TYPE,
} from "@/lib/vendor-hub/vendor-participation-model"
import { VENDOR_HUB_ROUTES } from "@/lib/vendor-hub/vendor-hub-routes"
import { ensureChildcareStaffFromApprovedApplication } from "@/lib/hr/ensure-childcare-staff-from-application"
import { ensureVolunteerFromApprovedApplication } from "@/lib/volunteers/ensure-volunteer-from-application"
import {
  buildTypeRegistry,
  normalizeModuleOwner,
  type ApplicationAction,
  type ApplicationDashboardStats,
  type ApplicationDocumentRecord,
  type ApplicationHistoryRecord,
  type ApplicationListFilters,
  type ApplicationRecord,
  type ApplicationStatus,
  type ApplicationTypeDefinition,
  isPendingStatus,
  normalizeLegacyStatus,
} from "@/lib/applications/application-types"

const APPLICATION_PATHS = [
  "/applications",
  "/applications/all",
  "/applications/pending",
  "/applications/approved",
  "/applications/rejected",
  "/settings/applications",
  "/workforce",
  "/workforce/employees",
  "/workforce/volunteers",
  "/workforce/childcare",
  "/membership/applications",
  "/workforce/settings/committee-applications",
]

function revalidateApplicationPaths() {
  for (const path of APPLICATION_PATHS) {
    revalidatePath(path)
  }
}

function mapApplicationRow(row: Record<string, unknown>): ApplicationRecord {
  return {
    id: row.id as string,
    organization_id: row.organization_id as string,
    application_type: row.application_type as string,
    module_owner:
      normalizeModuleOwner(row.module_owner as string) ?? ("workforce" as const),
    contact_id: (row.contact_id as string | null) ?? null,
    applicant_name: row.applicant_name as string,
    applicant_email: (row.applicant_email ?? row.email) as string,
    applicant_phone: (row.applicant_phone ?? row.phone ?? null) as string | null,
    status: normalizeLegacyStatus(row.status as string),
    form_data: (row.form_data as Record<string, unknown>) ?? {},
    notes: (row.notes as string | null) ?? null,
    review_notes: (row.review_notes as string | null) ?? null,
    submitted_at: (row.submitted_at as string | null) ?? null,
    reviewed_at: (row.reviewed_at as string | null) ?? null,
    reviewed_by: (row.reviewed_by as string | null) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  }
}

async function requireOrganizationId() {
  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) {
    throw new Error("No organization selected")
  }
  return organizationId
}

async function appendHistory(input: {
  supabase: Awaited<ReturnType<typeof createClient>>
  organizationId: string
  applicationId: string
  action: ApplicationAction
  previousStatus?: ApplicationStatus | null
  newStatus?: ApplicationStatus | null
  performedBy?: string | null
  notes?: string | null
  metadata?: Record<string, unknown>
}) {
  const { error } = await input.supabase.from("application_history").insert({
    organization_id: input.organizationId,
    application_id: input.applicationId,
    action: input.action,
    previous_status: input.previousStatus ?? null,
    new_status: input.newStatus ?? null,
    performed_by: input.performedBy ?? null,
    notes: input.notes ?? null,
    metadata: input.metadata ?? {},
  })

  if (error) {
    console.error("Failed to write application history:", error.message)
  }
}

export async function fetchApplicationTypeDefinitions(): Promise<
  Record<string, ApplicationTypeDefinition>
> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("application_type_definitions")
    .select("id, label, module_owner, description, sort_order")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })

  if (error) {
    console.warn("application_type_definitions unavailable, using defaults:", error.message)
    return buildTypeRegistry(null)
  }

  return buildTypeRegistry(data)
}

export async function fetchApplicationDashboardStats(
  filters: Pick<ApplicationListFilters, "moduleOwner" | "applicationType"> = {}
): Promise<ApplicationDashboardStats> {
  const supabase = await createClient()
  const organizationId = await requireOrganizationId()

  let query = supabase
    .from("applications")
    .select("application_type, status")
    .eq("organization_id", organizationId)

  query = applyListFilters(query, filters)

  const { data, error } = await query

  if (error) {
    throw new Error(error.message)
  }

  const rows = (data ?? []).map((row) => ({
    application_type: row.application_type as string,
    status: normalizeLegacyStatus(row.status as string),
  }))

  const byType: Record<string, number> = {}
  for (const row of rows) {
    byType[row.application_type] = (byType[row.application_type] ?? 0) + 1
  }

  return {
    total: rows.length,
    pendingReview: rows.filter((row) => isPendingStatus(row.status)).length,
    approved: rows.filter((row) => row.status === "approved").length,
    rejected: rows.filter((row) => row.status === "rejected").length,
    byType,
  }
}

function applyListFilters(
  query: ReturnType<Awaited<ReturnType<typeof createClient>>["from"]> extends infer _T
    ? any
    : never,
  filters: ApplicationListFilters
) {
  let nextQuery = query

  if (filters.applicationType) {
    const types = Array.isArray(filters.applicationType)
      ? filters.applicationType
      : [filters.applicationType]
    nextQuery = nextQuery.in("application_type", types)
  }

  if (filters.moduleOwner) {
    const owners = Array.isArray(filters.moduleOwner)
      ? filters.moduleOwner
      : [filters.moduleOwner]
    nextQuery = nextQuery.in("module_owner", owners)
  }

  if (filters.status) {
    const statuses = Array.isArray(filters.status) ? filters.status : [filters.status]
    nextQuery = nextQuery.in("status", statuses)
  }

  if (filters.reviewerId) {
    nextQuery = nextQuery.eq("reviewed_by", filters.reviewerId)
  }

  if (filters.contactId) {
    nextQuery = nextQuery.eq("contact_id", filters.contactId)
  }

  if (filters.dateFrom) {
    nextQuery = nextQuery.gte("submitted_at", filters.dateFrom)
  }

  if (filters.dateTo) {
    nextQuery = nextQuery.lte("submitted_at", filters.dateTo)
  }

  return nextQuery
}

export async function fetchApplicationsList(filters: ApplicationListFilters = {}) {
  const supabase = await createClient()
  const organizationId = await requireOrganizationId()

  const page = filters.page ?? 1
  const pageSize = filters.pageSize ?? 50
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = supabase
    .from("applications")
    .select("*", { count: "exact" })
    .eq("organization_id", organizationId)
    .order("submitted_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })

  query = applyListFilters(query, filters)

  const { data, error, count } = await query.range(from, to)

  if (error) {
    throw new Error(error.message)
  }

  let applications = (data ?? []).map((row) => mapApplicationRow(row))

  if (filters.search?.trim()) {
    const search = filters.search.trim().toLowerCase()
    applications = applications.filter(
      (app) =>
        app.applicant_name.toLowerCase().includes(search) ||
        app.applicant_email.toLowerCase().includes(search) ||
        JSON.stringify(app.form_data).toLowerCase().includes(search) ||
        (app.notes ?? "").toLowerCase().includes(search) ||
        (app.review_notes ?? "").toLowerCase().includes(search)
    )
  }

  return {
    applications,
    total: count ?? applications.length,
    page,
    pageSize,
  }
}

export async function fetchContactApplications(contactId: string) {
  const supabase = await createClient()
  const organizationId = await requireOrganizationId()

  const { data, error } = await supabase
    .from("applications")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("contact_id", contactId)
    .order("submitted_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []).map((row) => mapApplicationRow(row))
}

export async function fetchApplicationById(applicationId: string) {
  const supabase = await createClient()
  const organizationId = await requireOrganizationId()

  const { data, error } = await supabase
    .from("applications")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", applicationId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  if (!data) return null

  return mapApplicationRow(data)
}

export async function fetchApplicationHistory(
  applicationId: string
): Promise<ApplicationHistoryRecord[]> {
  const supabase = await createClient()
  const organizationId = await requireOrganizationId()

  const { data, error } = await supabase
    .from("application_history")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("application_id", applicationId)
    .order("created_at", { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as ApplicationHistoryRecord[]
}

export async function fetchApplicationDocuments(
  applicationId: string
): Promise<ApplicationDocumentRecord[]> {
  const supabase = await createClient()
  const organizationId = await requireOrganizationId()

  const { data, error } = await supabase
    .from("application_documents")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("application_id", applicationId)
    .order("created_at", { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as ApplicationDocumentRecord[]
}

export type SubmitApplicationInput = {
  applicationType: string
  moduleOwner: ApplicationRecord["module_owner"]
  applicantName: string
  applicantEmail: string
  applicantPhone?: string | null
  formData?: Record<string, unknown>
  notes?: string | null
  status?: Extract<ApplicationStatus, "draft" | "submitted" | "pending_review">
}

export async function submitApplication(input: SubmitApplicationInput) {
  const supabase = await createClient()
  const organizationId = await requireOrganizationId()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const status = input.status ?? "pending_review"
  const submittedAt =
    status === "draft" ? null : new Date().toISOString()

  const { contactId } = await findOrCreateContact({
    organizationId,
    fullName: input.applicantName.trim(),
    email: input.applicantEmail,
    phone: input.applicantPhone,
    contactType: "individual",
  })

  if (
    input.moduleOwner === VENDOR_ORG_APPLICATION_MODULE &&
    input.applicationType === VENDOR_ORG_APPLICATION_TYPE
  ) {
    const approved = await isApprovedOrgVendor({
      supabase,
      organizationId,
      contactId,
    })
    if (approved) {
      throw new Error(
        "You are already an approved vendor for this organization. Reserve a booth on an open bazaar from My Bazaars."
      )
    }

    const pending = await hasPendingOrgVendorApplication({
      supabase,
      organizationId,
      contactId,
    })
    if (pending) {
      throw new Error(
        "You already have a vendor application under review for this organization."
      )
    }
  }

  if (input.applicationType === "childcare_provider") {
    const { data: existingChildcareApps } = await supabase
      .from("applications")
      .select("id, status")
      .eq("organization_id", organizationId)
      .eq("contact_id", contactId)
      .eq("application_type", "childcare_provider")
      .in("status", ["submitted", "pending_review", "approved"])
      .limit(1)

    if (existingChildcareApps && existingChildcareApps.length > 0) {
      const status = normalizeLegacyStatus(String(existingChildcareApps[0].status))
      if (status === "approved") {
        throw new Error(
          "You are already an approved childcare provider for this organization."
        )
      }
      throw new Error(
        "You already have a childcare provider application under review for this organization."
      )
    }
  }

  if (input.applicationType === "volunteer") {
    const { data: existingVolunteerApps } = await supabase
      .from("applications")
      .select("id, status")
      .eq("organization_id", organizationId)
      .eq("contact_id", contactId)
      .eq("application_type", "volunteer")
      .in("status", ["submitted", "pending_review", "approved"])
      .limit(1)

    if (existingVolunteerApps && existingVolunteerApps.length > 0) {
      const status = normalizeLegacyStatus(String(existingVolunteerApps[0].status))
      if (status === "approved") {
        throw new Error(
          "You are already an approved volunteer for this organization."
        )
      }
      throw new Error(
        "You already have a volunteer application under review for this organization."
      )
    }
  }

  await attachAuthUserToContactIfLoggedIn({
    supabase,
    contactId,
    authUserId: user?.id,
  })

  const { data, error } = await supabase
    .from("applications")
    .insert({
      organization_id: organizationId,
      application_type: input.applicationType,
      module_owner: input.moduleOwner,
      contact_id: contactId,
      applicant_name: input.applicantName.trim(),
      applicant_email: input.applicantEmail.trim().toLowerCase(),
      applicant_phone: input.applicantPhone?.trim() || null,
      status,
      form_data: input.formData ?? {},
      notes: input.notes ?? null,
      submitted_at: submittedAt,
    })
    .select("*")
    .single()

  if (error) {
    throw new Error(error.message)
  }

  await appendHistory({
    supabase,
    organizationId,
    applicationId: data.id,
    action: status === "draft" ? "status_change" : "submit",
    previousStatus: null,
    newStatus: status,
    performedBy: user?.id ?? null,
    notes: input.notes ?? null,
  })

  revalidateApplicationPaths()
  revalidatePath(`/contacts/${contactId}`)
  revalidatePath("/customer/profile/applications")
  revalidatePath("/customer/apply/childcare")
  revalidatePath("/customer/apply/volunteer")

  if (
    (AFFILIATION_APPLICATION_TYPES as readonly string[]).includes(input.applicationType)
  ) {
    await syncContactAffiliations(contactId, organizationId, supabase)
  }

  return mapApplicationRow(data)
}

export type UpdateApplicationStatusInput = {
  applicationId: string
  status: ApplicationStatus
  reviewNotes?: string | null
  notes?: string | null
  /** @deprecated Org vendor applications are not tied to events. Use booth reservation flow instead. */
  vendorHubEventId?: string | null
}

export async function updateApplicationStatus(input: UpdateApplicationStatusInput) {
  const canManage = await hasPermission(PERMISSIONS.APPLICATIONS_MANAGE)
  if (!canManage) {
    throw new Error("You do not have permission to manage applications")
  }

  const supabase = await createClient()
  const organizationId = await requireOrganizationId()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const existing = await fetchApplicationById(input.applicationId)
  if (!existing) {
    throw new Error("Application not found")
  }

  const action: ApplicationAction =
    input.status === "approved"
      ? "approve"
      : input.status === "rejected"
        ? "reject"
        : input.status === "withdrawn"
          ? "withdraw"
          : input.status === "submitted" || input.status === "pending_review"
            ? "review"
            : "status_change"

  const updatePayload: Record<string, unknown> = {
    status: input.status,
  }

  if (input.reviewNotes !== undefined) {
    updatePayload.review_notes = input.reviewNotes?.trim() || null
  }

  if (input.notes !== undefined) {
    updatePayload.notes = input.notes?.trim() || null
  }

  if (["approved", "rejected", "withdrawn"].includes(input.status)) {
    updatePayload.reviewed_by = user?.id ?? null
    updatePayload.reviewed_at = new Date().toISOString()
  }

  if (input.status === "submitted" || input.status === "pending_review") {
    updatePayload.submitted_at = existing.submitted_at ?? new Date().toISOString()
  }

  const { data, error } = await supabase
    .from("applications")
    .update(updatePayload)
    .eq("id", input.applicationId)
    .eq("organization_id", organizationId)
    .select("*")
    .single()

  if (error) {
    throw new Error(error.message)
  }

  await appendHistory({
    supabase,
    organizationId,
    applicationId: input.applicationId,
    action,
    previousStatus: existing.status,
    newStatus: input.status,
    performedBy: user?.id ?? null,
    notes: input.reviewNotes ?? input.notes ?? null,
  })

  revalidateApplicationPaths()
  revalidatePath(`/applications/${input.applicationId}`)
  if (existing.contact_id) {
    revalidatePath(`/contacts/${existing.contact_id}`)
    if (
      (AFFILIATION_APPLICATION_TYPES as readonly string[]).includes(existing.application_type)
    ) {
      await syncContactAffiliations(existing.contact_id, organizationId, supabase)
    }
  }

  const updatedApplication = mapApplicationRow(data)

  if (
    input.status === "approved" &&
    existing.application_type === "childcare_provider" &&
    existing.contact_id
  ) {
    await ensureChildcareStaffFromApprovedApplication({
      supabase,
      organizationId,
      contactId: existing.contact_id,
      applicantName: updatedApplication.applicant_name,
      applicantEmail: updatedApplication.applicant_email,
      applicantPhone: updatedApplication.applicant_phone,
      formData: updatedApplication.form_data,
    })
  }

  if (
    input.status === "approved" &&
    existing.application_type === "volunteer" &&
    existing.contact_id
  ) {
    await ensureVolunteerFromApprovedApplication({
      supabase,
      organizationId,
      contactId: existing.contact_id,
      applicantName: updatedApplication.applicant_name,
      applicantEmail: updatedApplication.applicant_email,
      applicantPhone: updatedApplication.applicant_phone,
      formData: updatedApplication.form_data,
    })
  }

  await syncVendorHubParticipantFromApplication({
    application: updatedApplication,
    newStatus: input.status,
    organizationId,
    vendorHubEventId: null,
    supabase,
  })

  revalidatePath(VENDOR_HUB_ROUTES.network.history)
  revalidatePath(VENDOR_HUB_ROUTES.network.onboarding)
  revalidatePath(VENDOR_HUB_ROUTES.events.list)

  return updatedApplication
}

export async function addApplicationNote(applicationId: string, note: string) {
  const canManage = await hasPermission(PERMISSIONS.APPLICATIONS_MANAGE)
  if (!canManage) {
    throw new Error("You do not have permission to manage applications")
  }

  const supabase = await createClient()
  const organizationId = await requireOrganizationId()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const existing = await fetchApplicationById(applicationId)
  if (!existing) {
    throw new Error("Application not found")
  }

  const mergedNotes = [existing.notes, note.trim()].filter(Boolean).join("\n\n")

  const { data, error } = await supabase
    .from("applications")
    .update({ notes: mergedNotes })
    .eq("id", applicationId)
    .eq("organization_id", organizationId)
    .select("*")
    .single()

  if (error) {
    throw new Error(error.message)
  }

  await appendHistory({
    supabase,
    organizationId,
    applicationId,
    action: "note",
    previousStatus: existing.status,
    newStatus: existing.status,
    performedBy: user?.id ?? null,
    notes: note.trim(),
  })

  revalidatePath(`/applications/${applicationId}`)
  return mapApplicationRow(data)
}
