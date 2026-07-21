"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, Pencil, Plus } from "lucide-react"
import { fetchApplicationTypeDefinitions } from "@/lib/applications/application-actions"
import {
  buildTypeRegistry,
  getTypeIcon,
  MODULE_OWNER_LABELS,
  type ApplicationTypeDefinition,
  type ModuleOwner,
} from "@/lib/applications/application-types"
import { peopleManagementApplicationsUrl } from "@/lib/applications/application-routes"

const PM_HR_TEMPLATE_TYPE_IDS = ["committee_member", "childcare_provider"] as const

export function ApplicationTemplatesPanel({
  moduleOwner,
  basePath: _basePath,
  hubApplicationTypes,
}: {
  moduleOwner: ModuleOwner
  basePath: string
  hubApplicationTypes: readonly string[]
}) {
  const [typeRegistry, setTypeRegistry] = useState<Record<string, ApplicationTypeDefinition>>(() =>
    buildTypeRegistry(null)
  )
  const [refreshing, setRefreshing] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadTypes() {
      setRefreshing(true)
      setError(null)

      try {
        const registry = await Promise.race([
          fetchApplicationTypeDefinitions(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Request timed out")), 10_000)
          ),
        ])

        if (!cancelled) {
          setTypeRegistry(registry)
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to refresh application templates"
          )
        }
      } finally {
        if (!cancelled) {
          setRefreshing(false)
        }
      }
    }

    void loadTypes()

    return () => {
      cancelled = true
    }
  }, [])

  const templateTypes = useMemo(() => {
    const allowed = new Set(hubApplicationTypes)

    if (moduleOwner === "workforce" || moduleOwner === "hr") {
      const isPeopleManagementHub = PM_HR_TEMPLATE_TYPE_IDS.some((typeId) => allowed.has(typeId))
      if (isPeopleManagementHub) {
        allowed.add("employment")
      }
    }

    return Object.values(typeRegistry)
      .filter((type) => type.moduleOwner === moduleOwner && allowed.has(type.id))
      .sort((a, b) => a.sortOrder - b.sortOrder)
  }, [hubApplicationTypes, moduleOwner, typeRegistry])

  const moduleLabel = MODULE_OWNER_LABELS[moduleOwner].toLowerCase()

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-base font-semibold">Application Templates</h3>
          <p className="text-sm text-muted-foreground">
            Define the forms, requirements, and fields for each {moduleLabel} application type.
          </p>
        </div>
        <Button disabled>
          <Plus className="mr-2 h-4 w-4" />
          New Template
        </Button>
        {refreshing && (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label="Refreshing templates" />
        )}
      </div>

      {error && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-6 text-sm text-amber-800">
            Showing default templates. {error}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {templateTypes.map((type) => {
            const TypeIcon = getTypeIcon(type.id)
            const isHubType = hubApplicationTypes.includes(type.id)

            return (
              <Card key={type.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                        <TypeIcon className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{type.label}</CardTitle>
                        <CardDescription className="mt-1">
                          {type.description ?? "No description yet."}
                        </CardDescription>
                      </div>
                    </div>
                    <Badge variant="secondary">{isHubType ? "Hub" : "Extended"}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4 text-sm text-muted-foreground">
                    Form builder coming next — configure sections, required fields, and applicant
                    instructions for this template.
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" disabled>
                      <Pencil className="mr-2 h-4 w-4" />
                      Configure Fields
                    </Button>
                    <Button variant="ghost" size="sm" asChild>
                      <Link
                        href={peopleManagementApplicationsUrl({
                          pageTab: "submissions",
                          applicationType: type.id,
                        })}
                      >
                        View Submissions
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
      </div>

      {templateTypes.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No application templates found for {moduleLabel}.
          </CardContent>
        </Card>
      )}
    </div>
  )
}
