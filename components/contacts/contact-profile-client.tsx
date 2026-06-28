"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ContactMergeDialog } from "@/components/contacts/contact-merge-dialog"
import { ContactBasicsPanel, type ContactBasicsHeaderMeta } from "@/components/contacts/contact-basics-panel"
import { ContactOverviewGroupsBar } from "@/components/contacts/contact-overview-groups-bar"
import { ContactFamilyPanel } from "@/components/contacts/contact-family-panel"
import { ContactPaymentMethodsPanel } from "@/components/contacts/contact-payment-methods-panel"
import { ContactEmployeePanel } from "@/components/contacts/contact-employee-panel"
import { ContactDonorFinancialPanel } from "@/components/contacts/contact-donor-financial-panel"
import { ContactGroupFinancialPanel } from "@/components/contacts/contact-group-financial-panel"
import { ContactGroupMembersPanel } from "@/components/contacts/contact-group-members-panel"
import { ContactDonorPanel } from "@/components/contacts/contact-donor-panel"
import { ContactRentalsPanel } from "@/components/contacts/contact-rentals-panel"
import { ContactMembershipPanel } from "@/components/contacts/contact-membership-panel"
import { ContactProgramEnrollmentsPanel } from "@/components/contacts/contact-program-enrollments-panel"
import { ContactNotesPanel } from "@/components/contacts/contact-notes-panel"
import { ContactRelationshipSummaryCard } from "@/components/contacts/contact-relationship-summary"
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
  STATUS_COLORS,
  STATUS_OPTIONS,
  type ContactRecordType,
} from "@/lib/contacts/contact-constants"
import type { ContactProfileData } from "@/lib/contacts/contact-profile-data"
import type { ContactProfileExtendedData } from "@/lib/contacts/contact-profile-admin-actions"
import type { ProgramStaffAssignmentWithDetails } from "@/lib/programs/program-staff-assignment-types"
import { canHaveProgramStaffAssignments } from "@/lib/hr/staff-role-utils"
import type { StaffSummaryForContact } from "@/lib/hr/staff-summary"
import { getContactProfileModuleFlags } from "@/lib/contacts/contact-profile-module-access"
import {
  contactsListSegmentForRecordType,
  getContactsListLabelForSegment,
  getContactsListPathForSegment,
  isContactsListSegment,
  type ContactsListSegment,
} from "@/lib/contacts/contact-module-label"
import { contactProfileHref } from "@/lib/contacts/contact-profile-path"
import {
  ArrowLeft,
  Briefcase,
  Building2,
  Calendar,
  GitMerge,
  Heart,
  History,
  Loader2,
  Mail,
  Pencil,
  Phone,
  Store,
  Trash2,
  User,
  Users,
  Wrench,
} from "lucide-react"

const CONTACT_TABS = [
  "overview",
  "participation",
  "workforce",
  "financial",
  "activity",
] as const

type ContactTab = (typeof CONTACT_TABS)[number]

function formatText(value: string | null | undefined) {
  if (!value) return "-"
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c: string) => c.toUpperCase())
}

function formatDate(value: string | null | undefined) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleDateString()
}

