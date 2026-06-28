"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

import {
  ContactProfileClient,
  fetchStaffSummaryForContact,
} from "@/components/contacts/contact-profile-client"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import {
  loadContactProfileExtendedData,
  type ContactProfileExtendedData,
} from "@/lib/contacts/contact-profile-admin-actions"
import { refreshContactAffiliations } from "@/lib/contacts/contact-affiliation-sync"
import { loadContactProgramAssignments } from "@/lib/programs/program-staff-assignment-actions"
import { canHaveProgramStaffAssignments } from "@/lib/hr/staff-role-utils"
import type { StaffSummaryForContact } from "@/lib/hr/staff-summary"
import type { ProgramStaffAssignmentWithDetails } from "@/lib/programs/program-staff-assignment-types"
import { Loader2 } from "lucide-react"

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
    notes,
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
    notes,
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

type ContactProfileDialogProps = {
  contactId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultEdit?: boolean
  onContactUpdated?: () => void
}

export function ContactProfileDialog({
  contactId,
  open,
  onOpenChange,
  defaultEdit = false,
  onContactUpdated,
}: ContactProfileDialogProps) {
  const supabase = useMemo(() => createClient(), [])
  const [contact, setContact] = useState<any>(null)
  const [profileData, setProfileData] = useState<ContactProfileData | null>(null)
  const [profileExtendedData, setProfileExtendedData] =
    useState<ContactProfileExtendedData | null>(null)
  const [programAssignments, setProgramAssignments] = useState<
    ProgramStaffAssignmentWithDetails[]
  >([])
  const [assignmentsLoading, setAssignmentsLoading] = useState(false)
  const [staffRecordId, setStaffRecordId] = useState<string | null>(null)
  const [staffSummary, setStaffSummary] = useState<StaffSummaryForContact | null>(null)
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [enabledModuleSlugs, setEnabledModuleSlugs] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileExtendedLoading, setProfileExtendedLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState("")

  const loadProfileData = useCallback(
    async (contactRecord: any, roles: ContactRoleValue[]) => {
      if (!contactId) return

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

  const loadExtendedData = useCallback(async () => {
    if (!contactId) return

    setProfileExtendedLoading(true)
    try {
      const data = await loadContactProfileExtendedData(contactId)
      setProfileExtendedData(data)
    } catch (error) {
      console.error("Error loading extended contact profile data:", error)
      setProfileExtendedData(null)
    } finally {
      setProfileExtendedLoading(false)
    }
  }, [contactId])

  const loadContact = useCallback(async () => {
    if (!contactId) return

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
    await loadExtendedData()

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
  }, [contactId, loadExtendedData, loadProfileData, supabase])

  useEffect(() => {
    if (open && contactId) {
      void loadContact()
    }
  }, [contactId, loadContact, open])

  useEffect(() => {
    if (!open) {
      setContact(null)
      setProfileData(null)
      setProfileExtendedData(null)
      setErrorMessage("")
    }
  }, [open])

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
    await loadContact()
    onContactUpdated?.()
  }, [loadContact, onContactUpdated])

  const handleExtendedDataChanged = useCallback(async () => {
    await loadExtendedData()
  }, [loadExtendedData])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] w-[min(96vw,72rem)] max-w-[72rem] flex-col gap-0 overflow-hidden p-0 sm:max-w-[72rem]">
        <DialogHeader className="shrink-0 border-b px-6 py-4">
          <DialogTitle>{contact?.full_name || "Contact profile"}</DialogTitle>
          <DialogDescription>
            View and edit contact details without leaving this page.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center gap-2 p-6 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading contact...
            </div>
          ) : !contact ? (
            <div className="p-6 text-sm text-muted-foreground">
              {errorMessage || "This contact could not be found."}
            </div>
          ) : (
            <ContactProfileClient
              contact={contact}
              profileData={profileData}
              profileExtendedData={profileExtendedData}
              profileExtendedLoading={profileExtendedLoading}
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
              onExtendedDataChanged={handleExtendedDataChanged}
              variant="dialog"
              defaultEdit={defaultEdit}
              onClose={() => onOpenChange(false)}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
