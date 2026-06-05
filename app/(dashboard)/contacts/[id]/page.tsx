"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Header } from "@/components/layout/header"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ContactDonorPanel } from "@/components/contacts/contact-donor-panel"
import { ContactMemberPanel } from "@/components/contacts/contact-member-panel"
import { ContactNotesPanel } from "@/components/contacts/contact-notes-panel"
import { ContactRelationshipSummaryCard } from "@/components/contacts/contact-relationship-summary"
import { ContactRolesCard } from "@/components/contacts/contact-roles-card"
import { ContactTimelinePanel } from "@/components/contacts/contact-timeline-panel"
import { ContactVolunteerDetails } from "@/components/contacts/contact-volunteer-details"
import { ContactVolunteerPanel } from "@/components/contacts/contact-volunteer-panel"
import { ContactProgramAssignmentsPanel } from "@/components/contacts/contact-program-assignments-panel"
import { ContactTeamsPanel } from "@/components/contacts/contact-teams-panel"
import { ContactApplicationsPanel } from "@/components/contacts/contact-applications-panel"
import { PersonTagsCard } from "@/components/people/person-tags-card"
import { createClient } from "@/lib/supabase/client"
import { getCurrentOrganizationId } from "@/lib/current-organization"
import {
  type ContactRoleValue,
  filterContactRoles,
} from "@/lib/contacts/contact-constants"
import {
  fetchContactProfileData,
  type ContactProfileData,
} from "@/lib/contacts/contact-profile-data"
import { loadContactProgramAssignments } from "@/lib/programs/program-staff-assignment-actions"
import type { ProgramStaffAssignmentWithDetails } from "@/lib/programs/program-staff-assignment-types"
import {
  ArrowLeft,
  Briefcase,
  Building2,
  Calendar,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Store,
  User,
  Wrench,
} from "lucide-react"

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

