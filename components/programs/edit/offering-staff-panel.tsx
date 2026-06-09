"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Loader2, Plus, Trash2, UserRound } from "lucide-react"

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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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

export function OfferingStaffPanel({
  programId,
  offering,
  assignments: initialAssignments,
  sessions,
  onAssignmentsChange,
}: {
  programId: string
  offering: ProgramOffering
  assignments: ProgramStaffAssignmentWithDetails[]
  sessions: ProgramSession[]
  onAssignmentsChange?: (
    assignments: ProgramStaffAssignmentWithDetails[]
  ) => void
}) {
  const router = useRouter()
  const [assignments, setAssignments] =
    React.useState(initialAssignments)
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
    React.useState<ProgramStaffAssignmentRole>("assistant_instructor")
  const [sessionId, setSessionId] = React.useState("")

  React.useEffect(() => {
    setAssignments(initialAssignments)
  }, [initialAssignments])

  React.useEffect(() => {
    if (!isDialogOpen) {
      return
    }

    const timeout = window.setTimeout(() => {
      void loadContacts(contactSearch)
    }, 250)

    return () => window.clearTimeout(timeout)
  }, [contactSearch, isDialogOpen])

  async function loadContacts(search: string) {
    setIsSearching(true)
    try {
      const results = await searchProgramStaffContactsAction(search)
      setContactResults(results)
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

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold">Instructors &amp; Staff</h3>
        <p className="text-sm text-muted-foreground">
          Assign employees and volunteers from Workforce to{" "}
          {offering.name}. Assignments save immediately.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <QuickAssignCard
          title="Primary instructor"
          description={
            primaryInstructor
              ? primaryInstructor.contact_name
              : "Not assigned"
          }
          actionLabel={primaryInstructor ? "Change" : "Assign"}
          onAction={() => openDialog("primary_instructor")}
          disabled={isSaving}
        />
        <QuickAssignCard
          title="Assistants"
          description={`${assignments.filter((item) => item.assignment_role === "assistant_instructor").length} assigned`}
          actionLabel="Add"
          onAction={() => openDialog("assistant_instructor")}
          disabled={isSaving}
        />
        <QuickAssignCard
          title="Volunteers"
          description={`${assignments.filter((item) => item.assignment_role === "volunteer").length} assigned`}
          actionLabel="Add"
          onAction={() => openDialog("volunteer")}
          disabled={isSaving}
        />
        <QuickAssignCard
          title="Coordinator"
          description={`${assignments.filter((item) => item.assignment_role === "coordinator").length} assigned`}
          actionLabel="Add"
          onAction={() => openDialog("coordinator")}
          disabled={isSaving}
        />
      </div>

      {assignments.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
          No staff assigned yet. Use the cards above to assign people from
          Contacts.
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead className="w-[80px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assignments.map((assignment) => (
                <TableRow key={assignment.id}>
                  <TableCell>
                    <div className="font-medium">{assignment.contact_name}</div>
                    {assignment.contact_email ? (
                      <div className="text-xs text-muted-foreground">
                        {assignment.contact_email}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {
                        PROGRAM_STAFF_ASSIGNMENT_ROLE_LABELS[
                          assignment.assignment_role
                        ]
                      }
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {assignment.session_name
                      ? assignment.session_name
                      : "Entire offering"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => void handleRemove(assignment.id)}
                      disabled={isSaving}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Need someone new? Add them in{" "}
        <Link href="/workforce" className="underline underline-offset-2">
          Workforce
        </Link>{" "}
        with an Employee or Volunteer role first.
      </p>

      {error && !isDialogOpen ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : null}

      <Dialog open={isDialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign staff</DialogTitle>
            <DialogDescription>
              Search for a contact with an Employee or Volunteer role.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="staff-role">Role</Label>
              <select
                id="staff-role"
                value={assignmentRole}
                onChange={(event) =>
                  setAssignmentRole(
                    event.target.value as ProgramStaffAssignmentRole
                  )
                }
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              >
                {OFFERING_STAFF_ROLE_OPTIONS.map((role) => (
                  <option key={role} value={role}>
                    {PROGRAM_STAFF_ASSIGNMENT_ROLE_LABELS[role]}
                  </option>
                ))}
              </select>
            </div>

            {sessions.length > 0 &&
            (assignmentRole === "substitute" ||
              assignmentRole === "assistant_instructor") ? (
              <div className="space-y-2">
                <Label htmlFor="staff-session">Session (optional)</Label>
                <select
                  id="staff-session"
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
              <Label htmlFor="staff-search">Search contacts</Label>
              <Input
                id="staff-search"
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
                      name="staff-contact"
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

            {error ? (
              <p className="text-sm text-destructive">{error}</p>
            ) : null}
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

function QuickAssignCard({
  title,
  description,
  actionLabel,
  onAction,
  disabled,
}: {
  title: string
  description: string
  actionLabel: string
  onAction: () => void
  disabled?: boolean
}) {
  return (
    <div className="rounded-lg border bg-muted/20 p-4">
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-3"
        onClick={onAction}
        disabled={disabled}
      >
        {actionLabel}
      </Button>
    </div>
  )
}
