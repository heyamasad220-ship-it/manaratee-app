"use client"



import { useCallback, useEffect, useMemo, useState } from "react"

import { useParams, useRouter } from "next/navigation"

import { Header } from "@/components/layout/header"

import { Card, CardContent } from "@/components/ui/card"

import { Button } from "@/components/ui/button"

import {

  ContactProfileClient,

  fetchStaffSummaryForContact,

} from "@/components/contacts/contact-profile-client"

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

import { refreshContactAffiliations } from "@/lib/contacts/contact-affiliation-sync"

import { loadContactProgramAssignments } from "@/lib/programs/program-staff-assignment-actions"
import { canHaveProgramStaffAssignments } from "@/lib/hr/staff-role-utils"
import type { StaffSummaryForContact } from "@/lib/hr/staff-summary"

import type { ProgramStaffAssignmentWithDetails } from "@/lib/programs/program-staff-assignment-types"

import { ArrowLeft, Loader2 } from "lucide-react"



function isMissingColumnError(error: { code?: string; message?: string } | null) {

  if (!error) return false

  if (error.code === "42703" || error.code === "PGRST204") return true

  const message = error.message?.toLowerCase() || ""

  return message.includes("does not exist") || message.includes("could not find")

}



const CONTACT_DETAIL_SELECT_PLANS = [

  `

    id,

    person_id,

    full_name,

    primary_contact_name,

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

    contact_roles(role, is_manual)

  `,

  `

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

  `,

  `

    id,

    full_name,

    email,

    phone,

    contact_type,

    status,

    created_at,

    contact_roles(role)

  `,

] as const



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

  const [staffRecordId, setStaffRecordId] = useState<string | null>(null)
  const [staffSummary, setStaffSummary] = useState<StaffSummaryForContact | null>(null)

  const [organizationId, setOrganizationId] = useState<string | null>(null)

  const [enabledModuleSlugs, setEnabledModuleSlugs] = useState<string[]>([])

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



    const orgId = await getCurrentOrganizationId()

    if (!orgId) {

      setContact(null)

      setProfileData(null)

      setStaffRecordId(null)
      setStaffSummary(null)

      setOrganizationId(null)

      setEnabledModuleSlugs([])

      setErrorMessage("No organization selected.")

      setLoading(false)

      setProfileLoading(false)

      return

    }



    let data: any = null

    let lastError: { message?: string; code?: string } | null = null

    try {
      await refreshContactAffiliations(contactId)
    } catch (syncError) {
      console.warn("Contact affiliation sync failed:", syncError)
    }

    for (const select of CONTACT_DETAIL_SELECT_PLANS) {

      const result = await supabase

        .from("contacts")

        .select(select.replace(/\s+/g, " ").trim())

        .eq("organization_id", orgId)

        .eq("id", contactId)

        .maybeSingle()



      if (!result.error && result.data) {

        data = result.data

        lastError = null

        break

      }



      lastError = result.error

      if (!isMissingColumnError(result.error)) {

        break

      }

    }



    if (!data) {

      console.error(

        "Error loading contact:",

        lastError?.message || lastError?.code || "Contact not found"

      )

      setContact(null)

      setProfileData(null)

      setStaffRecordId(null)
      setStaffSummary(null)

      setErrorMessage(lastError?.message || "This contact could not be found.")

      setLoading(false)

      setProfileLoading(false)

      return

    }



    setContact(data)
    setOrganizationId(orgId)

    try {
      const modulesResponse = await fetch("/api/organizations/sidebar-modules")
      if (modulesResponse.ok) {
        const modulesPayload = (await modulesResponse.json()) as {
          modules?: Array<{ slug?: string | null }>
        }
        setEnabledModuleSlugs(
          (modulesPayload.modules ?? [])
            .map((module) => module.slug?.trim())
            .filter(Boolean) as string[]
        )
      } else {
        setEnabledModuleSlugs([])
      }
    } catch (modulesError) {
      console.warn("Could not load organization modules for contact profile:", modulesError)
      setEnabledModuleSlugs([])
    }

    const roles = filterContactRoles(

      ((data.contact_roles || []) as any[]).map((role) => role.role).filter(Boolean)

    )

    await loadProfileData(data, roles)



    const staffSummaryResult = await fetchStaffSummaryForContact(supabase, orgId, contactId)
    setStaffSummary(staffSummaryResult)
    setStaffRecordId(staffSummaryResult?.id ?? null)



    const isStaffEligible = staffSummaryResult
      ? canHaveProgramStaffAssignments({
          staffType: staffSummaryResult.staffType,
          hrJobRoleName: staffSummaryResult.hrJobRoleName,
          contactRoles: roles,
        })
      : canHaveProgramStaffAssignments({ contactRoles: roles })



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



  const handleNotesChanged = useCallback(async () => {

    if (!contact) return

    await loadProfileData(contact, roles)

  }, [contact, loadProfileData, roles])



  const handleRolesUpdated = useCallback(async () => {

    await loadContact()

  }, [loadContact])



  const handleContactUpdated = useCallback(async () => {

    router.push("/contacts")

  }, [router])



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

      <ContactProfileClient

        contact={contact}

        profileData={profileData}

        profileLoading={profileLoading}

        programAssignments={programAssignments}

        assignmentsLoading={assignmentsLoading}

        staffRecordId={staffRecordId}
        staffSummary={staffSummary}
        organizationId={organizationId}
        enabledModuleSlugs={enabledModuleSlugs}
        onNotesChanged={handleNotesChanged}

        onRolesUpdated={handleRolesUpdated}
        onContactUpdated={handleContactUpdated}
      />

    </>

  )

}

