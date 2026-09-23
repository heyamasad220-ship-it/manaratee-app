"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Search } from "lucide-react"

import { EventServiceRequirementsFields } from "@/components/events/event-service-requirements-fields"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { updateInternalEventModules } from "@/lib/events/internal-event-actions"
import {
  serviceRequirementsFormFromEvent,
  type EventServiceRequirementsFormState,
} from "@/lib/events/event-service-requirements"
import type { InternalEventWithRelations } from "@/lib/events/internal-event-types"
import { storedWindowsFromForm } from "@/lib/events/volunteer-windows"
import { signUpReportSlotAndTime } from "@/lib/sign-ups/sign-up-reports"
import type { ServiceParticipationWithContact } from "@/lib/service-participations/service-participation-types"
import { cn } from "@/lib/utils"

function display(value: string | null | undefined) {
  return value?.trim() || "—"
}

type SignUpSection = "slots" | "volunteers"

export function EventVolunteersPanel({
  event,
  participations,
  canManage,
}: {
  event: InternalEventWithRelations
  participations: ServiceParticipationWithContact[]
  canManage: boolean
}) {
  const router = useRouter()
  const [section, setSection] = useState<SignUpSection>("slots")
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [serviceForm, setServiceForm] = useState<EventServiceRequirementsFormState>(() =>
    serviceRequirementsFormFromEvent(event)
  )

  const signups = useMemo(
    () =>
      participations.filter(
        (row) =>
          row.participation_type === "volunteer" &&
          (row.status === "pending" || row.status === "confirmed")
      ),
    [participations]
  )

  function handleSave() {
    setError(null)
    const hasSlots =
      storedWindowsFromForm(serviceForm.volunteerWindows || []).length > 0
    startTransition(async () => {
      const result = await updateInternalEventModules({
        eventId: event.id,
        serviceForm: {
          ...serviceForm,
          requiresVolunteers: hasSlots,
          volunteerWindowsExplicit: true,
        },
      })
      if (!result.success) {
        setError(result.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="space-y-6">
      <nav className="flex gap-0 border-b border-border">
        {(
          [
            ["slots", "Slots"],
            ["volunteers", "Volunteers"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setSection(id)}
            className={cn(
              "relative shrink-0 px-4 py-3 text-sm font-medium transition-colors",
              section === id ? "text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {label}
            {section === id ? (
              <span className="absolute inset-x-0 -bottom-px h-0.5 bg-primary" />
            ) : null}
          </button>
        ))}
      </nav>

      {section === "slots" ? (
        canManage ? (
          <EventServiceRequirementsFields
            value={serviceForm}
            onChange={setServiceForm}
            visibleModules={["volunteers"]}
            slotsOnly
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            You do not have permission to edit sign-up slots.
          </p>
        )
      ) : (
        <EventVolunteerSignups participations={signups} />
      )}

      {canManage ? (
        <div className="flex flex-col items-end gap-2">
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="button" onClick={handleSave} disabled={isPending}>
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              "Save"
            )}
          </Button>
        </div>
      ) : null}
    </div>
  )
}

function EventVolunteerSignups({
  participations,
}: {
  participations: ServiceParticipationWithContact[]
}) {
  const [search, setSearch] = useState("")

  const rows = useMemo(() => {
    return participations.map((row) => {
      const { slot, time } = signUpReportSlotAndTime({
        volunteerRole: row.volunteer_role,
        assignmentMeta: row.assignment_meta,
      })
      return {
        id: row.id,
        volunteerName: row.contact_name,
        email: row.contact_email,
        phone: row.contact_phone,
        slot,
        time,
      }
    })
  }, [participations])

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return rows
    return rows.filter((row) =>
      [row.volunteerName, row.email, row.phone, row.slot, row.time]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(query))
    )
  }, [rows, search])

  return (
    <div className="flex flex-col gap-4">
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search volunteers"
          className="pl-9"
          aria-label="Search volunteers"
        />
      </div>
      <p className="text-sm text-muted-foreground">
        {filtered.length} volunteer{filtered.length === 1 ? "" : "s"}
      </p>
      <Table containerClassName="rounded-lg border border-border">
        <TableHeader>
          <TableRow>
            <TableHead>Volunteer name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Phone number</TableHead>
            <TableHead>Slot</TableHead>
            <TableHead>Time</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                {rows.length === 0
                  ? "No volunteers have signed up yet."
                  : "No volunteers match this search."}
              </TableCell>
            </TableRow>
          ) : (
            filtered.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.volunteerName}</TableCell>
                <TableCell>{display(row.email)}</TableCell>
                <TableCell>{display(row.phone)}</TableCell>
                <TableCell>{display(row.slot)}</TableCell>
                <TableCell>{display(row.time)}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
