"use client"

import Link from "next/link"
import { useCallback, useEffect, useState, useTransition } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { LayoutGrid, List, Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { Department } from "@/lib/departments/department-types"
import { cn } from "@/lib/utils"

type CatalogFilters = {
  q: string
  status: string
  department: string
  view: "cards" | "table"
}

export function ProgramCatalogFilters({
  departments,
  initialFilters,
}: {
  departments: Department[]
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

      if (merged.view === "table") {
        params.set("view", "table")
      } else {
        params.delete("view")
      }

      // Reset page when filters change
      if (next.q !== undefined || next.status !== undefined || next.department !== undefined) {
        params.delete("page")
      }

      const queryString = params.toString()
      startTransition(() => {
        router.push(
          queryString ? `/programs/catalog?${queryString}` : "/programs/catalog"
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
    params.delete("page")
    const queryString = params.toString()
    return queryString ? `/programs/catalog?${queryString}` : "/programs/catalog"
  }

  const viewMode = initialFilters.view

  return (
    <div
      className={cn(
        "flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between",
        isPending && "opacity-70"
      )}
    >
      <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative w-full flex-1 sm:max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search programs..."
            className="h-10 bg-background pl-9"
          />
        </div>

        <select
          value={initialFilters.status || "all"}
          onChange={(event) =>
            pushFilters({ status: event.target.value, q: query })
          }
          className="h-10 rounded-md border bg-background px-3 text-sm"
        >
          <option value="all">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="archived">Archived</option>
        </select>

        <select
          value={initialFilters.department || "all"}
          onChange={(event) =>
            pushFilters({ department: event.target.value, q: query })
          }
          className="h-10 rounded-md border bg-background px-3 text-sm"
        >
          <option value="all">All Departments</option>
          {departments.map((department) => (
            <option key={department.id} value={department.id}>
              {department.name}
            </option>
          ))}
        </select>
      </div>

      <div className="inline-flex h-10 shrink-0 items-center rounded-md border bg-muted/40 p-0.5">
        <Button
          variant={viewMode === "cards" ? "default" : "ghost"}
          size="icon"
          className="h-9 w-9 rounded-[6px]"
          asChild
        >
          <Link href={buildViewHref("cards")} aria-label="Cards view">
            <LayoutGrid className="h-4 w-4" />
          </Link>
        </Button>
        <Button
          variant={viewMode === "table" ? "default" : "ghost"}
          size="icon"
          className="h-9 w-9 rounded-[6px]"
          asChild
        >
          <Link href={buildViewHref("table")} aria-label="Table view">
            <List className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  )
}
