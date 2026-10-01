"use server"

import { revalidatePath } from "next/cache"

import { fetchApplicationsList } from "@/lib/applications/application-actions"
import type { ApplicationRecord } from "@/lib/applications/application-types"
import { findOrCreateContact } from "@/lib/contacts/contact-actions"
import {
  normalizePhone,
  properCasePersonNameIfNeeded,
  splitFullName,
} from "@/lib/contacts/contact-constants"
import { syncContactAffiliations } from "@/lib/contacts/contact-affiliation-sync"
import { ensureChildcareStaffFromApprovedApplication } from "@/lib/hr/ensure-childcare-staff-from-application"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { hasPermission, PERMISSIONS } from "@/lib/permissions/permissions"
import { createClient } from "@/lib/supabase/server"

export interface ChildcareProviderRecord {
  id: string
  applicationId: string
  contactId: string | null
  name: string
  phone: string
  email: string
  payRate: string
  experience: string
  certifications: string
  ageGroups: string
  availability: string
  status: "Active" | "Inactive"
  notes: string
  totalHours: number
  eventsWorked: number
  history: []
}

export interface ChildcareProviderStats {
  totalProviders: number
  activeProviders: number
  totalHours: number
  totalEventsWorked: number
}

const AVAILABILITY_LABELS: Record<string, string> = {
  weekdayMornings: "Weekday mornings",
  weekdayAfternoons: "Weekday afternoons",
  weekdayEvenings: "Weekday evenings",
  weekendMornings: "Weekend mornings",
  weekendAfternoons: "Weekend afternoons",
  weekendEvenings: "Weekend evenings",
  overnights: "Overnights",
}

function formatExperience(formData: Record<string, unknown>): string {
  const years = formData.yearsExperience
  if (typeof years === "string" && years.trim()) {
    return years.toLowerCase().includes("year") ? years : `${years} years`
  }
  return "—"
}

function formatAgeGroups(formData: Record<string, unknown>): string {
  const groups = formData.ageGroupsExperience
  if (Array.isArray(groups) && groups.length > 0) {
    return groups.map(String).join(", ")
  }
  return "—"
}

function formatCertifications(formData: Record<string, unknown>): string {
  const certs: string[] = []
  if (formData.hasCPRCertification) certs.push("CPR")
  if (formData.hasFirstAidCertification) certs.push("First Aid")
  const other = formData.otherCertifications
  if (typeof other === "string" && other.trim()) {
    certs.push(other.trim())
  }
  return certs.length > 0 ? certs.join(", ") : "—"
}

function formatAvailability(formData: Record<string, unknown>): string {
  const availability = formData.availability
  if (!availability || typeof availability !== "object") {
    return "—"
  }

  const selected = Object.entries(availability as Record<string, boolean>)
    .filter(([, enabled]) => enabled)
    .map(([key]) => AVAILABILITY_LABELS[key] ?? key)

  return selected.length > 0 ? selected.join(", ") : "—"
}

function mapApplicationToProvider(application: ApplicationRecord): ChildcareProviderRecord | null {
  if (application.status !== "approved") {
    return null
  }

  const formData = application.form_data

  return {
    id: application.id,
    applicationId: application.id,
    contactId: application.contact_id,
    name: application.applicant_name,
    phone: application.applicant_phone?.trim() || "—",
    email: application.applicant_email,
    payRate: formatStoredPayRate(formData.hourlyRate),
    experience: formatExperience(formData),
    certifications: formatCertifications(formData),
    ageGroups: formatAgeGroups(formData),
    availability: formatAvailability(formData),
    status: "Active",
    notes: application.notes?.trim() || application.review_notes?.trim() || "",
    totalHours: 0,
    eventsWorked: 0,
    history: [],
  }
}