function normalizeTab(value: string | null, available: ContactTab[]): ContactTab {
  if (value && available.includes(value as ContactTab)) {
    return value as ContactTab
  }
  return "overview"
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

  const backPath = getContactsListPathForSegment(profileListSegment)
  const backLabel = `Back to ${getContactsListLabelForSegment(profileListSegment)}`

  const profileHrefOptions = useMemo(
    () => ({ list: profileListSegment }),
    [profileListSegment]
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

  const showRentalsPanel = useMemo(() => {
    if (!modules.bookings) return false
    if (isEntity) return true
    if (!profileData) return false
    return profileData.rentalStats.rentalCount > 0
  }, [isEntity, modules.bookings, profileData])

  const showParticipationTab =
    !isEntity && (modules.programs || modules.membership)

  const showWorkforceTab = modules.workforce || modules.vendorHub

  const showFinancialTab = modules.donations || modules.bookings

  const showProgramAssignments = useMemo(() => {
    if (!modules.programs) return false
    if (programAssignments.length > 0) return true
    return canHaveProgramStaffAssignments({
      staffType: staffSummary?.staffType,
      hrJobRoleName: staffSummary?.hrJobRoleName,
      contactRoles: roles,
    })
  }, [modules.programs, programAssignments.length, roles, staffSummary])

  const availableTabs = useMemo(() => {
    const tabs: ContactTab[] = ["overview"]
    if (showParticipationTab) tabs.push("participation")
    if (showWorkforceTab) tabs.push("workforce")
    if (showFinancialTab) tabs.push("financial")
    tabs.push("activity")
    return tabs
  }, [showFinancialTab, showParticipationTab, showWorkforceTab])

  const [activeTab, setActiveTab] = useState<ContactTab>(() =>
    normalizeTab(tabParam, availableTabs)
  )
  const [showMergeDialog, setShowMergeDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [overviewSubTab, setOverviewSubTab] = useState<"general" | "family">("general")
  const [basicsHeaderMeta, setBasicsHeaderMeta] = useState<ContactBasicsHeaderMeta | null>(
    null
  )

  const handleBasicsHeaderMetaChange = useCallback((meta: ContactBasicsHeaderMeta) => {
    setBasicsHeaderMeta(meta)
  }, [])

  useEffect(() => {
    if (tabParam) {
      setActiveTab(normalizeTab(tabParam, availableTabs))
      return
    }

    setActiveTab((current) => (availableTabs.includes(current) ? current : "overview"))
  }, [tabParam, availableTabs])

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

    const tab = normalizeTab(tabParam, availableTabs)
    router.replace(
      contactProfileHref(contact.id, {
        ...profileHrefOptions,
        tab: tab === "overview" ? undefined : tab,
        edit: isEditMode,
      }),
      { scroll: false }
    )
  }, [
    availableTabs,
    contact.id,
    isDialog,
    isEditMode,
    profileHrefOptions,
    recordType,
    router,
    searchParams,
    tabParam,
  ])

  function setContactEditMode(edit: boolean) {
    if (edit) {
      setActiveTab("overview")
      setOverviewSubTab("general")
    }

    if (isDialog) {
      setDialogEditMode(edit)
      return
    }

    const tab = normalizeTab(tabParam, availableTabs)
    router.replace(
      contactProfileHref(contact.id, {
        ...profileHrefOptions,
        tab: tab === "overview" ? undefined : tab,
        edit,
      }),
      { scroll: false }
    )
  }

  function handleTabChange(value: string) {
    const tab = normalizeTab(value, availableTabs)
    setActiveTab(tab)
    if (isDialog) {
      if (dialogEditMode) {
        setDialogEditMode(false)
      }
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

  return (
    <div className={isDialog ? "flex flex-col gap-6 p-4 sm:p-6" : "flex flex-col gap-6 p-6"}>
      {!isDialog ? (
        <div className="flex justify-start">
          <Button variant="outline" onClick={() => router.push(backPath)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {backLabel}
          </Button>
        </div>
      ) : onClose ? (
        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      ) : null}

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList className="flex h-auto flex-wrap justify-start gap-1">
          <TabsTrigger value="overview" className="gap-2">
            <User className="size-4" />
            Overview
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
          {showFinancialTab ? (
            <TabsTrigger value="financial" className="gap-2">
              <Heart className="size-4" />
              Financial
            </TabsTrigger>
          ) : null}
          <TabsTrigger value="activity" className="gap-2">
            <History className="size-4" />
            Activity
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-0 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                {isOrganization ? (
                  <Building2 className="h-5 w-5 shrink-0 text-muted-foreground" />
                ) : isGroup ? (
                  <Users className="h-5 w-5 shrink-0 text-muted-foreground" />
                ) : (
                  <User className="h-5 w-5 shrink-0 text-muted-foreground" />
                )}
                <h1 className="text-xl font-semibold">{contact.full_name || "Unnamed Contact"}</h1>
                {isEditMode && basicsHeaderMeta ? (
                  <>
                    <Select
                      value={basicsHeaderMeta.contactType}
                      onValueChange={(value) =>
                        basicsHeaderMeta.setContactType(value as ContactRecordType)
                      }
                    >
                      <SelectTrigger className="h-7 w-[7.5rem] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="individual">Person</SelectItem>
                        <SelectItem value="organization">Organization</SelectItem>
                        <SelectItem value="group">Group</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select
                      value={basicsHeaderMeta.status}
                      onValueChange={basicsHeaderMeta.setStatus}
                    >
                      <SelectTrigger className="h-7 w-[6.5rem] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </>
                ) : (
                  <>
                    <Badge variant="outline" className="font-normal">
                      {getContactRecordTypeLabel(recordType)}
                    </Badge>
                    <Badge
                      variant="secondary"
                      className={STATUS_COLORS[mapStatus(contact.status)]}
                    >
                      {mapStatus(contact.status)}
                    </Badge>
                  </>
                )}
                {!isEntity ? <ContactOverviewGroupsBar contactId={contact.id} /> : null}
              </div>
            </div>
            {!isEditMode ? (
              <div className="flex flex-wrap gap-2">
                {!isEntity ? (
                  <Button variant="outline" size="sm" onClick={() => setShowMergeDialog(true)}>
                    <GitMerge className="mr-2 h-4 w-4" />
                    Merge duplicate
                  </Button>
                ) : null}
                <Button variant="outline" size="sm" onClick={() => setContactEditMode(true)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit contact
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-600 hover:text-red-600"
                  onClick={() => setShowDeleteDialog(true)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              </div>
            ) : null}
          </div>

          {!isEntity ? (
            <Tabs
              value={overviewSubTab}
              onValueChange={(value) => setOverviewSubTab(value as "general" | "family")}
              className="space-y-3"
            >
              <TabsList className="h-8">
                <TabsTrigger value="general" className="px-3 text-xs">
                  General
                </TabsTrigger>
                <TabsTrigger value="family" className="px-3 text-xs">
                  Family
                </TabsTrigger>
              </TabsList>
              <TabsContent value="general" className="mt-0">
                <ContactBasicsPanel
                  contact={contact}
                  personDetails={profileExtendedData?.personDetails ?? null}
                  defaultEditing={isEditMode}
                  onEditingChange={setContactEditMode}
                  onSaved={onContactUpdated}
                  layout="overview-general"
                  showEditButton={false}
                  onHeaderMetaChange={handleBasicsHeaderMetaChange}
                />
              </TabsContent>
              <TabsContent value="family" className="mt-0">
                {profileExtendedLoading ? (
                  <Card>
                    <CardContent className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading family members...
                    </CardContent>
                  </Card>
                ) : (
                  <ContactFamilyPanel
                    contactId={contact.id}
                    familyMembers={profileExtendedData?.familyMembers ?? []}
                    onChanged={onExtendedDataChanged}
                    embedded
                  />
                )}
              </TabsContent>
            </Tabs>
          ) : (
            <ContactBasicsPanel
              contact={contact}
              personDetails={profileExtendedData?.personDetails ?? null}
              defaultEditing={isEditMode}
              onEditingChange={setContactEditMode}
              onSaved={onContactUpdated}
              layout="overview-general"
              showEditButton={false}
              onHeaderMetaChange={handleBasicsHeaderMetaChange}
            />
          )}

          {isGroup ? (
            <ContactGroupMembersPanel
              groupContactId={contact.id}
              groupName={contact.full_name || "Group"}
            />
          ) : null}
        </TabsContent>

        {showParticipationTab ? (
          <TabsContent value="participation" className="mt-0 space-y-6">
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
          </TabsContent>
        ) : null}

        {showWorkforceTab ? (
        <TabsContent value="workforce" className="mt-0 space-y-6">
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
        </TabsContent>
        ) : null}

        {showFinancialTab ? (
        <TabsContent value="financial" className="mt-0 space-y-6">
            {showDonorPanel && profileData?.donorId && !profileLoading ? (
              isGroup ? (
                <ContactGroupFinancialPanel
                  groupContactId={contact.id}
                  donorId={profileData.donorId}
                  groupName={contact.full_name || "Group"}
                />
              ) : (
                <ContactDonorFinancialPanel
                  donorId={profileData.donorId}
                  donorName={contact.full_name || "Donor"}
                  contactId={contact.id}
                  paymentMethods={profileExtendedData?.paymentMethods ?? []}
                  paymentMethodsLoading={profileExtendedLoading}
                  showPaymentMethods
                />
              )
            ) : (
              <ContactDonorPanel
                donorStats={
                  profileData?.donorStats ?? {
                    totalDonated: 0,
                    donationCount: 0,
                    lastDonationDate: null,
                    pledgeCount: 0,
                  }
                }
                donations={profileData?.donationRecords ?? []}
                showPanel={showDonorPanel && !profileLoading}
                title={isGroup ? "Group Giving" : isOrganization ? "Donations" : "Donor Details"}
              />
            )}
            <ContactRentalsPanel
              rentalStats={
                profileData?.rentalStats ?? {
                  rentalCount: 0,
                  lastRentalDate: null,
                }
              }
              rentals={profileData?.rentalRecords ?? []}
              showPanel={showRentalsPanel && !profileLoading}
            />
            {!isGroup && !(showDonorPanel && profileData?.donorId) ? (
              profileExtendedLoading ? (
                <Card>
                  <CardContent className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading payment methods...
                  </CardContent>
                </Card>
              ) : (
                <div className="lg:ml-auto lg:max-w-sm">
                  <ContactPaymentMethodsPanel
                    contactId={contact.id}
                    paymentMethods={profileExtendedData?.paymentMethods ?? []}
                    compact
                  />
                </div>
              )
            ) : null}
            {!showDonorPanel && !showRentalsPanel && isGroup && !profileLoading ? (
              <Card>
                <CardContent className="p-6 text-sm text-muted-foreground">
                  No financial activity for this contact in enabled modules yet.
                </CardContent>
              </Card>
            ) : null}
          </TabsContent>
        ) : null}

        <TabsContent value="activity" className="mt-0 space-y-6">
          <ContactRelationshipSummaryCard
            contactId={contact.id}
            summary={profileData?.summary ?? null}
            activity={profileData?.activity ?? null}
            loading={profileLoading}
            hideTeams={isEntity}
          />
          {!isEntity && modules.applications ? (
            <ContactApplicationsPanel contactId={contact.id} />
          ) : null}
          <ContactTimelinePanel items={profileData?.timeline ?? []} loading={profileLoading} />
          <ContactNotesPanel
            contactId={contact.id}
            notes={profileData?.notes ?? []}
            loading={profileLoading}
            onNotesChanged={onNotesChanged}
          />
        </TabsContent>
      </Tabs>

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
