"use client"

import Link from "next/link"
import { useCallback, useEffect, useState, useTransition } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { LayoutGrid, List, Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { Department } from "@/lib/departments/department-types"
import { cn } from "@/lib/utils"

export type CatalogFilters = {
  q: string
  status: string
  department: string
  gender: string
  audience: string
  age: string
  view: "cards" | "table"
}

const EMPTY_FAMILY = {
  gender: "all",
  audience: "all",
  age: "",
} as const

export function ProgramCatalogFilters({
  departments,
  initialFilters,
  basePath = "/programs/catalog",
  hideDepartmentFilter = false,
  hideStatusFilter = false,
  hideViewToggle = false,
  showFamilyFilters = false,
  /** Controlled mode: call instead of pushing catalog URL (department embed). */
  onFiltersChange,
}: {
  departments: Department[]
  initialFilters: CatalogFilters
  basePath?: string
  hideDepartmentFilter?: boolean
  /** Org catalog shows active years only — no status dropdown. */
  hideStatusFilter?: boolean
  /** Cards-only catalog — hide grid/list switcher. */
  hideViewToggle?: boolean
  /** Gender, youth/adult, and participant age filters (family browse). */
  showFamilyFilters?: boolean
  onFiltersChange?: (next: CatalogFilters) => void
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [query, setQuery] = useState(initialFilters.q)
  const [age, setAge] = useState(initialFilters.age || "")

  useEffect(() => {
    setQuery(initialFilters.q)
  }, [initialFilters.q])

  useEffect(() => {
    setAge(initialFilters.age || "")
  }, [initialFilters.age])

  const pushFilters = useCallback(
    (next: Partial<CatalogFilters>) => {
      const merged: CatalogFilters = {
        q: next.q ?? query,
        status: next.status ?? initialFilters.status,
        department: next.department ?? initialFilters.department,
        gender: next.gender ?? initialFilters.gender ?? EMPTY_FAMILY.gender,
        audience: next.audience ?? initialFilters.audience ?? EMPTY_FAMILY.audience,
        age: next.age !== undefined ? next.age : age,
        view: next.view ?? initialFilters.view,
      }

      if (onFiltersChange) {
        onFiltersChange(merged)
        return
      }

      const params = new URLSearchParams(searchParams.toString())

      if (merged.q.trim()) {
        params.set("q", merged.q.trim())
      } else {
        params.delete("q")
      }

      if (
        !hideStatusFilter &&
        merged.status &&
        merged.status !== "all"
      ) {
        params.set("status", merged.status)
      } else {
        params.delete("status")
      }

      if (merged.department && merged.department !== "all") {
        params.set("department", merged.department)
      } else {
        params.delete("department")
      }

      if (showFamilyFilters && merged.gender && merged.gender !== "all") {
        params.set("gender", merged.gender)
      } else {
        params.delete("gender")
      }

      if (showFamilyFilters && merged.audience && merged.audience !== "all") {
        params.set("audience", merged.audience)
      } else {
        params.delete("audience")
      }

      if (showFamilyFilters && merged.age.trim()) {
        params.set("age", merged.age.trim())
      } else {
        params.delete("age")
      }

      if (merged.view === "table") {
        params.set("view", "table")
      } else {
        params.delete("view")
      }

      if (
        next.q !== undefined ||
        next.status !== undefined ||
        next.department !== undefined ||
        next.gender !== undefined ||
        next.audience !== undefined ||
        next.age !== undefined
      ) {
        params.delete("page")
      }

      const queryString = params.toString()
      startTransition(() => {
        router.push(queryString ? `${basePath}?${queryString}` : basePath)
      })
    },
    [
      age,
      basePath,
      hideStatusFilter,
      initialFilters.audience,
      initialFilters.department,
      initialFilters.gender,
      initialFilters.status,
      initialFilters.view,
      onFiltersChange,
      query,
      router,
      searchParams,
      showFamilyFilters,
    ]
  )

  useEffect(() => {
    if (onFiltersChange) return

    const timeout = window.setTimeout(() => {
      if (query === initialFilters.q) {
        return
      }

      pushFilters({ q: query })
    }, 300)

    return () => window.clearTimeout(timeout)
  }, [query, initialFilters.q, onFiltersChange, pushFilters])

  useEffect(() => {
    if (onFiltersChange || !showFamilyFilters) return

    const timeout = window.setTimeout(() => {
      if (age === (initialFilters.age || "")) {
        return
      }
      pushFilters({ age })
    }, 300)

    return () => window.clearTimeout(timeout)
  }, [
    age,
    initialFilters.age,
    onFiltersChange,
    pushFilters,
    showFamilyFilters,
  ])

  function buildViewHref(view: "cards" | "table") {
    const params = new URLSearchParams(searchParams.toString())
    if (view === "table") {
      params.set("view", "table")
    } else {
      params.delete("view")
    }
    params.delete("page")
    const queryString = params.toString()
    return queryString ? `${basePath}?${queryString}` : basePath
  }

  const viewMode = initialFilters.view

  return (
    <div
      className={cn(
        "flex flex-col gap-3",
        isPending && "opacity-70"
      )}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
          <div className="relative w-full flex-1 sm:max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => {
                const next = event.target.value
                setQuery(next)
                if (onFiltersChange) {
                  onFiltersChange({
                    q: next,
                    status: initialFilters.status,
                    department: initialFilters.department,
                    gender: initialFilters.gender || EMPTY_FAMILY.gender,
                    audience: initialFilters.audience || EMPTY_FAMILY.audience,
                    age: age,
                    view: initialFilters.view,
                  })
                }
              }}
              placeholder="Search programs..."
              className="h-10 bg-background pl-9"
            />
          </div>

          {!hideStatusFilter ? (
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
          ) : null}

          {!hideDepartmentFilter ? (
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
          ) : null}

          {showFamilyFilters ? (
            <>
              <select
                value={initialFilters.gender || "all"}
                onChange={(event) =>
                  pushFilters({ gender: event.target.value, q: query })
                }
                className="h-10 rounded-md border bg-background px-3 text-sm"
                aria-label="Filter by gender"
              >
                <option value="all">All genders</option>
                <option value="All">Both / co-ed</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>

              <select
                value={initialFilters.audience || "all"}
                onChange={(event) =>
                  pushFilters({ audience: event.target.value, q: query })
                }
                className="h-10 rounded-md border bg-background px-3 text-sm"
                aria-label="Filter by youth or adult"
              >
                <option value="all">Youth &amp; adult</option>
                <option value="youth">Youth</option>
                <option value="adult">Adult</option>
              </select>

              <Input
                type="number"
                min={0}
                max={120}
                inputMode="numeric"
                value={age}
                onChange={(event) => {
                  const next = event.target.value
                  setAge(next)
                  if (onFiltersChange) {
                    onFiltersChange({
                      q: query,
                      status: initialFilters.status,
                      department: initialFilters.department,
                      gender: initialFilters.gender || EMPTY_FAMILY.gender,
                      audience: initialFilters.audience || EMPTY_FAMILY.audience,
                      age: next,
                      view: initialFilters.view,
                    })
                  }
                }}
                placeholder="Age"
                className="h-10 w-full bg-background sm:w-24"
                aria-label="Filter by participant age"
              />
            </>
          ) : null}
        </div>

        {!hideViewToggle ? (
          <div className="inline-flex h-10 shrink-0 items-center rounded-md border bg-muted/40 p-0.5">
            {onFiltersChange ? (
              <>
                <Button
                  variant={viewMode === "cards" ? "default" : "ghost"}
                  size="icon"
                  className="h-9 w-9 rounded-[6px]"
                  type="button"
                  aria-label="Cards view"
                  onClick={() =>
                    pushFilters({ view: "cards", q: query })
                  }
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === "table" ? "default" : "ghost"}
                  size="icon"
                  className="h-9 w-9 rounded-[6px]"
                  type="button"
                  aria-label="Table view"
                  onClick={() =>
                    pushFilters({ view: "table", q: query })
                  }
                >
                  <List className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
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
              </>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}
