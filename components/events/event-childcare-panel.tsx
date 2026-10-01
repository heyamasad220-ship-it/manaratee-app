"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Search } from "lucide-react"

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
import {
  assignChildcareProviderToEvent,
  updateEventStaffAssignment,
} from "@/lib/service-participations/service-participation-actions"
import {
  fetchChildcareProvidersData,
  type ChildcareProviderRecord,
} from "@/lib/hr/childcare-provider-actions"
import type { ServiceParticipationWithContact } from "@/lib/service-participations/service-participation-types"
import { cn } from "@/lib/utils"

function display(value: string | null | undefined) {
  return value?.trim() || "—"
}

type ChildcareSection = "settings" | "providers"

type ChildcareEvent = {
  id: string
  requires_volunteers?: boolean | null
  requires_childcare?: boolean | null
  requires_vendors?: boolean | null
  service_requirements?: unknown
}

export function EventChildcarePanel({
  event,
  participations,
  canManage,
}: {
  event: ChildcareEvent
  participations: ServiceParticipationWithContact[]
  canManage: boolean
}) {
  const router = useRouter()
  const [section, setSection] = useState<ChildcareSection>("settings")
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [serviceForm, setServiceForm] = useState<EventServiceRequirementsFormState>(() => {
    const loaded = serviceRequirementsFormFromEvent(event)
    if (loaded.childcareAgeBands.length > 0) return loaded
    return {
      ...loaded,
      childcareAgeBands: [{ id: "age-draft", name: "", ageMin: "", ageMax: "" }],
    }
  })

  function handleSave() {
    setError(null)
    startTransition(async () => {
      const result = await updateInternalEventModules({
        eventId: event.id,
        serviceForm: {
          ...serviceForm,
          requiresChildcare: true,
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
            ["settings", "Settings"],
            ["providers", "Providers"],
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

      {section === "settings" ? (
        canManage ? (
          <ChildcareSettingsFields value={serviceForm} onChange={setServiceForm} />
        ) : (
          <p className="text-sm text-muted-foreground">
            You do not have permission to edit childcare settings.
          </p>
        )
      ) : (
        <ChildcareProviders
          eventId={event.id}
          participations={participations}
          canManage={canManage}
        />
      )}

      {canManage && section === "settings" ? (
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

function ChildcareSettingsFields({
  value,
  onChange,
}: {
  value: EventServiceRequirementsFormState
  onChange: (next: EventServiceRequirementsFormState) => void
}) {
  function updateBand(
    id: string,
    patch: Partial<(typeof value.childcareAgeBands)[number]>
  ) {
    onChange({
      ...value,
      childcareAgeBands: value.childcareAgeBands.map((band) =>
        band.id === id ? { ...band, ...patch } : band
      ),
    })
  }

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-medium">Age groups</h3>
          <p className="text-sm text-muted-foreground">
            Name the ages this event will watch. Kids still register with a ticket when ticketing is on.
          </p>
        </div>
        {value.childcareAgeBands.map((band) => (
          <div key={band.id} className="grid gap-2 sm:grid-cols-[1fr_6rem_6rem_auto]">
            <Input
              value={band.name}
              onChange={(event) => updateBand(band.id, { name: event.target.value })}
              placeholder="Name, such as Ages 1–4"
              aria-label="Age group name"
            />
            <Input
              value={band.ageMin}
              inputMode="numeric"
              onChange={(event) => updateBand(band.id, { ageMin: event.target.value })}
              placeholder="Min"
              aria-label="Minimum age"
            />
            <Input
              value={band.ageMax}
              inputMode="numeric"
              onChange={(event) => updateBand(band.id, { ageMax: event.target.value })}
              placeholder="Max"
              aria-label="Maximum age"
            />
            <Button
              type="button"
              variant="ghost"
              onClick={() =>
                onChange({
                  ...value,
                  childcareAgeBands: value.childcareAgeBands.filter((row) => row.id !== band.id),
                })
              }
            >
              Remove
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            onChange({
              ...value,
              childcareAgeBands: [
                ...value.childcareAgeBands,
                { id: `age-${Date.now()}`, name: "", ageMin: "", ageMax: "" },
              ],
            })
          }
        >
          Add age group
        </Button>
      </div>
    </div>
  )
}

function ChildcareProviders({
  eventId,
  participations,
  canManage,
}: {
  eventId: string
  participations: ServiceParticipationWithContact[]
  canManage: boolean
}) {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [directory, setDirectory] = useState<ChildcareProviderRecord[]>([])
  const [rowError, setRowError] = useState<string | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)

  useEffect(() => {
    void fetchChildcareProvidersData()
      .then((data) => setDirectory(data.providers))
      .catch(() => setDirectory([]))
  }, [])

  const rows = useMemo(() => {
    return participations
      .filter(
        (row) =>
          row.participation_type === "childcare_provider" &&
          (row.status === "pending" || row.status === "confirmed")
      )
      .map((row) => ({
        id: row.id,
        name: row.contact_name,
        email: row.contact_email,
        phone: row.contact_phone,
        status: row.status,
      }))
  }, [participations])

  const assignedContactIds = useMemo(
    () =>
      new Set(
        participations
          .filter(
            (row) =>
              row.participation_type === "childcare_provider" &&
              (row.status === "pending" || row.status === "confirmed")
          )
          .map((row) => row.contact_id)
          .filter(Boolean)
      ),
    [participations]
  )

  const matches = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return []
    return directory.filter((provider) =>
      [provider.name, provider.email, provider.phone]
        .filter((value) => value && value !== "—")
        .some((value) => value.toLowerCase().includes(query))
    )
  }, [directory, search])

  return (
    <div className="flex flex-col gap-4">
      {canManage ? (
        <div className="space-y-2">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search childcare providers to assign"
              className="pl-9"
              aria-label="Search childcare providers to assign"
            />
          </div>
          {search.trim() ? (
            matches.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No childcare providers match this search.
              </p>
            ) : (
              <div className="max-w-xl rounded-lg border border-border">
                {matches.map((provider) => {
                  const alreadyAssigned =
                    provider.contactId != null && assignedContactIds.has(provider.contactId)
                  return (
                    <div
                      key={provider.id}
                      className="flex items-center justify-between gap-3 border-b border-border px-3 py-2 last:border-b-0"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{provider.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {[provider.phone, provider.email]
                            .filter((value) => value && value !== "—")
                            .join(" · ") || "No contact details"}
                        </p>
                      </div>
                      {alreadyAssigned ? (
                        <span className="text-xs text-muted-foreground">Assigned</span>
                      ) : (
                        <Button
                          type="button"
                          size="sm"
                          disabled={!provider.contactId || pendingId === provider.id}
                          onClick={() => {
                            if (!provider.contactId) return
                            setRowError(null)
                            setPendingId(provider.id)
                            void assignChildcareProviderToEvent({
                              eventId,
                              contactId: provider.contactId,
                            }).then((result) => {
                              setPendingId(null)
                              if (!result.success) {
                                setRowError(result.error)
                                return
                              }
                              setSearch("")
                              router.refresh()
                            })
                          }}
                        >
                          Assign
                        </Button>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          ) : null}
        </div>
      ) : null}
      <p className="text-sm text-muted-foreground">
        {rows.length} provider{rows.length === 1 ? "" : "s"}
      </p>
      {rowError ? <p className="text-sm text-destructive">{rowError}</p> : null}
      <Table containerClassName="rounded-lg border border-border">
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Status</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                No child care providers have been assigned yet.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.name}</TableCell>
                <TableCell>{display(row.email)}</TableCell>
                <TableCell>{display(row.phone)}</TableCell>
                <TableCell>{row.status === "confirmed" ? "Confirmed" : "Needs confirmation"}</TableCell>
                <TableCell>
                  {canManage && row.status !== "confirmed" ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={pendingId === row.id}
                      onClick={() => {
                        setRowError(null)
                        setPendingId(row.id)
                        void updateEventStaffAssignment({
                          participationId: row.id,
                          status: "confirmed",
                        }).then((result) => {
                          setPendingId(null)
                          if (!result.success) {
                            setRowError(result.error)
                            return
                          }
                          router.refresh()
                        })
                      }}
                    >
                      Confirm
                    </Button>
                  ) : null}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