export async function fetchChildcareProvidersData(): Promise<{
  providers: ChildcareProviderRecord[]
  stats: ChildcareProviderStats
}> {
  const { applications } = await fetchApplicationsList({
    applicationType: "childcare_provider",
    status: "approved",
    pageSize: 500,
  })

  const providers = applications
    .map(mapApplicationToProvider)
    .filter((provider): provider is ChildcareProviderRecord => provider !== null)

  await fillMissingPayRates(providers)

  const totalHours = providers.reduce((sum, provider) => sum + provider.totalHours, 0)
  const totalEventsWorked = providers.reduce((sum, provider) => sum + provider.eventsWorked, 0)

  return {
    providers,
    stats: {
      totalProviders: providers.length,
      activeProviders: providers.filter((provider) => provider.status === "Active").length,
      totalHours,
      totalEventsWorked,
    },
  }
}

export async function addChildcareProvider(input: {
  name: string
  email: string
  phone?: string
  payRate?: string
}): Promise<{ success: true } | { success: false; error: string }> {
  const parsed = parseProviderForm(input)
  if (!parsed.ok) return parsed.result
  const { name, email, phone, hourlyRate } = parsed

  const canManage = await hasPermission(PERMISSIONS.APPLICATIONS_MANAGE)
  if (!canManage) {
    return { success: false, error: "You do not have permission to add providers." }
  }

  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) {
    return { success: false, error: "No organization selected." }
  }

  try {
    const supabase = await createClient()
    const { contactId } = await findOrCreateContact({
      organizationId,
      fullName: name,
      email,
      phone,
      contactType: "individual",
    })

    const { data: existing } = await supabase
      .from("applications")
      .select("id, status")
      .eq("organization_id", organizationId)
      .eq("contact_id", contactId)
      .eq("application_type", "childcare_provider")
      .in("status", ["submitted", "pending_review", "approved"])
      .limit(1)

    if (existing && existing.length > 0) {
      return {
        success: false,
        error:
          existing[0].status === "approved"
            ? "This person is already an approved childcare provider."
            : "This person already has a childcare provider application under review.",
      }
    }

    const now = new Date().toISOString()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const { data: application, error } = await supabase
      .from("applications")
      .insert({
        organization_id: organizationId,
        application_type: "childcare_provider",
        module_owner: "workforce",
        contact_id: contactId,
        applicant_name: name,
        applicant_email: email || "",
        applicant_phone: phone,
        status: "approved",
        form_data: hourlyRate != null ? { hourlyRate } : {},
        notes: "Added by staff.",
        review_notes: "Added by staff.",
        submitted_at: now,
        reviewed_at: now,
        reviewed_by: user?.id ?? null,
      })
      .select("id")
      .single()

    if (error || !application) {
      return { success: false, error: error?.message || "Could not add provider." }
    }

    await supabase.from("application_history").insert({
      organization_id: organizationId,
      application_id: application.id,
      action: "approve",
      previous_status: null,
      new_status: "approved",
      performed_by: user?.id ?? null,
      notes: "Added by staff.",
      metadata: {},
    })

    await ensureChildcareStaffFromApprovedApplication({
      supabase,
      organizationId,
      contactId,
      applicantName: name,
      applicantEmail: email,
      applicantPhone: phone,
      formData: hourlyRate != null ? { hourlyRate } : null,
    })
    await syncContactAffiliations(contactId, organizationId, supabase)

    revalidatePath("/workforce")
    revalidatePath("/workforce/childcare")
    revalidatePath("/applications")
    revalidatePath(`/contacts/${contactId}`)
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Could not add provider.",
    }
  }
}

