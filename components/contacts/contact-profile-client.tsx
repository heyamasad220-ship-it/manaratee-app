"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ContactAddPledgeDialog } from "@/components/contacts/contact-add-pledge-dialog"
import { ContactMergeDialog } from "@/components/contacts/contact-merge-dialog"
import { ContactBasicsPanel } from "@/components/contacts/contact-basics-panel"
import { ContactReceivePaymentDialog } from "@/components/contacts/contact-receive-payment-dialog"
import { ContactFamilyPanel } from "@/components/contacts/contact-family-panel"
import { ContactEmployeePanel } from "@/components/contacts/contact-employee-panel"
import { ContactFinancialPanel } from "@/components/contacts/contact-financial-panel"
import { ContactProfileCollapsibleSection } from "@/components/contacts/contact-profile-collapsible-section"
import { ContactGroupGivingOverview } from "@/components/contacts/contact-group-giving-overview"
import { ContactGroupMembersPanel } from "@/components/contacts/contact-group-members-panel"
import { ContactMembershipPanel } from "@/components/contacts/contact-membership-panel"
import { ContactProgramEnrollmentsPanel } from "@/components/contacts/contact-program-enrollments-panel"
import { ContactNotesPanel } from "@/components/contacts/contact-notes-panel"
import { ContactTimelinePanel } from "@/components/contacts/contact-timeline-panel"
import { ContactVendorEvaluationsPanel } from "@/components/contacts/contact-vendor-evaluations-panel"
import { ContactVolunteerDetails } from "@/components/contacts/contact-volunteer-details"
import { ContactVolunteerPanel } from "@/components/contacts/contact-volunteer-panel"
import { WorkforceCredentialsPanel } from "@/components/workforce/workforce-credentials-panel"
import { ContactProgramAssignmentsPanel } from "@/components/contacts/contact-program-assignments-panel"
import { ContactApplicationsPanel } from "@/components/contacts/contact-applications-panel"
import { createClient } from "@/lib/supabase/client"
import {
  type ContactRoleValue,
  filterContactRoles,
  getAllowedRolesForRecordType,
  getContactRecordTypeLabel,
  isEntityContactType,
  mapStatus,
  normalizeContactRecordType,
  ROLE_COLORS,
  ROLE_ICONS,
  ROLE_VALUE_TO_LABEL,
  STATUS_COLORS,
} from "@/lib/contacts/contact-constants"
import { cn } from "@/lib/utils"
import type { ContactProfileData } from "@/lib/contacts/contact-profile-data"
import type { ContactProfileExtendedData } from "@/lib/contacts/contact-profile-admin-actions"
import type { ProgramStaffAssignmentWithDetails } from "@/lib/programs/program-staff-assignment-types"
import { canHaveProgramStaffAssignments } from "@/lib/hr/staff-role-utils"
import type { StaffSummaryForContact } from "@/lib/hr/staff-summary"
import { getContactProfileModuleFlags } from "@/lib/contacts/contact-profile-module-access"
import {
  contactsListSegmentForRecordType,
  getContactsListPathForSegment,
  isContactsListSegment,
  type ContactsListSegment,
} from "@/lib/contacts/contact-module-label"
import { contactProfileHref, normalizeContactProfileTab } from "@/lib/contacts/contact-profile-path"
import { STAFF_MAIN_CONTENT_STICKY_TOP_CLASS } from "@/lib/layout/staff-dashboard-chrome"
import {
  isSafeReturnToPath,
  readStoredReturnToPath,
  RETURN_TO_QUERY_PARAM,
} from "@/lib/navigation/return-to"
import {
  Briefcase,
  Building2,
  DollarSign,
  GitMerge,
  HandCoins,
  Loader2,
  Mail,
  MoreVertical,
  Phone,
  Store,
  Trash2,
  User,
  Users,
  Wrench,
} from "lucide-react"

const MODULE_TABS = ["participation", "workforce"] as const

type ModuleTab = (typeof MODULE_TABS)[number]
type ContactTab = "home" | ModuleTab

type ProfileSection = "overview" | "activity"

function normalizeProfileSection(value: string | null): ProfileSection {
  if (value === "activity") return "activity"
  // general / family / overview / details → Overview
  return "overview"
}

