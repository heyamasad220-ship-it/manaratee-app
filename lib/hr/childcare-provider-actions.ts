"use server"

import { fetchApplicationsList } from "@/lib/applications/application-actions"
import type { ApplicationRecord } from "@/lib/applications/application-types"

export interface ChildcareProviderRecord {
  id: string
  applicationId: string
  contactId: string | null
  name: string
  phone: string
  email: string
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
