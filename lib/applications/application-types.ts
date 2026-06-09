import {
  Briefcase,
  Heart,
  Store,
  Users,
  type LucideIcon,
} from "lucide-react"
import { WORKFORCE_MODULE_LABEL } from "@/lib/hr/hr-module-label"
import { moduleApplicationsUrl } from "@/lib/applications/application-routes"

export type ModuleOwner = "workforce" | "vendor_hub" | "programs"

/** Accepts legacy `hr` values from URLs and pre-migration rows. */
export function normalizeModuleOwner(value?: string | null): ModuleOwner | undefined {
  if (!value || value === "hr") return "workforce"
  if (value === "workforce" || value === "vendor_hub" || value === "programs") {
    return value
  }
  return undefined
}

export function isWorkforceModuleOwner(value?: string | null) {
  return !value || value === "hr" || value === "workforce"
}

export type ApplicationStatus =
  | "draft"
  | "submitted"
  | "pending_review"
  | "approved"
  | "rejected"
  | "withdrawn"

export type ApplicationAction =
  | "submit"
  | "review"
  | "approve"
  | "reject"
  | "withdraw"
  | "note"
  | "status_change"

export type ApplicationTypeDefinition = {
  id: string
  label: string
  moduleOwner: ModuleOwner
  description?: string
  sortOrder: number
}

/** Default registry — DB `application_type_definitions` is the source of truth at runtime. */
export const DEFAULT_APPLICATION_TYPES: ApplicationTypeDefinition[] = [
  {
    id: "volunteer",
    label: "Volunteer Application",
    moduleOwner: "workforce",
    description: "Apply to volunteer with the organization",
    sortOrder: 10,
  },
  {
    id: "employment",
    label: "Employment Application",
    moduleOwner: "workforce",
    description: "Apply for employment",
    sortOrder: 20,
  },
  {
    id: "committee_member",
    label: "Committee Member Application",
    moduleOwner: "workforce",
    description: "Apply to serve on a committee",
    sortOrder: 30,
  },
  {
    id: "vendor",
    label: "Vendor Application",
    moduleOwner: "vendor_hub",
    description: "Apply to participate as a vendor",
    sortOrder: 40,
  },
  {
    id: "financial_aid",
    label: "Financial Aid Application",
    moduleOwner: "programs",
    description: "Apply for program financial assistance",
    sortOrder: 50,
  },
  {
    id: "childcare_provider",
    label: "Childcare Provider Application",
    moduleOwner: "workforce",
    description: "Apply to provide childcare services",
    sortOrder: 60,
  },
]

export const MODULE_OWNER_LABELS: Record<ModuleOwner, string> = {
  workforce: WORKFORCE_MODULE_LABEL,
  vendor_hub: "Vendor Hub",
  programs: "Programs",
}

/** Shown on Workforce → Settings → Applications hub. */
export const WORKFORCE_APPLICATIONS_HUB_TYPES = [
  "volunteer",
  "committee_member",
  "childcare_provider",
] as const

/** @deprecated Use WORKFORCE_APPLICATIONS_HUB_TYPES */
export const PEOPLE_MANAGEMENT_APPLICATIONS_HUB_TYPES = WORKFORCE_APPLICATIONS_HUB_TYPES

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  pending_review: "Pending Review",
  approved: "Approved",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
}

export const PENDING_STATUSES: ApplicationStatus[] = ["submitted", "pending_review"]

export type ApplicationRecord = {
  id: string
  organization_id: string
  application_type: string
  module_owner: ModuleOwner
  contact_id: string | null
  applicant_name: string
  applicant_email: string
  applicant_phone: string | null
  status: ApplicationStatus
  form_data: Record<string, unknown>
  notes: string | null
  review_notes: string | null
  submitted_at: string | null
  reviewed_at: string | null
  reviewed_by: string | null
  created_at: string
  updated_at: string
}

export type ApplicationHistoryRecord = {
  id: string
  organization_id: string
  application_id: string
  action: ApplicationAction
  previous_status: ApplicationStatus | null
  new_status: ApplicationStatus | null
  performed_by: string | null
  notes: string | null
  metadata: Record<string, unknown>
  created_at: string
}

export type ApplicationDocumentRecord = {
  id: string
  organization_id: string
  application_id: string
  file_name: string
  file_url: string
  file_type: string | null
  uploaded_by: string | null
  created_at: string
}

export type ApplicationListFilters = {
  status?: ApplicationStatus | ApplicationStatus[]
  applicationType?: string | string[]
  moduleOwner?: ModuleOwner | ModuleOwner[]
  contactId?: string
  search?: string
  dateFrom?: string
  dateTo?: string
  reviewerId?: string
  page?: number
  pageSize?: number
}

export type ApplicationDashboardStats = {
  total: number
  pendingReview: number
  approved: number
  rejected: number
  byType: Record<string, number>
}

export function buildTypeRegistry(
  rows: Array<{
    id: string
    label: string
    module_owner: ModuleOwner
    description?: string | null
    sort_order?: number | null
  }> | null
): Record<string, ApplicationTypeDefinition> {
  const source =
    rows && rows.length > 0
      ? rows.map((row) => ({
          id: row.id,
          label: row.label,
          moduleOwner: row.module_owner,
          description: row.description ?? undefined,
          sortOrder: row.sort_order ?? 0,
        }))
      : DEFAULT_APPLICATION_TYPES

  return Object.fromEntries(source.map((type) => [type.id, type]))
}

export function getTypeLabel(
  typeId: string,
  registry: Record<string, ApplicationTypeDefinition>
) {
  return registry[typeId]?.label ?? typeId.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

export function getTypeIcon(typeId: string): LucideIcon {
  switch (typeId) {
    case "volunteer":
      return Users
    case "vendor":
      return Store
    case "financial_aid":
      return Heart
    default:
      return Briefcase
  }
}

export function normalizeLegacyStatus(status: string): ApplicationStatus {
  if (status === "pending") return "pending_review"
  if (
    status === "draft" ||
    status === "submitted" ||
    status === "pending_review" ||
    status === "approved" ||
    status === "rejected" ||
    status === "withdrawn"
  ) {
    return status
  }
  return "pending_review"
}

export function isPendingStatus(status: ApplicationStatus) {
  return PENDING_STATUSES.includes(status)
}

export function hrApplicationTypes(registry: Record<string, ApplicationTypeDefinition>) {
  return Object.values(registry).filter((type) => type.moduleOwner === "workforce")
}

export function programApplicationTypes(registry: Record<string, ApplicationTypeDefinition>) {
  return Object.values(registry).filter((type) => type.moduleOwner === "programs")
}

export function vendorApplicationTypes(registry: Record<string, ApplicationTypeDefinition>) {
  return Object.values(registry).filter((type) => type.moduleOwner === "vendor_hub")
}

export function buildApplicationsListUrl(filters: {
  applicationType?: string
  moduleOwner?: ModuleOwner
  status?: ApplicationStatus | ApplicationStatus[]
}) {
  return moduleApplicationsUrl({
    moduleOwner: filters.moduleOwner,
    applicationType: filters.applicationType,
    status: filters.status,
  })
}