function normalizeTab(value: string | null, availableModules: ModuleTab[]): ContactTab {
  const normalized = normalizeContactProfileTab(value)
  if (normalized === "participation" || normalized === "workforce") {
    return availableModules.includes(normalized) ? normalized : "home"
  }
  // details / overview / financial / home → combined summary page
  return "home"
}

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
  onNotesChanged,
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

  const hasRole = useCallback(
    (roleName: ContactRoleValue) => roles.includes(roleName),
    [roles]
  )

  const roleLabels = useMemo(
    () =>
      roles
        .map((role) => ROLE_VALUE_TO_LABEL[role])
        .sort((a, b) => a.localeCompare(b)),
    [roles]
  )

  const isEntity = isEntityContactType(contact.contact_type)
  const isOrganization = contact.contact_type === "organization"
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

  const showParticipationTab =
    !isEntity && (modules.programs || modules.membership)

  const showWorkforceTab = modules.workforce || modules.vendorHub

  const showFinancialHome =
    modules.donations || modules.bookings || modules.programs || modules.membership

  const showProgramAssignments = useMemo(() => {
    if (!modules.programs) return false
    if (programAssignments.length > 0) return true
    return canHaveProgramStaffAssignments({
      staffType: staffSummary?.staffType,
      hrJobRoleName: staffSummary?.hrJobRoleName,
      contactRoles: roles,
    })
  }, [modules.programs, programAssignments.length, roles, staffSummary])

  const availableModuleTabs = useMemo(() => {
    const tabs: ModuleTab[] = []
    if (showParticipationTab) tabs.push("participation")
    if (showWorkforceTab) tabs.push("workforce")
    return tabs
  }, [showParticipationTab, showWorkforceTab])

  const [activeTab, setActiveTab] = useState<ContactTab>(() =>
    normalizeTab(tabParam, availableModuleTabs)
  )
  const [showMergeDialog, setShowMergeDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showReceivePaymentDialog, setShowReceivePaymentDialog] = useState(false)
  const [showAddPledgeDialog, setShowAddPledgeDialog] = useState(false)
  const [financialRefreshToken, setFinancialRefreshToken] = useState(0)
  const [deleting, setDeleting] = useState(false)

  async function handleDonationDialogSuccess() {
    setFinancialRefreshToken((current) => current + 1)
    await onContactUpdated()
  }
  const sectionParam = searchParams.get("section")
  const initialProfileSection = normalizeProfileSection(
    tabParam === "activity" ? "activity" : sectionParam
  )
  const shouldOpenProfileFromUrl =
    defaultEdit ||
    searchParams.get("edit") === "1" ||
    tabParam === "details" ||
    tabParam === "activity" ||
    sectionParam === "general" ||
    sectionParam === "family" ||
    sectionParam === "overview" ||
    sectionParam === "activity"

  const [overviewOpen, setOverviewOpen] = useState(
    () =>
      Boolean(shouldOpenProfileFromUrl && initialProfileSection === "overview") ||
      defaultEdit ||
      searchParams.get("edit") === "1"
  )
  const [notesActivityOpen, setNotesActivityOpen] = useState(
    () => Boolean(shouldOpenProfileFromUrl && initialProfileSection === "activity")
  )

  useEffect(() => {
    if (tabParam === "activity") {
      setActiveTab("home")
      setNotesActivityOpen(true)
      if (!isDialog) {
        router.replace(
          contactProfileHref(contact.id, {
            ...profileHrefOptions,
            section: "activity",
          }),
          { scroll: false }
        )
      }
      return
    }

    if (isEditMode) {
      setActiveTab("home")
      setOverviewOpen(true)
      return
    }

    if (tabParam) {
      setActiveTab(normalizeTab(tabParam, availableModuleTabs))
    } else {
      setActiveTab((current) =>
        current === "participation" || current === "workforce"
          ? availableModuleTabs.includes(current)
            ? current
            : "home"
          : "home"
      )
    }

    if (sectionParam === "activity") {
      setNotesActivityOpen(true)
    } else if (
      sectionParam === "general" ||
      sectionParam === "family" ||
      sectionParam === "overview" ||
      tabParam === "details"
    ) {
      setOverviewOpen(true)
    }
  }, [
    availableModuleTabs,
    contact.id,
    isDialog,
    isEditMode,
    profileHrefOptions,
    router,
    sectionParam,
    tabParam,
  ])

  useEffect(() => {
    if (isDialog) {
      setDialogEditMode(defaultEdit)
      if (defaultEdit) {
        setOverviewOpen(true)
      }
    }
  }, [defaultEdit, isDialog, contact.id])

  useEffect(() => {
    if (isDialog) return
    const fromQuery = searchParams.get("list")
    if (fromQuery === "families" && recordType === "individual") return
    const expectedList = contactsListSegmentForRecordType(recordType)
    if (fromQuery === expectedList) return

    const tab = normalizeTab(tabParam, availableModuleTabs)
    router.replace(
      contactProfileHref(contact.id, {
        ...profileHrefOptions,
        tab: tab === "home" ? undefined : tab,
        section: notesActivityOpen && !overviewOpen ? "activity" : undefined,
      }),
      { scroll: false }
    )
  }, [
    availableModuleTabs,
    contact.id,
    isDialog,
    notesActivityOpen,
    overviewOpen,
    profileHrefOptions,
    recordType,
    router,
    searchParams,
    tabParam,
  ])

  function setContactEditMode(edit: boolean) {
    if (edit) {
      setActiveTab("home")
      setOverviewOpen(true)
      if (isDialog) {
        setDialogEditMode(true)
      }
      return
    }

    if (isDialog) {
      setDialogEditMode(false)
      return
    }

    // Clear deep-link ?edit=1 without treating edit as a separate page state.
    if (searchParams.get("edit") === "1") {
      router.replace(
        contactProfileHref(contact.id, {
          ...profileHrefOptions,
          edit: false,
        }),
        { scroll: false }
      )
    }
  }

  function handleTabChange(value: string) {
    const tab = normalizeTab(value, availableModuleTabs)
    setActiveTab(tab)
    if (isDialog) {
      if (dialogEditMode) setDialogEditMode(false)
      return
    }
    router.replace(
      contactProfileHref(contact.id, {
        ...profileHrefOptions,
        tab: tab === "home" ? undefined : tab,
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

  const showStickyInFinancialPanel = activeTab === "home" && showFinancialHome
  const stickyTopClass = isDialog ? "top-0" : STAFF_MAIN_CONTENT_STICKY_TOP_CLASS

  const identityHeader = (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        {isOrganization ? (
          <Building2 className="h-5 w-5 shrink-0 text-muted-foreground" />
        ) : isGroup ? (
          <Users className="h-5 w-5 shrink-0 text-muted-foreground" />
        ) : (
          <User className="h-5 w-5 shrink-0 text-muted-foreground" />
        )}
        <h1 className="text-xl font-semibold">{contact.full_name || "Unnamed Contact"}</h1>
        {roleLabels.length > 0 ? (
          roleLabels.map((label) => {
            const RoleIcon = ROLE_ICONS[label]
            return (
              <Badge
                key={label}
                variant="secondary"
                className={cn("gap-1 font-normal", ROLE_COLORS[label])}
              >
                <RoleIcon className="h-3 w-3" />
                {label}
              </Badge>
            )
          })
        ) : isEntity ? (
          <Badge variant="outline" className="font-normal">
            {getContactRecordTypeLabel(recordType)}
          </Badge>
        ) : null}
        <Badge variant="secondary" className={STATUS_COLORS[mapStatus(contact.status)]}>
          {mapStatus(contact.status)}
        </Badge>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" className="h-7 w-7 shrink-0 p-0">
              <span className="sr-only">Contact actions</span>
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {modules.donations ? (
              <>
                <DropdownMenuItem onClick={() => setShowReceivePaymentDialog(true)}>
                  <DollarSign className="mr-2 h-4 w-4" />
                  Receive Payment
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowAddPledgeDialog(true)}>
                  <HandCoins className="mr-2 h-4 w-4" />
                  Add Pledge
                </DropdownMenuItem>
              </>
            ) : null}
            {!isEntity ? (
              <DropdownMenuItem onClick={() => setShowMergeDialog(true)}>
                <GitMerge className="mr-2 h-4 w-4" />
                Merge duplicate
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-red-600 focus:text-red-600"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Phone className="h-3.5 w-3.5 shrink-0" />
          {contact.phone ? (
            <a href={`tel:${contact.phone}`} className="text-foreground hover:underline">
              {contact.phone}
            </a>
          ) : (
            <span>—</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <Mail className="h-3.5 w-3.5 shrink-0" />
          {contact.email ? (
            <a href={`mailto:${contact.email}`} className="text-foreground hover:underline">
              {contact.email}
            </a>
          ) : (
            <span>—</span>
          )}
        </div>
      </div>
    </div>
  )

  const moduleTabs =
    (showParticipationTab || showWorkforceTab) &&
    (activeTab === "participation" || activeTab === "workforce" || activeTab === "home") ? (
      <Tabs value={activeTab === "home" ? "home" : activeTab} onValueChange={handleTabChange}>
        <TabsList className="flex h-auto flex-wrap justify-start gap-1">
          <TabsTrigger value="home" className="gap-2">
            <User className="size-4" />
            Summary
          </TabsTrigger>
          {showParticipationTab ? (
            <TabsTrigger value="participation" className="gap-2">
              <Users className="size-4" />
              Participation
            </TabsTrigger>
          ) : null}
          {showWorkforceTab ? (
            <TabsTrigger value="workforce" className="gap-2">
              <Briefcase className="size-4" />
              Workforce
            </TabsTrigger>
          ) : null}
        </TabsList>
      </Tabs>
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

      {!showStickyInFinancialPanel ? (
        <div
          className={cn(
            "sticky z-40 -mx-6 space-y-4 border-b border-border bg-background px-6 pb-4 pt-1",
            stickyTopClass
          )}
        >
          {identityHeader}
        </div>
      ) : null}

      {!showStickyInFinancialPanel ? moduleTabs : null}

      {activeTab === "home" ? (
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

          {(() => {
            const overviewSection = (
              <ContactProfileCollapsibleSection
                id="contact-section-overview"
                title="Overview"
                open={overviewOpen}
                onOpenChange={setOverviewOpen}
              >
                <div className="space-y-6">
                  <ContactBasicsPanel
                    contact={contact}
                    personDetails={profileExtendedData?.personDetails ?? null}
                    defaultEditing={isEditMode}
                    onEditingChange={setContactEditMode}
                    onSaved={onContactUpdated}
                    layout="overview-general"
                    showEditButton
                  />
                  {!isEntity ? (
                    profileExtendedLoading ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading family members...
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <h4 className="text-sm font-semibold">Family</h4>
                        <ContactFamilyPanel
                          contactId={contact.id}
                          familyMembers={profileExtendedData?.familyMembers ?? []}
                          onChanged={onExtendedDataChanged}
                          embedded
                        />
                      </div>
                    )
                  ) : null}
                </div>
              </ContactProfileCollapsibleSection>
            )

            const notesActivitySection = (
              <ContactProfileCollapsibleSection
                id="contact-section-activity"
                title="Notes & Activity"
                open={notesActivityOpen}
                onOpenChange={setNotesActivityOpen}
              >
                <div className="space-y-6">
                  {!isEntity && modules.applications ? (
                    <ContactApplicationsPanel contactId={contact.id} />
                  ) : null}
                  <ContactTimelinePanel
                    items={profileData?.timeline ?? []}
                    loading={profileLoading}
                  />
                  <ContactNotesPanel
                    contactId={contact.id}
                    notes={profileData?.notes ?? []}
                    loading={profileLoading}
                    onNotesChanged={onNotesChanged}
                  />
                </div>
              </ContactProfileCollapsibleSection>
            )

            if (showFinancialHome) {
              return (
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
                  stickyHeader={identityHeader}
                  stickyTopClass={stickyTopClass}
                  belowSticky={moduleTabs}
                  leadingContent={overviewSection}
                  trailingContent={notesActivitySection}
                  refreshToken={financialRefreshToken}
                />
              )
            }

            return (
              <div className="space-y-3">
                {overviewSection}
                {notesActivitySection}
              </div>
            )
          })()}
        </div>
      ) : null}

      {activeTab === "participation" && showParticipationTab ? (
        <div className="space-y-6">
          {modules.membership ? (
            <ContactMembershipPanel
              contactId={contact.id}
              contactName={contact.full_name || "Unnamed Contact"}
              teamsCount={profileData?.activeTeamsCount ?? 0}
              onMembershipChanged={onRolesUpdated}
            />
          ) : null}
          {modules.programs ? (
            <ContactProgramEnrollmentsPanel
              enrollments={profileData?.enrollmentRecords ?? []}
              loading={profileLoading}
            />
          ) : null}
          {showProgramAssignments &&
            (assignmentsLoading ? (
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
            ))}
        </div>
      ) : null}

      {activeTab === "workforce" && showWorkforceTab ? (
        <div className="space-y-6">
          {modules.workforce && staffRecordId ? (
            <ContactEmployeePanel
              staffId={staffRecordId}
              organizationId={organizationId}
              contactRoles={roles}
            />
          ) : modules.workforce && hasRole("employee") ? (
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground">
                This contact has an employee role but no linked staff record yet.
                Link or create a staff record from Workforce → Employees.
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

          {!staffRecordId &&
          !hasRole("employee") &&
          !hasRole("volunteer") &&
          !hasRole("vendor") &&
          !hasRole("service_provider") &&
          !hasRole("childcare_provider") ? (
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground">
                No workforce roles yet. Roles are added automatically from volunteer
                roster, staff records, vendor applications, and related activity.
              </CardContent>
            </Card>
          ) : null}
        </div>
      ) : null}

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

      {modules.donations ? (
        <>
          <ContactReceivePaymentDialog
            open={showReceivePaymentDialog}
            onOpenChange={setShowReceivePaymentDialog}
            contactId={contact.id}
            contactName={contact.full_name || "Unnamed Contact"}
            organizationId={organizationId}
            onSuccess={() => {
              void handleDonationDialogSuccess()
            }}
          />
          <ContactAddPledgeDialog
            open={showAddPledgeDialog}
            onOpenChange={setShowAddPledgeDialog}
            contactId={contact.id}
            contactName={contact.full_name || "Unnamed Contact"}
            organizationId={organizationId}
            onSuccess={() => {
              void handleDonationDialogSuccess()
            }}
          />
        </>
      ) : null}

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
            <Button variant="destructive" onClick={handleDeleteContact} disabled={deleting}>
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