export default function ContactDetailPage() {
  const params = useParams()
  const router = useRouter()
  const contactId = params.id as string
  const supabase = useMemo(() => createClient(), [])

  const [contact, setContact] = useState<any>(null)
  const [profileData, setProfileData] = useState<ContactProfileData | null>(null)
  const [programAssignments, setProgramAssignments] = useState<
    ProgramStaffAssignmentWithDetails[]
  >([])
  const [assignmentsLoading, setAssignmentsLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState("")

  const loadProfileData = useCallback(
    async (contactRecord: any, roles: ContactRoleValue[]) => {
      setProfileLoading(true)
      try {
        const orgId = await getCurrentOrganizationId()
        if (!orgId) {
          setProfileData(null)
          return
        }

        const data = await fetchContactProfileData(supabase, orgId, {
          contactId,
          personId: contactRecord.person_id,
          email: contactRecord.email,
          roles,
          contactCreatedAt: contactRecord.created_at,
        })
        setProfileData(data)
      } catch (error) {
        console.error("Error loading contact profile data:", error)
        setProfileData(null)
      } finally {
        setProfileLoading(false)
      }
    },
    [contactId, supabase]
  )

  const loadContact = useCallback(async () => {
    setLoading(true)
    setErrorMessage("")

    const { data, error } = await supabase
      .from("contacts")
      .select(`
        id,
        person_id,
        full_name,
        email,
        phone,
        address,
        city,
        state,
        zip,
        country,
        contact_type,
        status,
        created_at,
        contact_roles(role)
      `)
      .eq("id", contactId)
      .single()

    if (error || !data) {
      console.error("Error loading contact:", error)
      setContact(null)
      setProfileData(null)
      setErrorMessage(error?.message || "This contact could not be found.")
      setLoading(false)
      setProfileLoading(false)
      return
    }

    setContact(data)

    const roles = filterContactRoles(
      ((data.contact_roles || []) as any[]).map((role) => role.role).filter(Boolean)
    )
    await loadProfileData(data, roles)

    const isStaffEligible =
      roles.includes("employee") || roles.includes("volunteer")

    if (isStaffEligible) {
      setAssignmentsLoading(true)
      try {
        const assignments = await loadContactProgramAssignments(contactId)
        setProgramAssignments(assignments)
      } catch (error) {
        console.error("Error loading program assignments:", error)
        setProgramAssignments([])
      } finally {
        setAssignmentsLoading(false)
      }
    } else {
      setProgramAssignments([])
    }

    setLoading(false)
  }, [contactId, loadProfileData, supabase])

  useEffect(() => {
    if (contactId) {
      void loadContact()
    }
  }, [contactId, loadContact])

  const roles = useMemo(() => {
    return filterContactRoles(
      ((contact?.contact_roles || []) as any[]).map((role) => role.role).filter(Boolean)
    )
  }, [contact])

  const hasRole = useCallback(
    (roleName: ContactRoleValue) => roles.includes(roleName),
    [roles]
  )

  const showDonorPanel = useMemo(() => {
    if (hasRole("donor")) return true
    if (!profileData) return false
    return (
      profileData.donorStats.donationCount > 0 ||
      profileData.donorStats.totalDonated > 0 ||
      profileData.donorStats.pledgeCount > 0
    )
  }, [hasRole, profileData])

  const fullAddress = useMemo(() => {
    if (!contact) return "-"
    return (
      [contact.address, contact.city, contact.state, contact.zip, contact.country]
        .filter(Boolean)
        .join(", ") || "-"
    )
  }, [contact])

  const handleNotesChanged = useCallback(async () => {
    if (!contact) return
    await loadProfileData(contact, roles)
  }, [contact, loadProfileData, roles])

  const handleRolesUpdated = useCallback(async () => {
    await loadContact()
  }, [loadContact])

  if (loading) {
    return (
      <>
        <Header title="Contact" />
        <div className="flex items-center gap-2 p-6 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading contact...
        </div>
      </>
    )
  }

  if (!contact) {
    return (
      <>
        <Header title="Contact Not Found" />
        <div className="p-6">
          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">
                {errorMessage || "This contact could not be found."}
              </p>
              <Button variant="outline" className="mt-4" onClick={() => router.push("/contacts")}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Contacts
              </Button>
            </CardContent>
          </Card>
        </div>
      </>
    )
  }

  return (
    <>
      <Header title={contact.full_name || "Contact"} />

      <div className="flex flex-col gap-6 p-6">
        {/* 1. Identity / Contact Info */}
        <Card>
          <CardContent className="flex flex-col gap-5 p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  {contact.contact_type === "organization" ? (
                    <Building2 className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <User className="h-5 w-5 text-muted-foreground" />
                  )}
                  <h1 className="text-2xl font-bold">{contact.full_name || "Unnamed Contact"}</h1>
                </div>
                <p className="mt-1 text-muted-foreground">{formatText(contact.contact_type)}</p>
              </div>

              <Button variant="outline" onClick={() => router.push("/contacts")}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Contacts
              </Button>
            </div>

            <div className="grid gap-4 text-sm md:grid-cols-2 lg:grid-cols-3">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="font-medium">Email</div>
                  <div className="text-muted-foreground">{contact.email || "-"}</div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="font-medium">Phone</div>
                  <div className="text-muted-foreground">{contact.phone || "-"}</div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="font-medium">Created</div>
                  <div className="text-muted-foreground">{formatDate(contact.created_at)}</div>
                </div>
              </div>

              <div>
                <div className="font-medium">Status</div>
                <div className="text-muted-foreground">{formatText(contact.status)}</div>
              </div>

              <div className="md:col-span-2">
                <div className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="font-medium">Address</div>
                    <div className="text-muted-foreground">{fullAddress}</div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 2. Relationship Summary */}
        <ContactRelationshipSummaryCard
          summary={profileData?.summary ?? null}
          activity={profileData?.activity ?? null}
          loading={profileLoading}
        />

        {/* 3. Affiliations */}
        <ContactRolesCard
          contactId={contact.id}
          roles={roles}
          contactInfo={{
            fullName: contact.full_name || "Unnamed Contact",
            email: contact.email,
            phone: contact.phone,
          }}
          onRolesUpdated={handleRolesUpdated}
        />

        {/* 4. Teams */}
        <ContactTeamsPanel
          contactId={contact.id}
          contactName={contact.full_name || "Unnamed Contact"}
        />

        {/* 5. Applications */}
        <ContactApplicationsPanel contactId={contact.id} />

        {/* 6. Role-specific detail sections */}
        {hasRole("member") && (
          <ContactMemberPanel
            contactStatus={contact.status}
            contactCreatedAt={contact.created_at}
            teamsCount={profileData?.activeTeamsCount ?? 0}
          />
        )}

        {hasRole("volunteer") && (
          <>
            <ContactVolunteerDetails contactId={contact.id} />
            <ContactVolunteerPanel
              contactId={contact.id}
              contactName={contact.full_name || "Unnamed Contact"}
              contactEmail={contact.email || ""}
              contactPhone={contact.phone || ""}
            />
          </>
        )}

        <ContactDonorPanel
          donorStats={
            profileData?.donorStats ?? {
              totalDonated: 0,
              donationCount: 0,
              lastDonationDate: null,
              pledgeCount: 0,
            }
          }
          showPanel={showDonorPanel}
        />

        {hasRole("employee") && (
          <Card>
            <CardContent className="p-6">
              <div className="mb-2 flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-sky-600" />
                <h2 className="text-lg font-semibold">Employee</h2>
              </div>
              <p className="text-sm text-muted-foreground">
                Employment details and HR records are managed separately. Program
                teaching assignments appear below.
              </p>
            </CardContent>
          </Card>
        )}

        {(hasRole("employee") || hasRole("volunteer")) &&
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

        {hasRole("vendor") && (
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
                Applications, booth assignments, and vendor participation appear in the activity
                summary and Vendor Hub.
              </p>
            </CardContent>
          </Card>
        )}

        {hasRole("service_provider") && (
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
        )}

        {/* 7. Eligibility Tags */}
        <PersonTagsCard contactId={contact.id} personId={contact.person_id} />

        {/* 8. Timeline */}
        <ContactTimelinePanel items={profileData?.timeline ?? []} loading={profileLoading} />

        {/* 9. Notes */}
        <ContactNotesPanel
          contactId={contact.id}
          notes={profileData?.notes ?? []}
          loading={profileLoading}
          onNotesChanged={handleNotesChanged}
        />
      </div>
    </>
  )
}
