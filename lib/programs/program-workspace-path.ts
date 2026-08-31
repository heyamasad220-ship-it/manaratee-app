import {
  parseDepartmentScheduleSection,
  type DepartmentScheduleSection,
} from "@/lib/donations/donation-group-path"

export type ProgramWorkspaceTab =
  | "overview"
  | "offerings"
  | "applications"
  | "students"
  | "schedule"
  | "finance"
  | "reports"
  | "settings"

export type ProgramSettingsSection =
  | "general"
  | "defaults"
  | "registration"
  | "notifications"
  | "promo-codes"

export type ProgramFinanceSection =
  | "transactions"
  | "payment-summary"
  | "addons"

export type ProgramReportsSection =
  | "enrollments"
  | "attendance"
  | "trends"
  | "year-comparison"

export function parseProgramWorkspaceTab(
  value: string | null | undefined
): ProgramWorkspaceTab {
  if (value === "offerings" || value === "programs") return "offerings"
  if (value === "applications") return "applications"
  if (value === "students" || value === "registrations") return "students"
  if (value === "schedule") return "schedule"
  if (value === "finance") return "finance"
  if (value === "reports") return "reports"
  if (value === "settings") return "settings"
  return "overview"
}

/** Leftover Registrations sub-tab bookmarks (`?tab=students&section=applications`). */
export function isLegacyProgramApplicationsQuery(
  tab: string | null | undefined,
  section: string | null | undefined
) {
  if (parseProgramWorkspaceTab(tab) !== "students") return false
  return (
    section === "applications" ||
    section === "review" ||
    section === "approved"
  )
}

export function parseProgramSettingsSection(
  section: string | null | undefined
): ProgramSettingsSection {
  if (section === "defaults" || section === "year-defaults") return "defaults"
  if (
    section === "registration" ||
    section === "notifications" ||
    section === "promo-codes"
  ) {
    return section
  }
  return "general"
}

export function parseProgramScheduleSection(
  tab: string | null | undefined,
  section: string | null | undefined
): DepartmentScheduleSection {
  return parseDepartmentScheduleSection(tab, section)
}

export function parseProgramFinanceSection(
  section: string | null | undefined
): ProgramFinanceSection {
  if (section === "payment-summary" || section === "tuition-plans") {
    return "payment-summary"
  }
  if (section === "addons" || section === "add-ons") return "addons"
  return "transactions"
}

export function isLegacyReportsPaymentSummary(
  tab: string | null | undefined,
  section: string | null | undefined
) {
  return (
    parseProgramWorkspaceTab(tab) === "reports" &&
    (section === "tuition-plans" || section === "payment-summary")
  )
}

export function isLegacyReportsWaitlist(
  tab: string | null | undefined,
  section: string | null | undefined
) {
  return (
    parseProgramWorkspaceTab(tab) === "reports" && section === "waitlist"
  )
}

export function isLegacyReportsAddons(
  tab: string | null | undefined,
  section: string | null | undefined
) {
  return (
    parseProgramWorkspaceTab(tab) === "reports" &&
    (section === "addons" || section === "add-ons")
  )
}

export function parseProgramReportsSection(
  section: string | null | undefined
): ProgramReportsSection {
  if (section === "attendance") return "attendance"
  if (section === "trends") return "trends"
  if (section === "year-comparison" || section === "growth") {
    return "year-comparison"
  }
  return "enrollments"
}

export type RegistrationStatusFilter =
  | "all"
  | "active"
  | "waitlisted"
  | "cancelled"
  | "pending"

export function parseRegistrationStatusParam(
  value: string | null | undefined
): RegistrationStatusFilter | null {
  const normalized = String(value || "").trim().toLowerCase()
  if (!normalized) return null
  if (normalized === "all") return "all"
  if (normalized === "enrolled" || normalized === "active") return "active"
  if (normalized === "waitlisted") return "waitlisted"
  if (
    normalized === "cancelled" ||
    normalized === "canceled" ||
    normalized === "withdrawn"
  ) {
    return "cancelled"
  }
  if (normalized === "pending" || normalized === "pending_checkout") {
    return "pending"
  }
  return null
}

export function registrationStatusParam(
  value: RegistrationStatusFilter
): string | null {
  if (value === "all") return "all"
  if (value === "active") return "enrolled"
  return value
}

export function programWorkspaceHref(
  programId: string,
  options?: {
    tab?: ProgramWorkspaceTab
    scheduleSection?: DepartmentScheduleSection
    financeSection?: ProgramFinanceSection
    reportsSection?: ProgramReportsSection
    settingsSection?: ProgramSettingsSection
    registrationStatus?: RegistrationStatusFilter
    offeringId?: string
  }
): string {
  const params = new URLSearchParams()
  if (options?.tab && options.tab !== "overview") {
    params.set("tab", options.tab)
  }
  if (
    options?.tab === "schedule" &&
    options.scheduleSection &&
    options.scheduleSection !== "class-times"
  ) {
    params.set("section", options.scheduleSection)
  }
  if (
    options?.tab === "finance" &&
    options.financeSection &&
    options.financeSection !== "transactions"
  ) {
    params.set("section", options.financeSection)
  }
  if (
    options?.tab === "reports" &&
    options.reportsSection &&
    options.reportsSection !== "enrollments"
  ) {
    params.set("section", options.reportsSection)
  }
  if (
    options?.tab === "settings" &&
    options.settingsSection &&
    options.settingsSection !== "general"
  ) {
    params.set("section", options.settingsSection)
  }
  if (options?.tab === "students") {
    if (options.registrationStatus) {
      const status = registrationStatusParam(options.registrationStatus)
      if (status) params.set("status", status)
    }
    if (options.offeringId) params.set("offering", options.offeringId)
  }
  const query = params.toString()
  return query ? `/programs/${programId}?${query}` : `/programs/${programId}`
}

/** Map leftover department `?year=` bookmarks into the Programs module. */
export function programWorkspaceHrefFromDepartmentYearQuery(input: {
  yearProgramId: string
  tab?: string | null
  section?: string | null
}): string {
  const tab = parseProgramWorkspaceTab(input.tab)
  if (tab === "students") {
    const isApplications =
      input.section === "review" ||
      input.section === "approved" ||
      input.section === "applications"
    return programWorkspaceHref(input.yearProgramId, {
      tab: isApplications ? "applications" : "students",
    })
  }
  if (tab === "schedule") {
    return programWorkspaceHref(input.yearProgramId, {
      tab: "schedule",
      scheduleSection: parseProgramScheduleSection("schedule", input.section),
    })
  }
  if (tab === "settings") {
    return programWorkspaceHref(input.yearProgramId, {
      tab: "settings",
      settingsSection: parseProgramSettingsSection(input.section),
    })
  }
  if (tab === "reports") {
    if (isLegacyReportsPaymentSummary("reports", input.section)) {
      return programWorkspaceHref(input.yearProgramId, {
        tab: "finance",
        financeSection: "payment-summary",
      })
    }
    if (isLegacyReportsAddons("reports", input.section)) {
      return programWorkspaceHref(input.yearProgramId, {
        tab: "finance",
        financeSection: "addons",
      })
    }
    return programWorkspaceHref(input.yearProgramId, {
      tab: "reports",
      reportsSection: parseProgramReportsSection(input.section),
    })
  }
  if (tab === "finance") {
    return programWorkspaceHref(input.yearProgramId, {
      tab: "finance",
      financeSection: parseProgramFinanceSection(input.section),
    })
  }
  return programWorkspaceHref(input.yearProgramId, { tab })
}
