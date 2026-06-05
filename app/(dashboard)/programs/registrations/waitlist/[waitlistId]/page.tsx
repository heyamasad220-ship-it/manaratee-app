import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, CalendarDays, Mail, Phone, User, Users } from "lucide-react"

import { Header } from "@/components/layout/header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { createClient } from "@/lib/supabase/server"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import {
  promoteWaitlistAction,
  removeWaitlistEntryAction,
} from "@/app/(dashboard)/programs/registrations/actions"
import { canPromoteWaitlist } from "@/lib/programs/program-lifecycle-types"

type PageParams = {
  waitlistId: string
}

function formatDate(value: string | null) {
  if (!value) return "TBD"

  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function normalizeStatus(value: string | null) {
  if (!value) return "Unknown"

  return value
    .split("_")
    .join(" ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function DetailItem({
  label,
  value,
}: {
  label: string
  value: string | number | null | undefined
}) {
  return (
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="font-medium">{value || "Not set"}</p>
    </div>
  )
}

export default async function WaitlistRegistrationDetailPage({
  params,
}: {
  params: Promise<PageParams>
}) {
  const { waitlistId } = await params
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    notFound()
  }

  const supabase = await createClient()

  const { data: waitlist, error } = await supabase
    .from("program_waitlist")
    .select(
      `
      id,
      organization_id,
      program_id,
      child_name,
      child_age,
      parent_name,
      parent_email,
      parent_phone,
      preferred_weeks,
      added_date,
      position,
      status,
      priority,
      offer_expiry,
      notes,
      created_at
    `
    )
    .eq("organization_id", organizationId)
    .eq("id", waitlistId)
    .maybeSingle()

  if (error || !waitlist) {
    notFound()
  }

  let program: {
    id: string
    name: string
    description: string | null
    start_date: string | null
    end_date: string | null
    capacity: number
    enrolled: number
    waitlist: number
    status: string
  } | null = null

  if (waitlist.program_id) {
    const { data } = await supabase
      .from("programs")
      .select(
        "id, name, description, start_date, end_date, capacity, enrolled, waitlist, status"
      )
      .eq("id", waitlist.program_id)
      .maybeSingle()

    program = data
  }

  const redirectTo = `/programs/registrations/waitlist/${waitlistId}`
  const canMoveWaitlist = program && canPromoteWaitlist(waitlist.status, program)
  const weeks = (waitlist.preferred_weeks as string[] | null) || []

  return (
    <>
      <Header title="Programs" />

      <div className="flex flex-col gap-6 p-6">
        <div>
          <Link
            href="/programs/registrations"
            className="mb-3 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Registrations
          </Link>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-semibold tracking-tight">
                  Waitlist Registration
                </h1>
                <Badge variant="outline">Waitlist</Badge>
                <Badge variant="secondary">
                  {normalizeStatus(waitlist.status)}
                </Badge>
              </div>
              <p className="mt-2 text-muted-foreground">
                {waitlist.child_name} · {program?.name || "Unknown Program"}
              </p>
            </div>

            {program ? (
              <Button variant="outline" asChild>
                <Link href={`/programs/${program.id}/edit`}>Edit Program</Link>
              </Button>
            ) : null}
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Waitlist Actions</CardTitle>
            <CardDescription>
              Promote to a full registration or remove from the waitlist.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <form action={promoteWaitlistAction}>
              <input type="hidden" name="waitlist_id" value={waitlist.id} />
              <input type="hidden" name="redirect_to" value={redirectTo} />
              <Button type="submit" disabled={!canMoveWaitlist}>
                Promote to Registration
              </Button>
            </form>

            <form action={removeWaitlistEntryAction}>
              <input type="hidden" name="waitlist_id" value={waitlist.id} />
              <input type="hidden" name="redirect_to" value={redirectTo} />
              <Button type="submit" variant="destructive">
                Remove from Waitlist
              </Button>
            </form>

            {!canMoveWaitlist ? (
              <p className="text-sm text-muted-foreground">
                This waitlist entry cannot be promoted because the program is
                full or the entry is no longer active.
              </p>
            ) : null}
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="rounded-full bg-muted p-3 text-blue-600">
                <User className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Participant</p>
                <p className="font-semibold">{waitlist.child_name}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="rounded-full bg-muted p-3 text-orange-600">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Position</p>
                <p className="font-semibold">
                  {waitlist.position ? `#${waitlist.position}` : "Not set"}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="rounded-full bg-muted p-3 text-green-600">
                <CalendarDays className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Added</p>
                <p className="font-semibold">
                  {formatDate(waitlist.added_date || waitlist.created_at)}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Contact</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-5 sm:grid-cols-2">
              <DetailItem label="Child Age" value={waitlist.child_age} />
              <DetailItem label="Parent Name" value={waitlist.parent_name} />
              <div>
                <p className="text-sm text-muted-foreground">Parent Email</p>
                {waitlist.parent_email ? (
                  <a
                    href={`mailto:${waitlist.parent_email}`}
                    className="inline-flex items-center gap-2 font-medium text-primary hover:underline"
                  >
                    <Mail className="h-4 w-4" />
                    {waitlist.parent_email}
                  </a>
                ) : (
                  <p className="font-medium">Not set</p>
                )}
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Parent Phone</p>
                {waitlist.parent_phone ? (
                  <a
                    href={`tel:${waitlist.parent_phone}`}
                    className="inline-flex items-center gap-2 font-medium text-primary hover:underline"
                  >
                    <Phone className="h-4 w-4" />
                    {waitlist.parent_phone}
                  </a>
                ) : (
                  <p className="font-medium">Not set</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Waitlist Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-5 sm:grid-cols-2">
                <DetailItem label="Priority" value={normalizeStatus(waitlist.priority)} />
                <DetailItem
                  label="Offer Expiry"
                  value={formatDate(waitlist.offer_expiry)}
                />
              </div>
              <div>
                <p className="mb-2 text-sm text-muted-foreground">
                  Preferred Weeks
                </p>
                {weeks.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {weeks.map((week) => (
                      <Badge key={week} variant="secondary">
                        {week}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm font-medium">Not set</p>
                )}
              </div>
              {waitlist.notes ? (
                <div>
                  <p className="mb-2 text-sm text-muted-foreground">Notes</p>
                  <div className="rounded-lg border bg-muted/30 p-4 text-sm">
                    {waitlist.notes}
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}
