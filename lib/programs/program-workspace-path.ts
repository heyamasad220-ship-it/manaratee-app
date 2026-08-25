import {
  parseDepartmentScheduleSection,
  type DepartmentScheduleSection,
  type DepartmentStudentsSection,
} from "@/lib/donations/donation-group-path"

export type ProgramWorkspaceTab =
  | "overview"
  | "offerings"
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

export type ProgramFinanceSection = "transactions" | "payment-summary"

export type ProgramReportsSection =
  | "enrollments"
  | "addons"
  | "waitlist"
  | "attendance"

export function parseProgramWorkspaceTab(
  value: string | null | undefined
): ProgramWorkspaceTab {
  if (value === "offerings" || value === "programs") return "offerings"
  if (value === "students" || value === "registrations") return "students"
  if (value === "schedule") return "schedule"
  if (value === "finance") return "finance"
  if (value === "reports") return "reports"
  if (value === "settings") return "settings"
  return "overview"
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

export function parseProgramReportsSection(
  section: string | null | undefined
): ProgramReportsSection {
  if (section === "addons" || section === "add-ons") return "addons"
  if (section === "waitlist") return "waitlist"
  if (section === "attendance") return "attendance"
  return "enrollments"
}

export function programWorkspaceHref(
  programId: string,
  options?: {
    tab?: ProgramWorkspaceTab
    studentsSection?: DepartmentStudentsSection
    scheduleSection?: DepartmentScheduleSection
    financeSection?: ProgramFinanceSection
    reportsSection?: ProgramReportsSection
    settingsSection?: ProgramSettingsSection
  }
): string {
  const params = new URLSearchParams()
  if (options?.tab && options.tab !== "overview") {
    params.set("tab", options.tab)
  }
  if (
    options?.tab === "students" &&
    options.studentsSection &&
    options.studentsSection !== "enrollments"
  ) {
    params.set("section", options.studentsSection)
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
    const section =
      input.section === "review" ||
      input.section === "approved" ||
      input.section === "applications"
        ? "applications"
        : input.section === "roster" || input.section === "enrollments"
          ? "enrollments"
          : undefined
    return programWorkspaceHref(input.yearProgramId, {
      tab: "students",
      studentsSection: section,
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
