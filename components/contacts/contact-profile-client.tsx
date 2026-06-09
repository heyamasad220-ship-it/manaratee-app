"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ContactBasicsPanel } from "@/components/contacts/contact-basics-panel"
import { ContactEmployeePanel } from "@/components/contacts/contact-employee-panel"
import { ContactDonorPanel } from "@/components/contacts/contact-donor-panel"
import { ContactRentalsPanel } from "@/components/contacts/contact-rentals-panel"
import { ContactMembershipPanel } from "@/components/contacts/contact-membership-panel"
import { ContactProgramEnrollmentsPanel } from "@/components/contacts/contact-program-enrollments-panel"
import { ContactNotesPanel } from "@/components/contacts/contact-notes-panel"
import { ContactRelationshipSummaryCard } from "@/components/contacts/contact-relationship-summary"
import { ContactRolesCard } from "@/components/contacts/contact-roles-card"
import { ContactTimelinePanel } from "@/components/contacts/contact-timeline-panel"
import { ContactVolunteerDetails } from "@/components/contacts/contact-volunteer-details"
import { ContactVolunteerPanel } from "@/components/contacts/contact-volunteer-panel"
import { WorkforceCredentialsPanel } from "@/components/workforce/workforce-credentials-panel"
import { ContactProgramAssignmentsPanel } from "@/components/contacts/contact-program-assignments-panel"
import { ContactApplicationsPanel } from "@/components/contacts/contact-applications-panel"
import { PersonTagsCard } from "@/components/people/person-tags-card"
import { createClient } from "@/lib/supabase/client"
import {
  type ContactRoleValue,
  filterContactRoles,
  getAllowedRolesForRecordType,
} from "@/lib/contacts/contact-constants"
import type { ContactProfileData } from "@/lib/contacts/contact-profile-data"
import type { ProgramStaffAssignmentWithDetails } from "@/lib/programs/program-staff-assignment-types"
import { canHaveProgramStaffAssignments } from "@/lib/hr/staff-role-utils"
import type { StaffSummaryForContact } from "@/lib/hr/staff-summary"
import {
  ArrowLeft,
  Briefcase,
  Building2,
  Calendar,
  Heart,
  History,
  Loader2,
  Mail,
  Phone,
  Store,
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
  profileLoading: boolean
  programAssignments: ProgramStaffAssignmentWithDetails[]
  assignmentsLoading: boolean
  staffRecordId: string | null
  staffSummary: StaffSummaryForContact | null
  organizationId: string | null
  onNotesChanged: () => Promise<void>
  onRolesUpdated: () => Promise<void>
  onContactUpdated: () => Promise<void>
}

