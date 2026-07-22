"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Loader2, Pencil, Plus, Trash2, UserRound } from "lucide-react"

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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  createProgramStaffAssignment,
  removeProgramStaffAssignment,
  searchProgramStaffContactsAction,
} from "@/lib/programs/program-staff-assignment-actions"
import type { StaffEligibleContact } from "@/lib/programs/program-staff-assignment-queries"
import {
  OFFERING_STAFF_ROLE_OPTIONS,
  PROGRAM_STAFF_ASSIGNMENT_ROLE_LABELS,
  type ProgramStaffAssignmentRole,
  type ProgramStaffAssignmentWithDetails,
} from "@/lib/programs/program-staff-assignment-types"
import type { ProgramOffering } from "@/lib/programs/program-offering-types"
import type { ProgramSession } from "@/lib/programs/program-session-types"

const ADDITIONAL_ROLES = OFFERING_STAFF_ROLE_OPTIONS.filter(
  (role) => role !== "primary_instructor"
)

/**
 * Compact staff controls for Offering Overview (view + edit).
 * Primary instructor is a core overview field; extra staff can be added while editing.
 */
export function OfferingOverviewStaffFields({
  programId,
  offering,
  assignments: initialAssignments,
  sessions,
  editing,
  onAssignmentsChange,
}: {
  programId: string
  offering: ProgramOffering
  assignments: ProgramStaffAssignmentWithDetails[]
  sessions: ProgramSession[]
  editing: boolean
  onAssignmentsChange?: (
    assignments: ProgramStaffAssignmentWithDetails[]
  ) => void
}) {
  const router = useRouter()
  const [assignments, setAssignments] = React.useState(initialAssignments)
  const [isDialogOpen, setIsDialogOpen] = React.useState(false)
  const [isSaving, setIsSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [contactSearch, setContactSearch] = React.useState("")
  const [contactResults, setContactResults] = React.useState<
    StaffEligibleContact[]
  >([])
  const [isSearching, setIsSearching] = React.useState(false)
  const [selectedContactId, setSelectedContactId] = React.useState("")
  const [assignmentRole, setAssignmentRole] =
    React.useState<ProgramStaffAssignmentRole>("primary_instructor")
  const [sessionId, setSessionId] = React.useState("")

  React.useEffect(() => {
    setAssignments(initialAssignments)
  }, [initialAssignments])

  React.useEffect(() => {
    if (!isDialogOpen) return
    const timeout = window.setTimeout(() => {
      void loadContacts(contactSearch)
    }, 250)
    return () => window.clearTimeout(timeout)
  }, [contactSearch, isDialogOpen])

  async function loadContacts(search: string) {
    setIsSearching(true)
    try {
      setContactResults(await searchProgramStaffContactsAction(search))
    } catch (searchError) {
      setError(
        searchError instanceof Error
          ? searchError.message
          : "Failed to search contacts."
      )
    } finally {
      setIsSearching(false)
    }
  }

  function openDialog(role: ProgramStaffAssignmentRole) {
    setAssignmentRole(role)
    setSelectedContactId("")
    setSessionId("")
    setContactSearch("")
    setError(null)
    setIsDialogOpen(true)
  }

  function closeDialog() {
    setIsDialogOpen(false)
    setError(null)
  }

  async function handleAssign() {
    if (!selectedContactId) {
      setError("Select a contact.")
      return
    }

    setIsSaving(true)
    setError(null)
    try {
      const nextAssignments = await createProgramStaffAssignment({
        programId,
        offeringId: offering.id,
        contactId: selectedContactId,
        assignmentRole,
        sessionId: sessionId || null,
      })
      setAssignments(nextAssignments)
      onAssignmentsChange?.(nextAssignments)
      closeDialog()
      router.refresh()
    } catch (assignError) {
      setError(
        assignError instanceof Error
          ? assignError.message
          : "Failed to assign staff."
      )
    } finally {
      setIsSaving(false)
    }
  }

  async function handleRemove(assignmentId: string) {
    setIsSaving(true)
    setError(null)
    try {
      const nextAssignments = await removeProgramStaffAssignment({
        programId,
        assignmentId,
      })
      setAssignments(nextAssignments)
      onAssignmentsChange?.(nextAssignments)
      router.refresh()
    } catch (removeError) {
      setError(
        removeError instanceof Error
          ? removeError.message
          : "Failed to remove assignment."
      )
    } finally {
      setIsSaving(false)
    }
  }

  const primaryInstructor = assignments.find(
    (item) =>
      item.assignment_role === "primary_instructor" && !item.session_id
  )
  const additionalStaff = assignments.filter(
    (item) =>
      !(item.assignment_role === "primary_instructor" && !item.session_id)
  )

  if (!editing) {
    return (
      <>
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Primary instructor
          </p>
          <p className="text-sm font-medium">
            {primaryInstructor?.contact_name || "Not assigned"}
          </p>
        </div>
        {additionalStaff.length > 0 ? (
          <div className="space-y-1 sm:col-span-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Additional staff
            </p>
            <p className="text-sm font-medium">
              {additionalStaff
                .map(
                  (item) =>
                    `${item.contact_name} (${PROGRAM_STAFF_ASSIGNMENT_ROLE_LABELS[item.assignment_role]})`
                )
                .join(", ")}
            </p>
          </div>
        ) : null}
      </>
    )
  }

  return (
    <div className="space-y-3 h-full">
      <div className="space-y-1.5">
        <Label>Primary instructor</Label>
        <div className="flex flex-wrap items-center gap-1">
          <p className="min-w-0 flex-1 text-sm font-medium">
            {primaryInstructor?.contact_name || "Not assigned"}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            disabled={isSaving}
            aria-label={
              primaryInstructor
                ? "Edit primary instructor"
                : "Assign primary instructor"
            }
            onClick={() => openDialog("primary_instructor")}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          {primaryInstructor ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
              disabled={isSaving}
              aria-label="Remove primary instructor"
              onClick={() => void handleRemove(primaryInstructor.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
      </div>

      <div className="space-y-2">
        <Button
          type="button"
          size="sm"
          disabled={isSaving}
          onClick={() => openDialog("assistant_instructor")}
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add Staff
        </Button>

        {additionalStaff.length > 0 ? (
          <ul className="divide-y rounded-md border">
            {additionalStaff.map((assignment) => (
              <li
                key={assignment.id}
                className="flex items-center justify-between gap-3 px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {assignment.contact_name}
                  </p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="font-normal">
                      {
                        PROGRAM_STAFF_ASSIGNMENT_ROLE_LABELS[
                          assignment.assignment_role
                        ]
                      }
                    </Badge>
                    {assignment.session_name ? (
                      <span className="text-xs text-muted-foreground">
                        {assignment.session_name}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    disabled={isSaving}
                    aria-label={`Remove ${assignment.contact_name}`}
                    onClick={() => void handleRemove(assignment.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {error && !isDialogOpen ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : null}

      <Dialog open={isDialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {assignmentRole === "primary_instructor"
                ? "Assign primary instructor"
                : "Add staff"}
            </DialogTitle>
            <DialogDescription>
              Search for a contact with an Employee or Volunteer role.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {assignmentRole !== "primary_instructor" ? (
              <div className="space-y-2">
                <Label htmlFor="overview-staff-role">Role</Label>
                <select
                  id="overview-staff-role"
                  value={assignmentRole}
                  onChange={(event) =>
                    setAssignmentRole(
                      event.target.value as ProgramStaffAssignmentRole
                    )
                  }
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                >
                  {ADDITIONAL_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {PROGRAM_STAFF_ASSIGNMENT_ROLE_LABELS[role]}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {sessions.length > 0 &&
            (assignmentRole === "substitute" ||
              assignmentRole === "assistant_instructor") ? (
              <div className="space-y-2">
                <Label htmlFor="overview-staff-session">Session (optional)</Label>
                <select
                  id="overview-staff-session"
                  value={sessionId}
                  onChange={(event) => setSessionId(event.target.value)}
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                >
                  <option value="">Entire offering</option>
                  {sessions.map((session) => (
                    <option key={session.id} value={session.id}>
                      {session.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="overview-staff-search">Search contacts</Label>
              <Input
                id="overview-staff-search"
                value={contactSearch}
                onChange={(event) => setContactSearch(event.target.value)}
                placeholder="Name or email"
              />
            </div>

            <div className="max-h-48 space-y-2 overflow-y-auto rounded-md border p-2">
              {isSearching ? (
                <p className="flex items-center gap-2 px-2 py-3 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Searching…
                </p>
              ) : contactResults.length === 0 ? (
                <p className="px-2 py-3 text-sm text-muted-foreground">
                  No matching employees or volunteers.
                </p>
              ) : (
                contactResults.map((contact) => (
                  <label
                    key={contact.id}
                    className="flex cursor-pointer items-start gap-3 rounded-md border p-2"
                  >
                    <input
                      type="radio"
                      name="overview-staff-contact"
                      checked={selectedContactId === contact.id}
                      onChange={() => setSelectedContactId(contact.id)}
                      className="mt-1"
                    />
                    <span>
                      <span className="flex items-center gap-2 text-sm font-medium">
                        <UserRound className="h-4 w-4 text-muted-foreground" />
                        {contact.full_name}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {[contact.email, contact.roles.join(", ")]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                  </label>
                ))
              )}
            </div>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeDialog}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleAssign()}
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Assigning…
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Assign
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
