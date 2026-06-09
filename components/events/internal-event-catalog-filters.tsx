"use client"

import { useCallback, useEffect, useState, useTransition } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { LayoutGrid, List, Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { Department } from "@/lib/departments/department-types"
import type { EventType } from "@/lib/events/event-type-types"
import { getInternalEventStatusOptions } from "@/lib/events/internal-event-status"

type CatalogFilters = {
  q: string
  status: string
  department: string
  eventType: string
  view: "cards" | "table"
}

export function InternalEventCatalogFilters({
  departments,
  eventTypes,
  initialFilters,
}: {
  departments: Department[]
  eventTypes: EventType[]
  initialFilters: CatalogFilters
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [query, setQuery] = useState(initialFilters.q)

  useEffect(() => {
    setQuery(initialFilters.q)
  }, [initialFilters.q])

  const pushFilters = useCallback(
    (next: Partial<CatalogFilters>) => {
      const params = new URLSearchParams(searchParams.toString())

      const merged: CatalogFilters = {
        q: next.q ?? params.get("q") ?? "",
        status: next.status ?? params.get("status") ?? "all",
        department: next.department ?? params.get("department") ?? "all",
        eventType: next.eventType ?? params.get("eventType") ?? "all",
        view:
          next.view ??
          (params.get("view") === "table" ? "table" : "cards"),
      }

      if (merged.q.trim()) {
        params.set("q", merged.q.trim())
      } else {
        params.delete("q")
      }

      if (merged.status && merged.status !== "all") {
        params.set("status", merged.status)
      } else {
        params.delete("status")
      }

      if (merged.department && merged.department !== "all") {
        params.set("department", merged.department)
      } else {
        params.delete("department")
      }

      if (merged.eventType && merged.eventType !== "all") {
        params.set("eventType", merged.eventType)
      } else {
        params.delete("eventType")
      }

      if (merged.view === "table") {
        params.set("view", "table")
      } else {
        params.delete("view")
      }

      const queryString = params.toString()
      startTransition(() => {
        router.push(
          queryString ? `/event-management?${queryString}` : "/event-management"
        )
      })
    },
    [router, searchParams]
  )

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (query === initialFilters.q) {
        return
      }

      pushFilters({ q: query })
    }, 300)

    return () => window.clearTimeout(timeout)
  }, [query, initialFilters.q, pushFilters])

  function buildViewHref(view: "cards" | "table") {
    const params = new URLSearchParams(searchParams.toString())
    if (view === "table") {
      params.set("view", "table")
    } else {
      params.delete("view")
    }

    const queryString = params.toString()
    return queryString ? `/event-management?${queryString}` : "/event-management"
  }

  const statusOptions = getInternalEventStatusOptions()

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search events..."
          className="pl-9"
        />
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          <select
            value={initialFilters.status}
            onChange={(event) => pushFilters({ status: event.target.value })}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            disabled={isPending}
          >
            <option value="all">All statuses</option>
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <select
            value={initialFilters.department}
            onChange={(event) => pushFilters({ department: event.target.value })}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            disabled={isPending}
          >
            <option value="all">All departments</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </select>

          <select
            value={initialFilters.eventType}
            onChange={(event) => pushFilters({ eventType: event.target.value })}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            disabled={isPending}
          >
            <option value="all">All types</option>
            {eventTypes.map((eventType) => (
              <option key={eventType.id} value={eventType.id}>
                {eventType.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1 rounded-md border p-1">
          <Button
            variant={initialFilters.view === "cards" ? "secondary" : "ghost"}
            size="sm"
            className="h-8"
            asChild
          >
            <a href={buildViewHref("cards")}>
              <LayoutGrid className="mr-1.5 h-4 w-4" />
              Cards
            </a>
          </Button>
          <Button
            variant={initialFilters.view === "table" ? "secondary" : "ghost"}
            size="sm"
            className="h-8"
            asChild
          >
            <a href={buildViewHref("table")}>
              <List className="mr-1.5 h-4 w-4" />
              Table
            </a>
          </Button>
        </div>
      </div>
    </div>
  )
}