export async function updateChildcareProvider(input: {
  applicationId: string
  name: string
  email: string
  phone?: string
  payRate?: string
}): Promise<{ success: true } | { success: false; error: string }> {
  const parsed = parseProviderForm(input)
  if (!parsed.ok) return parsed.result

  const canManage = await hasPermission(PERMISSIONS.APPLICATIONS_MANAGE)
  if (!canManage) {
    return { success: false, error: "You do not have permission to edit providers." }
  }

  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) {
    return { success: false, error: "No organization selected." }
  }

  try {
    const supabase = await createClient()
    const { data: application, error: loadError } = await supabase
      .from("applications")
      .select("id, contact_id, form_data, application_type")
      .eq("organization_id", organizationId)
      .eq("id", input.applicationId)
      .maybeSingle()

    if (loadError || !application || application.application_type !== "childcare_provider") {
      return { success: false, error: "Provider not found." }
    }

    const { name, email, phone, hourlyRate } = parsed
    const formData =
      application.form_data && typeof application.form_data === "object"
        ? { ...(application.form_data as Record<string, unknown>) }
        : {}
    formData.hourlyRate = hourlyRate

    const { error: applicationError } = await supabase
      .from("applications")
      .update({
        applicant_name: name,
        applicant_email: email || "",
        applicant_phone: phone,
        form_data: formData,
      })
      .eq("organization_id", organizationId)
      .eq("id", application.id)

    if (applicationError) {
      return { success: false, error: applicationError.message || "Could not update provider." }
    }

    const contactId = application.contact_id as string | null
    if (contactId) {
      const { first_name, last_name } = splitFullName(name)
      const { error: contactError } = await supabase
        .from("contacts")
        .update({
          full_name: name,
          email: email || null,
          phone,
        })
        .eq("organization_id", organizationId)
        .eq("id", contactId)

      if (contactError) {
        return { success: false, error: contactError.message || "Could not update provider." }
      }

      const staffPatch: Record<string, unknown> = {
        first_name,
        last_name,
        email: email || null,
        phone,
        hourly_rate: hourlyRate,
        pay_basis: "hourly",
      }
      const { error: staffError } = await supabase
        .from("staff")
        .update(staffPatch)
        .eq("organization_id", organizationId)
        .eq("contact_id", contactId)

      if (staffError && /hourly_rate|pay_basis/i.test(staffError.message || "")) {
        delete staffPatch.hourly_rate
        delete staffPatch.pay_basis
        await supabase
          .from("staff")
          .update(staffPatch)
          .eq("organization_id", organizationId)
          .eq("contact_id", contactId)
      } else if (staffError) {
        return { success: false, error: staffError.message || "Could not update provider." }
      }

      revalidatePath(`/contacts/${contactId}`)
    }

    revalidatePath("/workforce")
    revalidatePath("/workforce/childcare")
    revalidatePath("/applications")
    revalidatePath(`/applications/${application.id}`)
    return { success: true }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Could not update provider.",
    }
  }
}

function formatStoredPayRate(value: unknown) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return ""
  return String(parsed)
}

async function fillMissingPayRates(providers: ChildcareProviderRecord[]) {
  const missing = providers.filter((provider) => !provider.payRate && provider.contactId)
  if (missing.length === 0) return

  const organizationId = await getSelectedOrganizationId()
  if (!organizationId) return

  const supabase = await createClient()
  const { data } = await supabase
    .from("staff")
    .select("contact_id, hourly_rate")
    .eq("organization_id", organizationId)
    .in(
      "contact_id",
      missing.map((provider) => provider.contactId as string)
    )

  const rateByContact = new Map(
    (data || []).map((row) => [row.contact_id as string, formatStoredPayRate(row.hourly_rate)])
  )
  for (const provider of missing) {
    provider.payRate = rateByContact.get(provider.contactId as string) || ""
  }
}

function parseProviderForm(input: {
  name: string
  email: string
  phone?: string
  payRate?: string
}):
  | { ok: true; name: string; email: string; phone: string | null; hourlyRate: number }
  | { ok: false; result: { success: false; error: string } } {
  const name = properCasePersonNameIfNeeded(input.name.trim())
  const email = input.email.trim().toLowerCase()
  const phone = normalizePhone(input.phone) || null
  const payRateRaw = input.payRate?.trim() || ""

  if (!name) {
    return { ok: false, result: { success: false, error: "Name is required." } }
  }
  if (email && !email.includes("@")) {
    return {
      ok: false,
      result: { success: false, error: "Enter a valid email, or leave it blank." },
    }
  }
  const parsed = Number(payRateRaw.replace(/[^0-9.]/g, ""))
  if (!payRateRaw || !Number.isFinite(parsed) || parsed <= 0) {
    return { ok: false, result: { success: false, error: "Pay rate is required." } }
  }

  return {
    ok: true,
    name,
    email,
    phone,
    hourlyRate: Math.round(parsed * 100) / 100,
  }
}
