"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ContactMergeDialog } from "@/components/contacts/contact-merge-dialog"
import { ContactBasicsPanel } from "@/components/contacts/contact-basics-panel"
import { ContactFamilyPanel } from "@/components/contacts/contact-family-panel"
import { ContactEmployeePanel } from "@/components/contacts/contact-employee-panel"
import { ContactFinancialPanel } from "@/components/contacts/contact-financial-panel"
import { ContactGroupGivingOverview } from "@/components/contacts/contact-group-giving-overview"
import { ContactGroupMembersPanel } from "@/components/contacts/contact-group-members-panel"
import { ContactMembershipPanel } from "@/components/contacts/contact-membership-panel"
import { ContactProgramEnrollmentsPanel } from "@/components/contacts/contact-program-enrollments-panel"
import { ContactTimelinePanel } from "@/components/contacts/contact-timeline-panel"
import { ContactVendorEvaluationsPanel } from "@/components/contacts/contact-vendor-evaluations-panel"
import { ContactVolunteerDetails } from "@/components/contacts/contact-volunteer-details"
import { ContactVolunteerPanel } from "@/components/contacts/contact-volunteer-panel"
import { WorkforceCredentialsPanel } from "@/components/workforce/workforce-credentials-panel"
import { ContactProgramAssignmentsPanel } from "@/components/contacts/contact-program-assignments-panel"
import { ContactApplicationsPanel } from "@/components/contacts/contact-applications-panel"
import { ContactProfileHeader } from "@/components/contacts/contact-profile-header"
import { ContactProfileFinancialSummaryCard } from "@/components/contacts/contact-profile-financial-summary-card"
import { createClient } from "@/lib/supabase/client"
import {
  type ContactRoleValue,
  filterContactRoles,
  getAllowedRolesForRecordType,
  isEntityContactType,
  normalizeContactRecordType,
  ROLE_VALUE_TO_LABEL,
} from "@/lib/contacts/contact-constants"
import { cn } from "@/lib/utils"
import type { ContactProfileData } from "@/lib/contacts/contact-profile-data"
import type { ContactProfileExtendedData } from "@/lib/contacts/contact-profile-admin-actions"
import type { ProgramStaffAssignmentWithDetails } from "@/lib/programs/program-staff-assignment-types"
import { canHaveProgramStaffAssignments } from "@/lib/hr/staff-role-utils"
import type { StaffSummaryForContact } from "@/lib/hr/staff-summary"
import {
  filterContactTimelineByModules,
  getContactProfileModuleFlags,
  showContactFinancialSurfaces,
} from "@/lib/contacts/contact-profile-module-access"
import { getContactDeleteEligibility } from "@/lib/contacts/contact-delete-eligibility"
import {
  contactsListSegmentForRecordType,
  getContactsListPathForSegment,
  isContactsListSegment,
  type ContactsListSegment,
} from "@/lib/contacts/contact-module-label"
import {
  contactProfileHref,
  normalizeContactProfileTab,
  type NormalizedContactProfileTab,
} from "@/lib/contacts/contact-profile-path"
import { STAFF_MAIN_CONTENT_STICKY_TOP_CLASS } from "@/lib/layout/staff-dashboard-chrome"
import { VENDOR_HUB_ROUTES } from "@/lib/vendor-hub/vendor-hub-routes"
import {
  isSafeReturnToPath,
  readStoredReturnToPath,
  RETURN_TO_QUERY_PARAM,
} from "@/lib/navigation/return-to"
import {
  Activity,
  DollarSign,
  GitMerge,
  Info,
  Loader2,
  Store,
  Trash2,
  User,
  Users,
  Wrench,
} from "lucide-react"

type ContactTab = NormalizedContactProfileTab

type ContactProfileClientProps = {
  contact: any
  profileData: ContactProfileData | null
  profileExtendedData: ContactProfileExtendedData | null
  profileExtendedLoading: boolean
  profileLoading: boolean
  programAssignments: ProgramStaffAssignmentWithDetails[]
  assignmentsLoading: boolean
  staffRecordId: string | null
  staffSummary: StaffSummaryForContact | null
  organizationId: string | null
  enabledModuleSlugs?: string[]
  onNotesChanged: () => Promise<void>
  onRolesUpdated: () => Promise<void>
  onContactUpdated: () => Promise<void>
  onExtendedDataChanged: () => Promise<void>
  variant?: "page" | "dialog"
  defaultEdit?: boolean
  onClose?: () => void
}

