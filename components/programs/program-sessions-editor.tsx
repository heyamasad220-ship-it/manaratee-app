"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { CalendarDays, Pencil, Plus } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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
import { Textarea } from "@/components/ui/textarea"
import {
  createProgramSession,
  updateProgramSession,
} from "@/lib/programs/program-session-actions"
import { sortProgramSessions } from "@/lib/programs/program-session-sort"
import type {
  ProgramSession,
  ProgramSessionStatus,
} from "@/lib/programs/program-session-types"

function formatDate(date?: string | null) {
  if (!date) return "—"

  return new Date(`${date}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function formatCurrency(amount?: number | null) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount || 0)
}

function preventFormSubmitOnEnter(event: React.KeyboardEvent) {
  if (event.key === "Enter") {
    event.preventDefault()
  }
}

type SessionDraft = {
  name: string
  description: string
  start_date: string
  end_date: string
  registration_open_date: string
  registration_close_date: string
  price: string
  enable_waitlist: boolean
  status: ProgramSessionStatus
}

const emptyDraft: SessionDraft = {
  name: "",
  description: "",
  start_date: "",
  end_date: "",
  registration_open_date: "",
  registration_close_date: "",
  price: "0",
  enable_waitlist: true,
  status: "active",
}

const SESSION_STATUS_OPTIONS: ProgramSessionStatus[] = [
  "active",
  "paused",
  "archived",
]

function sessionToDraft(session: ProgramSession): SessionDraft {
  return {
    name: session.name,
    description: session.description ?? "",
    start_date: session.start_date ?? "",
    end_date: session.end_date ?? "",
    registration_open_date: session.registration_open_date ?? "",
    registration_close_date: session.registration_close_date ?? "",
    price: String(session.price),
    enable_waitlist: session.enable_waitlist,
    status: session.status,
  }
}

function draftToPayload(draft: SessionDraft) {
  return {
    name: draft.name.trim(),
    description: draft.description.trim() || null,
    start_date: draft.start_date || null,
    end_date: draft.end_date || null,
    registration_open_date: draft.registration_open_date || null,
    registration_close_date: draft.registration_close_date || null,
    // Capacity is managed on the program/offering, not per session.
    capacity: 0,
    price: Number(draft.price || 0),
    enable_waitlist: draft.enable_waitlist,
    waitlist_capacity: null as number | null,
    status: draft.status,
  }
}

function SessionFormFields({
  draft,
  idPrefix,
  onChange,
}: {
  draft: SessionDraft
  idPrefix: string
  onChange: (field: keyof SessionDraft, value: string | boolean) => void
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor={`${idPrefix}-name`}>Session Name *</Label>
        <Input
          id={`${idPrefix}-name`}
          value={draft.name}
          onChange={(event) => onChange("name", event.target.value)}
          placeholder="Week 1, Session A, June Camp"
        />
      </div>

      <div className="space-y-2 md:col-span-2">
        <Label htmlFor={`${idPrefix}-description`}>Description</Label>
        <Textarea
          id={`${idPrefix}-description`}
          rows={2}
          value={draft.description}
          onChange={(event) => onChange("description", event.target.value)}
          placeholder="Optional session details"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-start-date`}>Start Date</Label>
        <Input
          id={`${idPrefix}-start-date`}
          type="date"
          value={draft.start_date}
          onChange={(event) => onChange("start_date", event.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-end-date`}>End Date</Label>
        <Input
          id={`${idPrefix}-end-date`}
          type="date"
          value={draft.end_date}
          onChange={(event) => onChange("end_date", event.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-registration-open`}>Registration Open</Label>
        <Input
          id={`${idPrefix}-registration-open`}
          type="date"
          value={draft.registration_open_date}
          onChange={(event) =>
            onChange("registration_open_date", event.target.value)
          }
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-registration-close`}>
          Registration Close
        </Label>
        <Input
          id={`${idPrefix}-registration-close`}
          type="date"
          value={draft.registration_close_date}
          onChange={(event) =>
            onChange("registration_close_date", event.target.value)
          }
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-price`}>Price</Label>
        <Input
          id={`${idPrefix}-price`}
          type="number"
          min="0"
          step="0.01"
          value={draft.price}
          onChange={(event) => onChange("price", event.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-status`}>Status</Label>
        <select
          id={`${idPrefix}-status`}
          value={draft.status}
          onChange={(event) =>
            onChange("status", event.target.value as ProgramSessionStatus)
          }
          className="h-9 w-full rounded-md border bg-background px-3 text-sm"
        >
          {SESSION_STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </option>
          ))}
        </select>
      </div>

      <label className="flex items-start gap-3 rounded-lg border bg-background p-3 md:col-span-2">
        <input
          type="checkbox"
          checked={draft.enable_waitlist}
          onChange={(event) => onChange("enable_waitlist", event.target.checked)}
          className="mt-1"
        />
        <div>
          <p className="text-sm font-medium">Enable waitlist</p>
          <p className="text-xs text-muted-foreground">
            Allow customers to join a waitlist when the program is full.
          </p>
        </div>
      </label>
    </div>
  )
}

export function ProgramSessionsEditor({
  programId,
  offeringId,
  sessions: initialSessions,
  sessionRegistrationEnabled = true,
  plain = false,
}: {
  programId: string
  offeringId: string
  sessions: ProgramSession[]
  /** When false, still allow staff to add sessions; show a tip for enrollment model. */
  sessionRegistrationEnabled?: boolean
  /** Hide nested card chrome when inside offering manage accordion. */
  plain?: boolean
}) {
  const router = useRouter()
  const [sessions, setSessions] = React.useState(() =>
    sortProgramSessions(initialSessions)
  )
  const [draft, setDraft] = React.useState<SessionDraft>(emptyDraft)
  const [panelMode, setPanelMode] = React.useState<"closed" | "add" | "edit">(
    "closed"
  )
  const [editingSessionId, setEditingSessionId] = React.useState<string | null>(
    null
  )
  const [isSaving, setIsSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    setSessions(sortProgramSessions(initialSessions))
  }, [initialSessions])

  function updateDraft(field: keyof SessionDraft, value: string | boolean) {
    setDraft((current) => ({ ...current, [field]: value }))
  }

  function closeForm() {
    setPanelMode("closed")
    setEditingSessionId(null)
    setDraft(emptyDraft)
    setError(null)
  }

  function openAddForm() {
    setPanelMode("add")
    setEditingSessionId(null)
    setDraft(emptyDraft)
    setError(null)
  }

  function openEditForm(session: ProgramSession) {
    setPanelMode("edit")
    setEditingSessionId(session.id)
    setDraft(sessionToDraft(session))
    setError(null)
  }

  async function handleSaveSession() {
    if (!draft.name.trim()) {
      setError("Session name is required.")
      return
    }

    setIsSaving(true)
    setError(null)

    const payload = draftToPayload(draft)

    try {
      if (panelMode === "edit" && editingSessionId) {
        await updateProgramSession({
          session_id: editingSessionId,
          program_id: programId,
          ...payload,
        })
      } else {
        await createProgramSession({
          program_id: programId,
          offering_id: offeringId,
          ...payload,
        })
      }

      closeForm()
      router.refresh()
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : panelMode === "edit"
            ? "Failed to update session."
            : "Failed to add session."
      )
    } finally {
      setIsSaving(false)
    }
  }

  const isFormOpen = panelMode !== "closed"

  const addSessionButton = !isFormOpen ? (
    <Button type="button" onClick={openAddForm} disabled={isSaving}>
      <Plus className="mr-2 h-4 w-4" />
      Add Session
    </Button>
  ) : null

  const body = (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          {!plain ? (
            <>
              <p className="text-base font-semibold leading-none">Sessions</p>
              <p className="text-sm text-muted-foreground">
                Add weeks, months, or class sections for this offering.
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Add weeks, months, or class sections for this offering. Sessions
              save immediately.
            </p>
          )}
          {!sessionRegistrationEnabled ? (
            <p className="text-sm text-muted-foreground">
              Tip: enable Selected Sessions or Day Pass under Enrollment so
              customers can register for these sessions.
            </p>
          ) : null}
        </div>
        {addSessionButton}
      </div>

      {sessions.length === 0 && !isFormOpen ? (
        <div className="rounded-lg border border-dashed bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
          No sessions yet. Click Add Session to create your first one.
        </div>
      ) : null}

      {sessions.length > 0 ? (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Session</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[80px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions.map((session) => (
                <TableRow
                  key={session.id}
                  className={
                    editingSessionId === session.id ? "bg-muted/30" : undefined
                  }
                >
                  <TableCell className="whitespace-normal font-medium">
                    {session.name}
                  </TableCell>
                  <TableCell className="whitespace-normal text-sm text-muted-foreground">
                    {formatDate(session.start_date)} –{" "}
                    {formatDate(session.end_date)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(session.price)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        session.status === "active" ? "default" : "secondary"
                      }
                    >
                      {session.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditForm(session)}
                      disabled={isSaving}
                    >
                      <Pencil className="mr-1 h-3.5 w-3.5" />
                      Edit
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}

      {isFormOpen ? (
        <div
          className="space-y-4 rounded-lg border bg-muted/20 p-4"
          onKeyDown={preventFormSubmitOnEnter}
        >
          <p className="text-sm font-medium">
            {panelMode === "edit" ? "Edit session" : "Add session"}
          </p>

          <SessionFormFields
            draft={draft}
            idPrefix={panelMode === "edit" ? "edit-session" : "add-session"}
            onChange={updateDraft}
          />

          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              onClick={() => void handleSaveSession()}
              disabled={isSaving}
            >
              {isSaving
                ? panelMode === "edit"
                  ? "Saving..."
                  : "Adding..."
                : panelMode === "edit"
                  ? "Save changes"
                  : "Add Session"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={closeForm}
              disabled={isSaving}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {sessions.length > 0 && !plain ? (
        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            {sessions.length} session{sessions.length === 1 ? "" : "s"}
          </div>
        </div>
      ) : null}

      {!plain ? (
        <p className="text-xs text-muted-foreground">
          Sessions save immediately. You do not need to click Save on the
          program form.
        </p>
      ) : null}
    </div>
  )

  if (plain) {
    return body
  }

  return (
    <Card className="border-0 shadow-none">
      <CardContent className="px-0 pb-0 pt-0">{body}</CardContent>
    </Card>
  )
}
