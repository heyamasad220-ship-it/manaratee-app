"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import {
  CalendarClock,
  CalendarDays,
  Copy,
  Flag,
  Megaphone,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react"

import { CreateBazaarEventDrawer } from "@/components/bazaar/create-bazaar-event-drawer"
import { CopyBazaarEventDialog } from "@/components/vendor-hub/events/copy-bazaar-event-dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { StatCard } from "@/components/ui/stat-card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { STAFF_MAIN_CONTENT_STICKY_TOP_CLASS } from "@/lib/layout/staff-dashboard-chrome"
import { deleteBazaarEvent } from "@/lib/vendor-hub/vendor-hub-event-actions"
import { VENDOR_HUB_ROUTES } from "@/lib/vendor-hub/vendor-hub-routes"
import type { VendorHubEventWithInternal } from "@/lib/vendor-hub/vendor-hub-types"
import { cn } from "@/lib/utils"

const SHORT_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const

function todayIso() {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${now.getFullYear()}-${month}-${day}`
}

function shortDate(iso: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!match) return iso
  const month = Number(match[2])
  const day = Number(match[3])
  if (month < 1 || month > 12) return iso
  return `${SHORT_MONTHS[month - 1]} ${day}`
}

function daysUntil(iso: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (!match) return null
  const target = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - today.getTime()) / 86_400_000)
}

function isOnCalendar(event: VendorHubEventWithInternal) {
  return event.calendar_status === "published" || event.calendar_status === "community_visible"
}

function venueLabel(event: VendorHubEventWithInternal) {
  return event.venue_name?.trim() || event.location?.trim() || "—"
}

export function BazaarEventsListClient({
  events,
}: {
  events: VendorHubEventWithInternal[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [createOpen, setCreateOpen] = useState(false)
  const [editEvent, setEditEvent] = useState<VendorHubEventWithInternal | null>(null)
  const [copyEvent, setCopyEvent] = useState<VendorHubEventWithInternal | null>(null)
  const [deleteEvent, setDeleteEvent] = useState<VendorHubEventWithInternal | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  function openCreate() {
    setEditEvent(null)
    setCreateOpen(true)
  }

  function openEdit(event: VendorHubEventWithInternal) {
    setEditEvent(event)
    setCreateOpen(true)
  }

  function onDrawerOpenChange(open: boolean) {
    setCreateOpen(open)
    if (!open) {
      setEditEvent(null)
    }
  }

  function confirmDelete() {
    if (!deleteEvent) return
    setDeleteError(null)
    startTransition(async () => {
      try {
        await deleteBazaarEvent(deleteEvent.id)
        setDeleteEvent(null)
        router.refresh()
      } catch (error) {
        setDeleteError(error instanceof Error ? error.message : "Could not delete event.")
      }
    })
  }

  const today = todayIso()
  const upcoming = events
    .filter((event) => event.event_date && event.event_date >= today)
    .sort((a, b) => (a.event_date || "").localeCompare(b.event_date || ""))
  const nextEvent = upcoming[0] ?? null
  const nextDays = nextEvent?.event_date ? daysUntil(nextEvent.event_date) : null
  const onCalendar = events.filter(isOnCalendar).length
  const nextHint = !nextEvent
    ? "Nothing scheduled"
    : nextDays === 0
      ? `${nextEvent.name} · today`
      : nextDays === 1
        ? `${nextEvent.name} · tomorrow`
        : nextDays != null && nextDays > 1
          ? `${nextEvent.name} · in ${nextDays} days`
          : nextEvent.name

  return (
    <div>
      <div
        className={cn(
          "sticky z-40 border-b border-border bg-background px-6 pt-6 pb-4",
          STAFF_MAIN_CONTENT_STICKY_TOP_CLASS
        )}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Events</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage booth reservations, assignments, and payments for each bazaar, market, or
              festival. Vendors apply once at the organization level.
            </p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Create event
          </Button>
        </div>

        <div className="mt-4 grid grid-cols-4 gap-3">
          <StatCard
            fill
            layout="header"
            tone="blue"
            icon={CalendarDays}
            label="Events"
            value={events.length}
            hint="On this list"
          />
          <StatCard
            fill
            layout="header"
            tone="emerald"
            icon={CalendarClock}
            label="Upcoming"
            value={upcoming.length}
            hint="Today or later"
          />
          <StatCard
            fill
            layout="header"
            tone="amber"
            icon={Flag}
            label="Next"
            value={nextEvent?.event_date ? shortDate(nextEvent.event_date) : "—"}
            hint={nextHint}
            valueClassName="text-xl"
          />
          <StatCard
            fill
            layout="header"
            tone="violet"
            icon={Megaphone}
            label="On the calendar"
            value={onCalendar}
            hint="Published for the community"
          />
        </div>
      </div>

      <div className="px-6 py-6">
      {events.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            No events yet. Create one, publish it to the calendar, and approved vendors can
            reserve booths.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event name</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Venue</TableHead>
                  <TableHead className="text-right">Vendors</TableHead>
                  <TableHead className="w-[72px]">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={VENDOR_HUB_ROUTES.events.detail(event.id)}
                        className="text-primary hover:underline"
                      >
                        {event.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {event.event_date ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {venueLabel(event)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {event.total_booths ?? 0}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            aria-label={`Actions for ${event.name}`}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(event)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setCopyEvent(event)}>
                            <Copy className="mr-2 h-4 w-4" />
                            Copy event
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => {
                              setDeleteError(null)
                              setDeleteEvent(event)
                            }}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      </div>

      <CreateBazaarEventDrawer
        open={createOpen}
        onOpenChange={onDrawerOpenChange}
        eventData={editEvent ?? undefined}
      />

      {copyEvent ? (
        <CopyBazaarEventDialog
          sourceEventId={copyEvent.id}
          sourceEventName={copyEvent.name}
          open={Boolean(copyEvent)}
          onOpenChange={(open) => {
            if (!open) setCopyEvent(null)
          }}
        />
      ) : null}

      <AlertDialog
        open={Boolean(deleteEvent)}
        onOpenChange={(open) => {
          if (!open && !isPending) {
            setDeleteEvent(null)
            setDeleteError(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete bazaar event?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes{" "}
              <span className="font-medium text-foreground">{deleteEvent?.name}</span> and related
              booth assignments, payments, and messages for this event. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError ? (
            <p className="text-sm text-destructive">{deleteError}</p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isPending}
              onClick={(event) => {
                event.preventDefault()
                confirmDelete()
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