function formatCreatedDate(value: string | null | undefined) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function formatCurrencyCompact(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount)
}

export function ContactProfileClient({
  contact,
  profileData,
  profileExtendedData,
  profileExtendedLoading,
  profileLoading,
  programAssignments,
  assignmentsLoading,
  staffRecordId,
  staffSummary,
  organizationId,
  enabledModuleSlugs = [],
  onNotesChanged: _onNotesChanged,
  onRolesUpdated,
  onContactUpdated,
  onExtendedDataChanged,
  variant = "page",
  defaultEdit = false,
  onClose,
}: ContactProfileClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = useMemo(() => createClient(), [])
  const tabParam = searchParams.get("tab")
  const sectionParam = searchParams.get("section")
  const isDialog = variant === "dialog"
  const [dialogEditMode, setDialogEditMode] = useState(defaultEdit)
  const isEditMode = isDialog ? dialogEditMode : searchParams.get("edit") === "1"

  const modules = useMemo(
    () => getContactProfileModuleFlags(enabledModuleSlugs),
    [enabledModuleSlugs]
  )

  const recordType = normalizeContactRecordType(contact?.contact_type)

  const profileListSegment = useMemo((): ContactsListSegment => {
    const fromQuery = searchParams.get("list")
    if (isContactsListSegment(fromQuery)) {
      return fromQuery
    }
    return contactsListSegmentForRecordType(recordType)
  }, [recordType, searchParams])

  const [storedReturnTo, setStoredReturnTo] = useState<string | null>(null)

  useEffect(() => {
    if (isDialog) return
    const fromQuery = searchParams.get(RETURN_TO_QUERY_PARAM)
    if (fromQuery && isSafeReturnToPath(fromQuery)) return
    setStoredReturnTo(readStoredReturnToPath())
  }, [isDialog, searchParams])

  const resolvedReturnTo = useMemo(() => {
    const fromQuery = searchParams.get(RETURN_TO_QUERY_PARAM)
    if (fromQuery && isSafeReturnToPath(fromQuery)) {
      return fromQuery
    }
    return storedReturnTo
  }, [searchParams, storedReturnTo])

  const backPath =
    resolvedReturnTo ?? getContactsListPathForSegment(profileListSegment)

  const profileHrefOptions = useMemo(
    () => ({
      list: profileListSegment,
      ...(resolvedReturnTo ? { returnTo: resolvedReturnTo } : {}),
    }),
    [profileListSegment, resolvedReturnTo]
  )

  const roles = useMemo(() => {
    const filtered = filterContactRoles(
      ((contact?.contact_roles || []) as any[]).map((role) => role.role).filter(Boolean)
    )
    return filtered.filter((role) => getAllowedRolesForRecordType(recordType).includes(role))
  }, [contact, recordType])

  const roleLabels = useMemo(
    () =>
      roles
        .map((role) => ROLE_VALUE_TO_LABEL[role])
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b)),
    [roles]
  )

  const hasRole = useCallback(
    (roleName: ContactRoleValue) => roles.includes(roleName),
    [roles]
  )

  const isEntity = isEntityContactType(contact.contact_type)
  const isGroup = contact.contact_type === "group"

  const showDonorPanel = useMemo(() => {
    if (!modules.donations) return false
    if (isEntity) return true
    if (hasRole("donor")) return true
    if (!profileData) return false
    return (
      profileData.donorStats.donationCount > 0 ||
      profileData.donorStats.totalDonated > 0 ||
      profileData.donorStats.pledgeCount > 0
    )
  }, [hasRole, isEntity, modules.donations, profileData])

  const canShowProgramActions = !isEntity && modules.programs
  const canShowMembershipContent = !isEntity && modules.membership
  const canShowWorkforceContent = modules.workforce || modules.vendorHub

  const showFinancialTab = showContactFinancialSurfaces(modules)

  const showProgramAssignments = useMemo(() => {
    if (!modules.programs) return false
    if (programAssignments.length > 0) return true
    return canHaveProgramStaffAssignments({
      staffType: staffSummary?.staffType,
      hrJobRoleName: staffSummary?.hrJobRoleName,
      contactRoles: roles,
    })
  }, [modules.programs, programAssignments.length, roles, staffSummary])

  const hasWorkforceActivity = useMemo(() => {
    if (!canShowWorkforceContent) return false
    if (staffRecordId) return true
    return (
      hasRole("employee") ||
      hasRole("volunteer") ||
      hasRole("vendor") ||
      hasRole("service_provider") ||
      hasRole("childcare_provider")
    )
  }, [canShowWorkforceContent, hasRole, staffRecordId])

  function resolveAvailableTab(value: string | null | undefined): ContactTab {
    const normalized = normalizeContactProfileTab(value)
    if (normalized === "financial" && !showFinancialTab) return "overview"
    return normalized
  }

  const [activeTab, setActiveTab] = useState<ContactTab>(() => {
    if (sectionParam === "activity" || tabParam === "activity") return "activity"
    return resolveAvailableTab(tabParam)
  })
  const [showMergeDialog, setShowMergeDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showContactEditorDialog, setShowContactEditorDialog] = useState(false)
  const [contactBasicsActions, setContactBasicsActions] = useState<{
    save: () => void
    cancel: () => void
    isPending: boolean
    isEditing: boolean
  } | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (sectionParam === "activity" && (!tabParam || tabParam === "home" || tabParam === "overview")) {
      setActiveTab("activity")
      if (!isDialog) {
        router.replace(
          contactProfileHref(contact.id, {
            ...profileHrefOptions,
            tab: "activity",
          }),
          { scroll: false }
        )
      }
      return
    }

    if (isEditMode) {
      setActiveTab("overview")
      return
    }

    if (tabParam) {
      setActiveTab(resolveAvailableTab(tabParam))
    } else {
      setActiveTab((current) => resolveAvailableTab(current))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resolveAvailableTab depends on module flags already in deps via show* flags
  }, [
    contact.id,
    isDialog,
    isEditMode,
    profileHrefOptions,
    router,
    sectionParam,
    showFinancialTab,
    tabParam,
  ])

  useEffect(() => {
    if (isDialog) {
      setDialogEditMode(defaultEdit)
    }
  }, [defaultEdit, isDialog, contact.id])

  useEffect(() => {
    if (isDialog) return
    const fromQuery = searchParams.get("list")
    if (fromQuery === "families" && recordType === "individual") return
    const expectedList = contactsListSegmentForRecordType(recordType)
    if (fromQuery === expectedList) return

    const tab = resolveAvailableTab(tabParam)
    router.replace(
      contactProfileHref(contact.id, {
        ...profileHrefOptions,
        tab: tab === "overview" ? undefined : tab,
      }),
      { scroll: false }
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    contact.id,
    isDialog,
    profileHrefOptions,
    recordType,
    router,
    searchParams,
    tabParam,
  ])

  function setContactEditMode(edit: boolean) {
    if (edit) {
      setActiveTab("overview")
      setShowContactEditorDialog(true)
      if (isDialog) {
        setDialogEditMode(true)
      }
      return
    }

    setShowContactEditorDialog(false)
    if (isDialog) {
      setDialogEditMode(false)
      return
    }

    if (searchParams.get("edit") === "1") {
      router.replace(
        contactProfileHref(contact.id, {
          ...profileHrefOptions,
          tab: "overview",
          edit: false,
        }),
        { scroll: false }
      )
    }
  }

  useEffect(() => {
    if (isDialog) return
    if (searchParams.get("edit") === "1") {
      setShowContactEditorDialog(true)
    }
  }, [isDialog, searchParams, contact.id])

  function handleTabChange(value: string) {
    const tab = resolveAvailableTab(value)
    setActiveTab(tab)
    if (isDialog) {
      if (dialogEditMode) setDialogEditMode(false)
      return
    }
    router.replace(
      contactProfileHref(contact.id, {
        ...profileHrefOptions,
        tab: tab === "overview" ? undefined : tab,
        edit: false,
      }),
      { scroll: false }
    )
  }

  async function handleDeleteContact() {
    setDeleting(true)

    const { error: notesError } = await supabase
      .from("contact_notes")
      .delete()
      .eq("contact_id", contact.id)

    if (notesError) {
      alert(notesError.message || "Could not delete contact notes")
      setDeleting(false)
      return
    }

    const { error: rolesError } = await supabase
      .from("contact_roles")
      .delete()
      .eq("contact_id", contact.id)

    if (rolesError) {
      alert(rolesError.message || "Could not delete contact roles")
      setDeleting(false)
      return
    }

    const { error: contactError } = await supabase
      .from("contacts")
      .delete()
      .eq("id", contact.id)

    if (contactError) {
      alert(contactError.message || "Could not delete contact")
      setDeleting(false)
      return
    }

    setShowDeleteDialog(false)
    router.push(backPath)
  }

  const stickyTopClass = isDialog ? "top-0" : STAFF_MAIN_CONTENT_STICKY_TOP_CLASS
  const createdLabel = formatCreatedDate(contact.created_at)
  const overviewTimeline = useMemo(
    () => filterContactTimelineByModules(profileData?.timeline ?? [], modules),
    [modules, profileData?.timeline]
  )
  const showProgramsRelated =
    modules.programs && (profileData?.enrollmentRecords?.length ?? 0) > 0
  const showBookingsRelated =
    modules.bookings && (profileData?.rentalStats.rentalCount ?? 0) > 0
  const showMembershipRelated =
    modules.membership && (profileData?.activeTeamsCount ?? 0) > 0
  const showVendorRelated =
    modules.vendorHub &&
    (hasRole("vendor") || (profileData?.vendorStats.activityCount ?? 0) > 0)
  const showRelatedActivity =
    !isGroup &&
    (showDonorPanel ||
      showProgramsRelated ||
      showBookingsRelated ||
      showMembershipRelated ||
      showVendorRelated)
  const showDonationsSummary = showDonorPanel
  const showBookingsSummary = showBookingsRelated
  const showVendorSummary = showVendorRelated
  const showProgramsHint =
    modules.programs &&
    showProgramsRelated &&
    !showDonationsSummary &&
    !showBookingsSummary &&
    !showVendorSummary
  const showMembershipHint =
    modules.membership &&
    showMembershipRelated &&
    !showDonationsSummary &&
    !showBookingsSummary &&
    !showVendorSummary &&
    !showProgramsHint

  function formatVendorRelatedSubtitle() {
    if (profileLoading) return "Loading…"
    const stats = profileData?.vendorStats
    if (!stats) return "Open vendor profile"
    const parts: string[] = []
    if (stats.applicationCount > 0) {
      parts.push(
        `${stats.applicationCount} application${stats.applicationCount === 1 ? "" : "s"}`
      )
    }
    if (stats.participationCount > 0) {
      parts.push(
        `${stats.participationCount} event${stats.participationCount === 1 ? "" : "s"}`
      )
    }
    if (stats.paymentCount > 0) {
      parts.push(
        `${formatCurrencyCompact(stats.paymentTotal)} paid · ${stats.paymentCount} payment${
          stats.paymentCount === 1 ? "" : "s"
        }`
      )
    }
    if (parts.length > 0) return parts.join(" · ")
    if (hasRole("vendor")) return "Active vendor · Open profile"
    return "Open vendor profile"
  }

  const deleteEligibility = useMemo(
    () =>
      getContactDeleteEligibility({
        familyMemberCount: profileExtendedData?.familyMembers?.length ?? 0,
        timeline: profileData?.timeline ?? [],
        donorStats: profileData?.donorStats,
        rentalStats: profileData?.rentalStats,
        vendorStats: profileData?.vendorStats,
        enrollmentCount: profileData?.enrollmentRecords?.length ?? 0,
        activeTeamsCount: profileData?.activeTeamsCount ?? 0,
      }),
    [profileData, profileExtendedData?.familyMembers]
  )

  const relatedActivitySection = showRelatedActivity ? (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Related Activity</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        {showDonorPanel ? (
          <button
            type="button"
            className="rounded-lg border border-border p-3 text-left transition hover:bg-muted/40"
            onClick={() => handleTabChange("financial")}
          >
            <p className="text-sm font-medium">Donations</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {profileLoading
                ? "Loading…"
                : profileData
                  ? [
                      `${formatCurrencyCompact(profileData.donorStats.totalDonated)} lifetime`,
                      `${profileData.donorStats.donationCount} gifts`,
                      profileData.donorStats.lastDonationDate
                        ? `last ${formatCreatedDate(profileData.donorStats.lastDonationDate)}`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")
                  : "View financial history"}
            </p>
          </button>
        ) : null}
        {showProgramsRelated ? (
          <button
            type="button"
            className="rounded-lg border border-border p-3 text-left transition hover:bg-muted/40"
            onClick={() => handleTabChange("activity")}
          >
            <p className="text-sm font-medium">Programs</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {profileLoading
                ? "Loading…"
                : `${profileData?.enrollmentRecords?.length ?? 0} enrollments · View activity`}
            </p>
          </button>
        ) : null}
        {showBookingsRelated ? (
          <button
            type="button"
            className="rounded-lg border border-border p-3 text-left transition hover:bg-muted/40"
            onClick={() => handleTabChange("financial")}
          >
            <p className="text-sm font-medium">Venue Rentals</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {profileLoading
                ? "Loading…"
                : profileData
                  ? [
                      `${profileData.rentalStats.rentalCount} rentals`,
                      profileData.rentalStats.lastRentalDate
                        ? `last ${formatCreatedDate(profileData.rentalStats.lastRentalDate)}`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")
                  : "Open balances and rental activity on Financial"}
            </p>
          </button>
        ) : null}
        {showMembershipRelated ? (
          <button
            type="button"
            className="rounded-lg border border-border p-3 text-left transition hover:bg-muted/40"
            onClick={() => handleTabChange("activity")}
          >
            <p className="text-sm font-medium">Membership</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {profileLoading
                ? "Loading…"
                : `${profileData?.activeTeamsCount ?? 0} groups · View activity`}
            </p>
          </button>
        ) : null}
        {showVendorRelated ? (
          <Link
            href={VENDOR_HUB_ROUTES.network.vendor(contact.id)}
            className="rounded-lg border border-border p-3 text-left transition hover:bg-muted/40"
          >
            <p className="text-sm font-medium">Vendor Hub</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatVendorRelatedSubtitle()}
            </p>
          </Link>
        ) : null}
      </CardContent>
    </Card>
  ) : null

  return (
    <div className={isDialog ? "flex flex-col gap-6 p-4 sm:p-6" : "flex flex-col gap-6 p-6"}>
      {isDialog && onClose ? (
        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      ) : null}

      <div
        className={cn(
          "sticky z-40 -mx-6 space-y-4 border-b border-border bg-background px-6 pb-4 pt-1",
          stickyTopClass
        )}
      >
        <ContactProfileHeader
          contactName={contact.full_name || "Unnamed Contact"}
          recordType={recordType}
          status={contact.status}
          roleLabels={roleLabels}
          phone={contact.phone}
          email={contact.email}
          city={contact.city}
          state={contact.state}
          address={contact.address}
          onNameClick={() => setContactEditMode(true)}
          actions={
            !isEntity ? (
              <Button variant="outline" size="sm" onClick={() => setShowMergeDialog(true)}>
                <GitMerge className="mr-1.5 h-4 w-4" />
                Merge duplicate
              </Button>
            ) : null
          }
        />

        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList className="flex h-auto flex-wrap justify-start gap-1">
            <TabsTrigger value="overview" className="gap-2">
              <User className="size-4" />
              Overview
            </TabsTrigger>
            {showFinancialTab ? (
              <TabsTrigger value="financial" className="gap-2">
                <DollarSign className="size-4" />
                Financial
              </TabsTrigger>
            ) : null}
            <TabsTrigger value="activity" className="gap-2">
              <Activity className="size-4" />
              Activity
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {activeTab === "overview" ? (
        <div className="space-y-6">
          {isGroup ? (
            <ContactGroupMembersPanel
              groupContactId={contact.id}
              groupName={contact.full_name || "Group"}
            />
          ) : null}
          {isGroup && showDonorPanel && !profileLoading ? (
            <ContactGroupGivingOverview
              groupContactId={contact.id}
              groupName={contact.full_name || "Group"}
            />
          ) : null}

          {showFinancialTab && !isGroup ? (
            <ContactFinancialPanel
              contactId={contact.id}
              contactName={contact.full_name || "Contact"}
              contactEmail={contact.email}
              contactPhone={contact.phone}
              donorId={profileData?.donorId}
              personId={contact.person_id ?? null}
              isGroup={isGroup}
              modules={modules}
              hideIdentity
              surface="staff-overview"
              stickyTopClass={stickyTopClass}
            />
          ) : null}

          {showFinancialTab && !isGroup ? (
            <ContactProfileFinancialSummaryCard
              profileLoading={profileLoading}
              donorStats={profileData?.donorStats ?? null}
              rentalStats={profileData?.rentalStats ?? null}
              vendorStats={profileData?.vendorStats ?? null}
              showDonationsSummary={showDonationsSummary}
              showBookingsSummary={showBookingsSummary}
              showVendorSummary={showVendorSummary}
              showProgramsHint={showProgramsHint}
              showMembershipHint={showMembershipHint}
              onOpenFinancial={() => handleTabChange("financial")}
            />
          ) : null}
        </div>
      ) : null}

      {activeTab === "financial" && showFinancialTab ? (
        <ContactFinancialPanel
          contactId={contact.id}
          contactName={contact.full_name || "Contact"}
          contactEmail={contact.email}
          contactPhone={contact.phone}
          donorId={profileData?.donorId}
          personId={contact.person_id ?? null}
          isGroup={isGroup}
          modules={modules}
          paymentMethods={profileExtendedData?.paymentMethods ?? []}
          paymentMethodsLoading={profileExtendedLoading}
          showPaymentMethods={!isGroup}
          hideIdentity
          stickyTopClass={stickyTopClass}
          refreshToken={0}
          surface={isGroup ? "full" : "staff-details"}
        />
      ) : null}

      {activeTab === "activity" ? (
        <div className="space-y-6">
          {relatedActivitySection}

          {canShowMembershipContent && (profileData?.activeTeamsCount ?? 0) > 0 ? (
            <ContactMembershipPanel
              contactId={contact.id}
              contactName={contact.full_name || "Unnamed Contact"}
              teamsCount={profileData?.activeTeamsCount ?? 0}
              onMembershipChanged={onRolesUpdated}
            />
          ) : null}
          {canShowProgramActions && (profileData?.enrollmentRecords?.length ?? 0) > 0 ? (
            <ContactProgramEnrollmentsPanel
              enrollments={profileData?.enrollmentRecords ?? []}
              loading={profileLoading}
            />
          ) : null}
          {showProgramAssignments && programAssignments.length > 0 ? (
            assignmentsLoading ? (
              <Card>
                <CardContent className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading program assignments...
                </CardContent>
              </Card>
            ) : (
              <ContactProgramAssignmentsPanel
                contactId={contact.id}
                assignments={programAssignments}
              />
            )
          ) : null}

          {hasWorkforceActivity ? (
            <>
              {modules.workforce && staffRecordId ? (
                <ContactEmployeePanel
                  staffId={staffRecordId}
                  organizationId={organizationId}
                  contactRoles={roles}
                  contactId={contact.id}
                />
              ) : modules.workforce && hasRole("employee") ? (
                <Card>
                  <CardContent className="p-6 text-sm text-muted-foreground">
                    This contact has an employee role but no linked staff record yet. Link or create a
                    staff record from Workforce → Employees.
                  </CardContent>
                </Card>
              ) : null}

              {modules.workforce && hasRole("volunteer") ? (
                <>
                  <ContactVolunteerDetails contactId={contact.id} />
                  <ContactVolunteerPanel
                    contactId={contact.id}
                    contactName={contact.full_name || "Unnamed Contact"}
                    contactEmail={contact.email || ""}
                    contactPhone={contact.phone || ""}
                  />
                </>
              ) : null}

              {modules.workforce &&
              (hasRole("volunteer") ||
                hasRole("employee") ||
                hasRole("childcare_provider") ||
                staffRecordId) ? (
                <WorkforceCredentialsPanel contactId={contact.id} />
              ) : null}

              {modules.vendorHub && hasRole("vendor") ? (
                <>
                  <ContactVendorEvaluationsPanel contactId={contact.id} />
                  <Card>
                    <CardContent className="p-6">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Store className="h-5 w-5 text-amber-600" />
                          <h2 className="text-lg font-semibold">Vendor</h2>
                        </div>
                        <Button variant="outline" size="sm" asChild>
                          <Link href="/vendor-hub/network/vendors">Vendor Network</Link>
                        </Button>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Booth assignments and vendor participation are managed in Vendor Hub.
                      </p>
                    </CardContent>
                  </Card>
                </>
              ) : null}

              {modules.workforce && hasRole("service_provider") ? (
                <Card>
                  <CardContent className="p-6">
                    <div className="mb-2 flex items-center gap-2">
                      <Wrench className="h-5 w-5 text-purple-600" />
                      <h2 className="text-lg font-semibold">Service Provider</h2>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Service agreements, invoices, and service history can appear here.
                    </p>
                  </CardContent>
                </Card>
              ) : null}
            </>
          ) : null}

          {!isEntity && modules.applications ? (
            <ContactApplicationsPanel contactId={contact.id} />
          ) : null}
          <ContactTimelinePanel
            items={overviewTimeline}
            loading={profileLoading}
          />
        </div>
      ) : null}

      {createdLabel ? (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Info className="h-3.5 w-3.5 shrink-0" />
          This contact record was created on {createdLabel}.
        </p>
      ) : null}

      <Dialog
        open={showContactEditorDialog}
        onOpenChange={(open) => {
          if (!open) setContactEditMode(false)
          else setShowContactEditorDialog(true)
        }}
      >
        <DialogContent className="flex max-h-[90vh] w-[calc(100%-2rem)] max-w-5xl flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
          <DialogHeader className="shrink-0 border-b border-border px-6 py-4">
            <DialogTitle>Edit contact</DialogTitle>
            <DialogDescription>
              Update contact details and family members for{" "}
              {contact.full_name || "this contact"}.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-4">
            <section className="space-y-3">
              <h3 className="text-sm font-semibold">Contact information</h3>
              <ContactBasicsPanel
                key={`contact-editor-${contact.id}-${showContactEditorDialog ? "open" : "closed"}`}
                contact={contact}
                personDetails={profileExtendedData?.personDetails ?? null}
                defaultEditing
                onSaved={onContactUpdated}
                layout="overview-general"
                showEditButton={false}
                hideSaveBar
                onEditActionsChange={setContactBasicsActions}
              />
            </section>

            {!isEntity ? (
              <section className="space-y-3">
                <h3 className="text-sm font-semibold">Family</h3>
                {profileExtendedLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading family members...
                  </div>
                ) : (
                  <ContactFamilyPanel
                    contactId={contact.id}
                    familyMembers={profileExtendedData?.familyMembers ?? []}
                    onChanged={onExtendedDataChanged}
                    embedded
                  />
                )}
              </section>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border px-6 py-4">
            <Button
              variant="destructive"
              onClick={() => {
                if (!deleteEligibility.allowed) {
                  alert(
                    [
                      "This contact cannot be deleted while related information exists:",
                      ...deleteEligibility.reasons.map((reason) => `• ${reason}`),
                    ].join("\n")
                  )
                  return
                }
                setShowContactEditorDialog(false)
                setShowDeleteDialog(true)
              }}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete contact
            </Button>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                disabled={contactBasicsActions?.isPending}
                onClick={() => {
                  contactBasicsActions?.cancel()
                  setContactEditMode(false)
                }}
              >
                Cancel
              </Button>
              <Button
                disabled={contactBasicsActions?.isPending}
                onClick={() => contactBasicsActions?.save()}
              >
                {contactBasicsActions?.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save changes"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ContactMergeDialog
        open={showMergeDialog}
        onOpenChange={setShowMergeDialog}
        mode="absorb"
        fixedContact={{
          id: contact.id,
          full_name: contact.full_name,
          email: contact.email,
          phone: contact.phone,
        }}
        onMerged={() => {
          void onContactUpdated()
        }}
      />

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete contact</DialogTitle>
            <DialogDescription>
              Delete {contact.full_name || "this contact"}? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteContact}
              disabled={deleting || !deleteEligibility.allowed}
            >
              {deleting ? "Deleting..." : "Delete contact"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export async function fetchStaffSummaryForContact(
  supabase: ReturnType<typeof createClient>,
  organizationId: string,
  contactId: string
) {
  const { data, error } = await supabase
    .from("staff")
    .select(`
      id,
      staff_type,
      hr_job_roles:hr_job_role_id (name)
    `)
    .eq("organization_id", organizationId)
    .eq("contact_id", contactId)
    .maybeSingle()

  if (error && error.code !== "42P01" && error.code !== "42703") {
    console.warn("Could not load staff record for contact:", error.message)
  }

  if (!data?.id) return null

  return {
    id: data.id as string,
    staffType: (data.staff_type as string | null) ?? null,
    hrJobRoleName: ((data as any).hr_job_roles?.name as string | null) ?? null,
  }
}

export async function fetchStaffRecordIdForContact(
  supabase: ReturnType<typeof createClient>,
  organizationId: string,
  contactId: string
): Promise<string | null> {
  const summary = await fetchStaffSummaryForContact(supabase, organizationId, contactId)
  return summary?.id ?? null
}
