"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, Pencil, Plus } from "lucide-react"
import { fetchApplicationTypeDefinitions } from "@/lib/applications/application-actions"
import {
  getTypeIcon,
  type ApplicationTypeDefinition,
} from "@/lib/applications/application-types"
import { peopleManagementApplicationsUrl } from "@/lib/applications/application-routes"
import { PEOPLE_MANAGEMENT_MODULE_LABEL } from "@/lib/hr/hr-module-label"

const PM_TEMPLATE_TYPE_IDS = [
  "volunteer",
  "employment",
  "committee_member",
  "childcare_provider",
] as const

export function ApplicationTemplatesPanel({
  hubApplicationTypes,
}: {
  hubApplicationTypes: readonly string[]
}) {
  const [typeRegistry, setTypeRegistry] = useState<Record<string, ApplicationTypeDefinition>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadTypes = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const registry = await fetchApplicationTypeDefinitions()
      setTypeRegistry(registry)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load application templates")
      setTypeRegistry({})
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadTypes()
  }, [loadTypes])

  const templateTypes = useMemo(() => {
    const allowed = new Set([...hubApplicationTypes, ...PM_TEMPLATE_TYPE_IDS])
    return Object.values(typeRegistry)
      .filter((type) => type.moduleOwner === "hr" && allowed.has(type.id))
      .sort((a, b) => a.sortOrder - b.sortOrder)
  }, [hubApplicationTypes, typeRegistry])

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-base font-semibold">Application Templates</h3>
          <p className="text-sm text-muted-foreground">
            Define the forms, requirements, and fields for each {PEOPLE_MANAGEMENT_MODULE_LABEL.toLowerCase()}{" "}
            application type.
          </p>
        </div>
        <Button disabled>
          <Plus className="mr-2 h-4 w-4" />
          New Template
        </Button>
      </div>

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6 text-sm text-red-700">
            <strong>Error:</strong> {error}
          </CardContent>
        </Card>
      )}

      {loading ? (
        <Card>
          <CardContent className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading templates...
          </CardContent>
        </Card>
      ) : (
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
      )}

      {!loading && templateTypes.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No application templates found for {PEOPLE_MANAGEMENT_MODULE_LABEL.toLowerCase()}.
          </CardContent>
        </Card>
      )}
    </div>
  )
}
