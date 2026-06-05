"use client"

import Link from "next/link"
import { useCallback, useEffect, useState, useTransition } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { LayoutGrid, List, Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { Department } from "@/lib/departments/department-types"

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
    const queryString = params.toString()
    return queryString ? `/programs/catalog?${queryString}` : "/programs/catalog"
  }

  const viewMode = initialFilters.view

  return (
    <div
      className={`flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between ${isPending ? "opacity-70" : ""}`}
    >
      <div className="flex flex-1 flex-col gap-4 sm:flex-row">
        <div className="relative flex-1 lg:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search programs..."
            className="pl-9"
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

      <div className="flex gap-2">
        <Button variant={viewMode === "cards" ? "secondary" : "outline"} asChild>
          <Link href={buildViewHref("cards")}>
            <LayoutGrid className="mr-2 h-4 w-4" />
            Cards
          </Link>
        </Button>

        <Button variant={viewMode === "table" ? "secondary" : "outline"} asChild>
          <Link href={buildViewHref("table")}>
            <List className="mr-2 h-4 w-4" />
            Table
          </Link>
        </Button>
      </div>
    </div>
  )
}
