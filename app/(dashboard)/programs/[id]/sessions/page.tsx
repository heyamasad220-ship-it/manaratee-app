import Link from "next/link"
import { notFound } from "next/navigation"
import {
  ArrowLeft,
  CalendarDays,
  DollarSign,
  Plus,
  Users,
} from "lucide-react"

import { Header } from "@/components/layout/header"
import { OfferingSessionsSelector } from "@/components/programs/edit/offering-sessions-selector"
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
import { Textarea } from "@/components/ui/textarea"
import {
  getDefaultOfferingForProgram,
  getOfferingsForProgram,
} from "@/lib/programs/program-offering-queries"
import { getProgramById } from "@/lib/programs/program-queries"
import { getProgramSessionsForOffering } from "@/lib/programs/program-session-queries"
import { createProgramSession } from "@/lib/programs/program-session-actions"
import {
  PROGRAM_LABEL,
  PROGRAM_LABEL_PLURAL,
  YEAR_SEASON_LABEL,
} from "@/lib/programs/program-display-labels"

function formatDate(date?: string | null) {
  if (!date) return "Not set"

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

function resolveSelectedOffering(
  offerings: Awaited<ReturnType<typeof getOfferingsForProgram>>,
  defaultOffering: Awaited<ReturnType<typeof getDefaultOfferingForProgram>>,
  offeringParam?: string
) {
  if (
    offeringParam &&
    offerings.some((offering) => offering.id === offeringParam)
  ) {
    return offerings.find((offering) => offering.id === offeringParam) ?? null
  }

  return defaultOffering ?? offerings[0] ?? null
}

export default async function ProgramSessionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ offering?: string }>
}) {
  const { id } = await params
  const { offering: offeringParam } = await searchParams

  const [program, offerings, defaultOffering] = await Promise.all([
    getProgramById(id),
    getOfferingsForProgram(id),
    getDefaultOfferingForProgram(id),
  ])

  if (!program) {
    notFound()
  }

  const selectedOffering = resolveSelectedOffering(
    offerings,
    defaultOffering,
    offeringParam
  )

  const sessions = selectedOffering
    ? await getProgramSessionsForOffering(
        id,
        selectedOffering.id,
        selectedOffering.is_default
      )
    : []

  async function addSession(formData: FormData) {
    "use server"

    const offeringId = String(formData.get("offering_id") || "") || null

    await createProgramSession({
      program_id: id,
      offering_id: offeringId,
      name: String(formData.get("name") || ""),
      description: String(formData.get("description") || "") || null,
      start_date: String(formData.get("start_date") || "") || null,
      end_date: String(formData.get("end_date") || "") || null,
      registration_open_date:
        String(formData.get("registration_open_date") || "") || null,
      registration_close_date:
        String(formData.get("registration_close_date") || "") || null,
      capacity: Number(formData.get("capacity") || 0),
      price: Number(formData.get("price") || 0),
      enable_waitlist: formData.get("enable_waitlist") === "on",
      waitlist_capacity:
        String(formData.get("waitlist_capacity") || "") === ""
          ? null
          : Number(formData.get("waitlist_capacity") || 0),
    })
  }

  const editProgramHref = selectedOffering
    ? `/programs/${program.id}/offerings/${selectedOffering.id}?tab=enrollment`
    : `/programs/${program.id}`

  return (
    <>
      <Header title="Programs" />

      <div className="min-h-screen bg-background px-6 py-6">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Link
                href={editProgramHref}
                className="mb-3 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to {PROGRAM_LABEL_PLURAL}
              </Link>

              <h1 className="text-2xl font-semibold tracking-tight">
                Sessions
              </h1>

              <p className="mt-1 text-sm text-muted-foreground">
                {selectedOffering
                  ? `Manage sessions for ${selectedOffering.name} under ${program.name}.`
                  : `Manage sessions for ${program.name}. Add a ${PROGRAM_LABEL.toLowerCase()} first.`}
              </p>
            </div>

            <Button asChild variant="outline">
              <Link href={editProgramHref}>
                {selectedOffering
                  ? `Manage ${PROGRAM_LABEL}`
                  : `View ${YEAR_SEASON_LABEL}`}
              </Link>
            </Button>
          </div>

          {selectedOffering ? (
            <OfferingSessionsSelector
              programId={program.id}
              offerings={offerings}
              selectedOfferingId={selectedOffering.id}
            />
          ) : (
            <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
              No {PROGRAM_LABEL_PLURAL.toLowerCase()} are configured for this{" "}
              {YEAR_SEASON_LABEL.toLowerCase()}. Add a{" "}
              {PROGRAM_LABEL.toLowerCase()} from the{" "}
              {YEAR_SEASON_LABEL.toLowerCase()} page before creating sessions.
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-4 lg:col-span-2">
              {!selectedOffering ? null : sessions.length === 0 ? (
                <Card>
                  <CardContent className="flex min-h-[260px] flex-col items-center justify-center p-8 text-center">
                    <CalendarDays className="mb-4 h-10 w-10 text-muted-foreground" />
                    <h2 className="text-lg font-semibold">No sessions yet</h2>
                    <p className="mt-2 max-w-md text-sm text-muted-foreground">
                      Add sessions for {selectedOffering.name} — camps, classes,
                      workshops, months, weeks, or course sections.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                sessions.map((session) => (
                  <Card key={session.id}>
                    <CardContent className="p-5">
                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-lg font-semibold">
                              {session.name}
                            </h2>

                            <Badge
                              variant={
                                session.status === "active"
                                  ? "default"
                                  : "secondary"
                              }
                            >
                              {session.status}
                            </Badge>
                          </div>

                          {session.description ? (
                            <p className="mt-1 text-sm text-muted-foreground">
                              {session.description}
                            </p>
                          ) : null}
                        </div>

                        <div className="text-sm font-medium">
                          {formatCurrency(session.price)}
                        </div>
                      </div>

                      <div className="mt-5 grid gap-4 text-sm md:grid-cols-3">
                        <div className="rounded-lg border p-3">
                          <div className="mb-1 flex items-center gap-2 text-muted-foreground">
                            <CalendarDays className="h-4 w-4" />
                            Dates
                          </div>
                          <div>
                            {formatDate(session.start_date)} –{" "}
                            {formatDate(session.end_date)}
                          </div>
                        </div>

                        <div className="rounded-lg border p-3">
                          <div className="mb-1 flex items-center gap-2 text-muted-foreground">
                            <Users className="h-4 w-4" />
                            Capacity
                          </div>
                          <div>
                            {session.enrolled}/{session.capacity}
                          </div>
                        </div>

                        <div className="rounded-lg border p-3">
                          <div className="mb-1 flex items-center gap-2 text-muted-foreground">
                            <DollarSign className="h-4 w-4" />
                            Waitlist
                          </div>
                          <div>
                            {session.enable_waitlist
                              ? `${session.waitlist} waiting`
                              : "Disabled"}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>

            {selectedOffering ? (
              <Card>
                <CardHeader>
                  <CardTitle>Add Session</CardTitle>
                  <CardDescription>
                    Create a session for {selectedOffering.name}.
                  </CardDescription>
                </CardHeader>

                <CardContent>
                  <form action={addSession} className="space-y-4">
                    <input
                      type="hidden"
                      name="offering_id"
                      value={selectedOffering.id}
                    />

                    <div className="space-y-2">
                      <Label htmlFor="name">Session Name *</Label>
                      <Input
                        id="name"
                        name="name"
                        required
                        placeholder="Session A"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        name="description"
                        rows={3}
                        placeholder="Optional session details"
                      />
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="start_date">Start Date</Label>
                        <Input id="start_date" name="start_date" type="date" />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="end_date">End Date</Label>
                        <Input id="end_date" name="end_date" type="date" />
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="registration_open_date">
                          Registration Open
                        </Label>
                        <Input
                          id="registration_open_date"
                          name="registration_open_date"
                          type="date"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="registration_close_date">
                          Registration Close
                        </Label>
                        <Input
                          id="registration_close_date"
                          name="registration_close_date"
                          type="date"
                        />
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="capacity">Capacity</Label>
                        <Input
                          id="capacity"
                          name="capacity"
                          type="number"
                          min="0"
                          defaultValue="0"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="price">Price</Label>
                        <Input
                          id="price"
                          name="price"
                          type="number"
                          min="0"
                          step="0.01"
                          defaultValue="0"
                        />
                      </div>
                    </div>

                    <label className="flex items-start gap-3 rounded-lg border p-3">
                      <input
                        type="checkbox"
                        name="enable_waitlist"
                        defaultChecked
                        className="mt-1"
                      />

                      <div>
                        <p className="text-sm font-medium">Enable waitlist</p>
                        <p className="text-xs text-muted-foreground">
                          Allow customers to join a waitlist when this session is
                          full.
                        </p>
                      </div>
                    </label>

                    <div className="space-y-2">
                      <Label htmlFor="waitlist_capacity">
                        Waitlist Capacity
                      </Label>
                      <Input
                        id="waitlist_capacity"
                        name="waitlist_capacity"
                        type="number"
                        min="0"
                        placeholder="Leave blank for unlimited"
                      />
                    </div>

                    <Button type="submit" className="w-full">
                      <Plus className="mr-2 h-4 w-4" />
                      Add Session
                    </Button>
                  </form>
                </CardContent>
              </Card>
            ) : null}
          </div>
        </div>
      </div>
    </>
  )
}
