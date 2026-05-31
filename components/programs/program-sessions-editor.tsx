"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { CalendarDays, ExternalLink, Plus, Users } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
import { createProgramSession } from "@/lib/programs/program-session-actions"
import type { ProgramSession } from "@/lib/programs/program-session-types"

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

const emptyDraft = {
  name: "",
  description: "",
  start_date: "",
  end_date: "",
  registration_open_date: "",
  registration_close_date: "",
  capacity: "0",
  price: "0",
  enable_waitlist: true,
  waitlist_capacity: "",
}

export function ProgramSessionsEditor({
  programId,
  sessions: initialSessions,
}: {
  programId: string
  sessions: ProgramSession[]
}) {
  const router = useRouter()
  const [sessions, setSessions] = React.useState(initialSessions)
  const [draft, setDraft] = React.useState(emptyDraft)
  const [isSaving, setIsSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    setSessions(initialSessions)
  }, [initialSessions])

  function updateDraft(field: keyof typeof emptyDraft, value: string | boolean) {
    setDraft((current) => ({ ...current, [field]: value }))
  }

  async function handleAddSession() {
    if (!draft.name.trim()) {
      setError("Session name is required.")
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      await createProgramSession({
        program_id: programId,
        name: draft.name.trim(),
        description: draft.description.trim() || null,
        start_date: draft.start_date || null,
        end_date: draft.end_date || null,
        registration_open_date: draft.registration_open_date || null,
        registration_close_date: draft.registration_close_date || null,
        capacity: Number(draft.capacity || 0),
        price: Number(draft.price || 0),
        enable_waitlist: draft.enable_waitlist,
        waitlist_capacity:
          draft.waitlist_capacity === ""
            ? null
            : Number(draft.waitlist_capacity || 0),
      })

      setDraft(emptyDraft)
      router.refresh()
    } catch (addError) {
      setError(
        addError instanceof Error ? addError.message : "Failed to add session."
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>Sessions</CardTitle>
            <CardDescription>
              Add weeks, months, or class sections customers can register for
              individually.
            </CardDescription>
          </div>

          <Button variant="outline" size="sm" asChild>
            <Link href={`/programs/${programId}/sessions`}>
              Open sessions page
              <ExternalLink className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {sessions.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
            No sessions yet. Add your first session below.
          </div>
        ) : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Session</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead className="text-right">Capacity</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map((session) => (
                  <TableRow key={session.id}>
                    <TableCell className="whitespace-normal font-medium">
                      {session.name}
                    </TableCell>
                    <TableCell className="whitespace-normal text-sm text-muted-foreground">
                      {formatDate(session.start_date)} –{" "}
                      {formatDate(session.end_date)}
                    </TableCell>
                    <TableCell className="text-right">
                      {session.enrolled}/{session.capacity}
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
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <div
          className="space-y-4 rounded-lg border bg-muted/20 p-4"
          onKeyDown={preventFormSubmitOnEnter}
        >
          <p className="text-sm font-medium">Add session</p>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="session-name">Session Name *</Label>
              <Input
                id="session-name"
                value={draft.name}
                onChange={(event) => updateDraft("name", event.target.value)}
                placeholder="Week 1, Session A, June Camp"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="session-description">Description</Label>
              <Textarea
                id="session-description"
                rows={2}
                value={draft.description}
                onChange={(event) =>
                  updateDraft("description", event.target.value)
                }
                placeholder="Optional session details"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="session-start-date">Start Date</Label>
              <Input
                id="session-start-date"
                type="date"
                value={draft.start_date}
                onChange={(event) =>
                  updateDraft("start_date", event.target.value)
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="session-end-date">End Date</Label>
              <Input
                id="session-end-date"
                type="date"
                value={draft.end_date}
                onChange={(event) =>
                  updateDraft("end_date", event.target.value)
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="session-registration-open">
                Registration Open
              </Label>
              <Input
                id="session-registration-open"
                type="date"
                value={draft.registration_open_date}
                onChange={(event) =>
                  updateDraft("registration_open_date", event.target.value)
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="session-registration-close">
                Registration Close
              </Label>
              <Input
                id="session-registration-close"
                type="date"
                value={draft.registration_close_date}
                onChange={(event) =>
                  updateDraft("registration_close_date", event.target.value)
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="session-capacity">Capacity</Label>
              <Input
                id="session-capacity"
                type="number"
                min="0"
                value={draft.capacity}
                onChange={(event) =>
                  updateDraft("capacity", event.target.value)
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="session-price">Price</Label>
              <Input
                id="session-price"
                type="number"
                min="0"
                step="0.01"
                value={draft.price}
                onChange={(event) => updateDraft("price", event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="session-waitlist-capacity">
                Waitlist Capacity
              </Label>
              <Input
                id="session-waitlist-capacity"
                type="number"
                min="0"
                value={draft.waitlist_capacity}
                onChange={(event) =>
                  updateDraft("waitlist_capacity", event.target.value)
                }
                placeholder="Optional"
              />
            </div>

            <label className="flex items-start gap-3 rounded-lg border bg-background p-3 md:col-span-2">
              <input
                type="checkbox"
                checked={draft.enable_waitlist}
                onChange={(event) =>
                  updateDraft("enable_waitlist", event.target.checked)
                }
                className="mt-1"
              />
              <div>
                <p className="text-sm font-medium">Enable waitlist</p>
                <p className="text-xs text-muted-foreground">
                  Allow customers to join a waitlist when this session is full.
                </p>
              </div>
            </label>
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              onClick={handleAddSession}
              disabled={isSaving}
            >
              <Plus className="mr-2 h-4 w-4" />
              {isSaving ? "Adding..." : "Add Session"}
            </Button>

            <p className="text-xs text-muted-foreground">
              Sessions save immediately to Supabase. You do not need to click
              Save Changes on the program form.
            </p>
          </div>
        </div>

        {sessions.length > 0 ? (
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              {sessions.length} session{sessions.length === 1 ? "" : "s"}
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              {sessions.reduce((sum, session) => sum + session.enrolled, 0)}{" "}
              total enrolled
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
