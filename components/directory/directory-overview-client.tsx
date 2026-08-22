"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Building2,
  Home,
  Search,
  Users,
} from "lucide-react"

import { DirectoryAddMenu } from "@/components/directory/directory-add-menu"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { StatCard, StatCardsRow } from "@/components/ui/stat-card"
import {
  DIRECTORY_FAMILIES_PATH,
  DIRECTORY_ORGANIZATIONS_PATH,
  DIRECTORY_PEOPLE_PATH,
  directoryRolePath,
} from "@/lib/directory/directory-paths"
import { populatedDirectoryRoles, type DirectoryNavSummary } from "@/lib/directory/directory-roles"
import {
  searchDirectoryAction,
  type DirectorySearchHit,
} from "@/lib/directory/directory-search"
import { fetchDirectoryOverviewAction } from "@/lib/directory/directory-search"

const TYPE_LABEL: Record<DirectorySearchHit["type"], string> = {
  person: "Person",
  organization: "Organization",
  family: "Family",
}

export function DirectoryOverviewClient({
  initialSummary,
}: {
  initialSummary: DirectoryNavSummary
}) {
  const router = useRouter()
  const [summary, setSummary] = useState(initialSummary)
  const [query, setQuery] = useState("")
  const [debounced, setDebounced] = useState("")
  const [hits, setHits] = useState<DirectorySearchHit[]>([])
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(query.trim()), 300)
    return () => window.clearTimeout(timer)
  }, [query])

  useEffect(() => {
    let cancelled = false
    async function run() {
      if (debounced.length < 2) {
        setHits([])
        return
      }
      setSearching(true)
      const result = await searchDirectoryAction(debounced)
      if (cancelled) return
      setHits(result.success ? result.hits : [])
      setSearching(false)
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [debounced])

  useEffect(() => {
    let cancelled = false
    async function refresh() {
      const result = await fetchDirectoryOverviewAction()
      if (!cancelled && result.success) setSummary(result.summary)
    }
    void refresh()
    return () => {
      cancelled = true
    }
  }, [])

  const activeRoles = useMemo(
    () => populatedDirectoryRoles(summary.roles),
    [summary.roles]
  )

  const metrics = [
    {
      label: "People",
      value: summary.people,
      href: DIRECTORY_PEOPLE_PATH,
      icon: Users,
    },
    {
      label: "Families",
      value: summary.families,
      href: DIRECTORY_FAMILIES_PATH,
      icon: Home,
    },
    {
      label: "Organizations",
      value: summary.organizations,
      href: DIRECTORY_ORGANIZATIONS_PATH,
      icon: Building2,
    },
  ]

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Directory</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            People, families, organizations, and relationships across your organization.
            Group giving lives under Fund Development.
          </p>
        </div>
        <DirectoryAddMenu />
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search people, families, or organizations..."
          className="h-12 pl-12 text-base"
        />
      </div>

      {debounced.length >= 2 ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Search results</CardTitle>
            <CardDescription>
              {searching
                ? "Searching…"
                : hits.length === 0
                  ? `No matches for “${debounced}”.`
                  : `${hits.length} match${hits.length === 1 ? "" : "es"}`}
            </CardDescription>
          </CardHeader>
          <CardContent className="divide-y">
            {hits.map((hit) => (
              <button
                key={`${hit.type}-${hit.id}`}
                type="button"
                className="flex w-full items-start justify-between gap-4 py-3 text-left hover:bg-muted/40"
                onClick={() => router.push(hit.href)}
              >
                <div>
                  <p className="font-medium text-primary">{hit.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {TYPE_LABEL[hit.type]}
                    {hit.subtitle ? ` · ${hit.subtitle}` : ""}
                  </p>
                </div>
                {hit.roles.length > 0 ? (
                  <div className="flex flex-wrap justify-end gap-1">
                    {hit.roles.map((role) => (
                      <Badge key={role} variant="secondary" className="text-xs">
                        {role}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </button>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <StatCardsRow equal columns={3}>
        {metrics.map((metric) => (
          <Link key={metric.label} href={metric.href} className="min-w-0">
            <StatCard
              label={metric.label}
              value={metric.value.toLocaleString()}
              icon={metric.icon}
              layout="header"
              fill
            />
          </Link>
        ))}
      </StatCardsRow>

      {activeRoles.length > 0 ? (
        <div className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold">Active Directory Categories</h2>
            <p className="text-sm text-muted-foreground">
              Role views appear when this organization has matching records. One person or
              organization can belong to several categories.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {activeRoles.map((role) => (
              <Link key={role.key} href={directoryRolePath(role.key)}>
                <Card className="h-full transition-colors hover:border-primary/40">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{role.label}</CardTitle>
                    <CardDescription>
                      {(summary.roles[role.key] ?? 0).toLocaleString()} record
                      {(summary.roles[role.key] ?? 0) === 1 ? "" : "s"}
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="p-6 text-sm text-muted-foreground">
            Role views such as Employees, Donors, and Vendors appear here after the first matching
            record exists. Use Add to create a person or organization and assign a role.
          </CardContent>
        </Card>
      )}
    </div>
  )
}