export function ContactProfileClient({
  contact,
  profileData,
  profileLoading,
  programAssignments,
  assignmentsLoading,
  staffRecordId,
  staffSummary,
  organizationId,
  onNotesChanged,
  onRolesUpdated,
  onContactUpdated,
}: ContactProfileClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const tabParam = searchParams.get("tab")

  const roles = useMemo(() => {
    const filtered = filterContactRoles(
      ((contact?.contact_roles || []) as any[]).map((role) => role.role).filter(Boolean)
    )
    if (contact?.contact_type === "organization") {
      return filtered.filter((role) =>
        getAllowedRolesForRecordType("organization").includes(role)
      )
    }
    return filtered
  }, [contact])

  const roleRows = useMemo(() => {
    return ((contact?.contact_roles || []) as any[])
      .map((row) => ({
        role: row.role as ContactRoleValue,
        is_manual: row.is_manual === true,
      }))
      .filter((row) => Boolean(row.role))
  }, [contact])

  const hasRole = useCallback(
    (roleName: ContactRoleValue) => roles.includes(roleName),
    [roles]
  )

  const isOrganization = contact.contact_type === "organization"

  const showDonorPanel = useMemo(() => {
    if (hasRole("donor")) return true
    if (!profileData) return false
    return (
      profileData.donorStats.donationCount > 0 ||
      profileData.donorStats.totalDonated > 0 ||
      profileData.donorStats.pledgeCount > 0
    )
  }, [hasRole, profileData])

  const showRentalsPanel = useMemo(() => {
    if (!profileData) return isOrganization
    return isOrganization || profileData.rentalStats.rentalCount > 0
  }, [isOrganization, profileData])

  const showParticipationTab = !isOrganization

  const showProgramAssignments = useMemo(() => {
    if (programAssignments.length > 0) return true
    return canHaveProgramStaffAssignments({
      staffType: staffSummary?.staffType,
      hrJobRoleName: staffSummary?.hrJobRoleName,
      contactRoles: roles,
    })
  }, [programAssignments.length, roles, staffSummary])

  const availableTabs = useMemo(() => {
    const tabs: ContactTab[] = ["overview"]
    if (showParticipationTab) tabs.push("participation")
    tabs.push("workforce")
    tabs.push("financial")
    tabs.push("activity")
    return tabs
  }, [showParticipationTab])

  const [activeTab, setActiveTab] = useState<ContactTab>(
    normalizeTab(tabParam, availableTabs)
  )

  useEffect(() => {
    setActiveTab(normalizeTab(tabParam, availableTabs))
  }, [tabParam, availableTabs])

  function handleTabChange(value: string) {
    const tab = normalizeTab(value, availableTabs)
    setActiveTab(tab)
    router.replace(`/contacts/${contact.id}?tab=${tab}`, { scroll: false })
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex justify-end">
        <Button variant="outline" onClick={() => router.push("/contacts")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Contacts
        </Button>
      </div>

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
          <TabsTrigger value="workforce" className="gap-2">
            <Briefcase className="size-4" />
            Workforce
          </TabsTrigger>
          <TabsTrigger value="financial" className="gap-2">
            <Heart className="size-4" />
            Financial
          </TabsTrigger>
          <TabsTrigger value="activity" className="gap-2">
            <History className="size-4" />
            Activity
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-0 space-y-6">
          <div className="flex items-center gap-2">
            {isOrganization ? (
              <Building2 className="h-6 w-6 text-muted-foreground" />
            ) : (
              <User className="h-6 w-6 text-muted-foreground" />
            )}
            <div>
              <h1 className="text-2xl font-bold">{contact.full_name || "Unnamed Contact"}</h1>
              <p className="text-sm text-muted-foreground capitalize">
                {formatText(contact.contact_type)}
              </p>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
            <ContactBasicsPanel contact={contact} onSaved={onContactUpdated} />

            <div className="flex flex-col gap-6">
              <ContactRolesCard
                contactId={contact.id}
                roles={roles}
                roleRows={roleRows}
                contactType={isOrganization ? "organization" : "individual"}
                contactInfo={{
                  fullName: contact.full_name || "Unnamed Contact",
                  email: contact.email,
                  phone: contact.phone,
                }}
                onRolesUpdated={onRolesUpdated}
              />

              {!isOrganization ? (
                <PersonTagsCard contactId={contact.id} personId={contact.person_id} />
              ) : null}
            </div>
          </div>
        </TabsContent>

        {showParticipationTab ? (
          <TabsContent value="participation" className="mt-0 space-y-6">
            <ContactMembershipPanel
              contactId={contact.id}
              contactName={contact.full_name || "Unnamed Contact"}
              teamsCount={profileData?.activeTeamsCount ?? 0}
              onMembershipChanged={onRolesUpdated}
            />
            <ContactProgramEnrollmentsPanel
              enrollments={profileData?.enrollmentRecords ?? []}
              loading={profileLoading}
            />
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

        <TabsContent value="workforce" className="mt-0 space-y-6">
          {staffRecordId ? (
            <ContactEmployeePanel
              staffId={staffRecordId}
              organizationId={organizationId}
              contactRoles={roles}
            />
          ) : hasRole("employee") ? (
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground">
                This contact has an employee affiliation but no linked staff record yet.
                Link or create a staff record from Workforce → Employees.
              </CardContent>
            </Card>
          ) : null}

          {hasRole("volunteer") ? (
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

          {(hasRole("volunteer") ||
            hasRole("employee") ||
            hasRole("childcare_provider") ||
            staffRecordId) && <WorkforceCredentialsPanel contactId={contact.id} />}

          {hasRole("vendor") ? (
            <Card>
              <CardContent className="p-6">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Store className="h-5 w-5 text-amber-600" />
                    <h2 className="text-lg font-semibold">Vendor</h2>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/vendor-hub/vendors">Vendor Hub</Link>
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Booth assignments and vendor participation are managed in Vendor Hub.
                </p>
              </CardContent>
            </Card>
          ) : null}

          {hasRole("service_provider") ? (
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
                No workforce affiliations yet. Add roles on the Overview tab or approve
                applications to unlock workforce sections here.
              </CardContent>
            </Card>
          ) : null}
        </TabsContent>

        <TabsContent value="financial" className="mt-0 space-y-6">
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
              showPanel={isOrganization ? !profileLoading : showDonorPanel}
              title={isOrganization ? "Donations" : "Donor Details"}
            />
            <ContactRentalsPanel
              rentalStats={
                profileData?.rentalStats ?? {
                  rentalCount: 0,
                  lastRentalDate: null,
                }
              }
              rentals={profileData?.rentalRecords ?? []}
              showPanel={isOrganization ? !profileLoading : showRentalsPanel && !profileLoading}
            />
            {!showDonorPanel && !isOrganization && !profileLoading ? (
              <Card>
                <CardContent className="p-6 text-sm text-muted-foreground">
                  No donation history for this contact.
                </CardContent>
              </Card>
            ) : null}
            {!showRentalsPanel && !isOrganization && !profileLoading ? (
              <Card>
                <CardContent className="p-6 text-sm text-muted-foreground">
                  No venue rental history for this contact.
                </CardContent>
              </Card>
            ) : null}
          </TabsContent>

        <TabsContent value="activity" className="mt-0 space-y-6">
          <ContactRelationshipSummaryCard
            summary={profileData?.summary ?? null}
            activity={profileData?.activity ?? null}
            loading={profileLoading}
            hideTeams={isOrganization}
          />
          {!isOrganization ? <ContactApplicationsPanel contactId={contact.id} /> : null}
          <ContactTimelinePanel items={profileData?.timeline ?? []} loading={profileLoading} />
          <ContactNotesPanel
            contactId={contact.id}
            notes={profileData?.notes ?? []}
            loading={profileLoading}
            onNotesChanged={onNotesChanged}
          />
        </TabsContent>
      </Tabs>
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
