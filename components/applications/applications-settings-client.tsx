"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2 } from "lucide-react"
import { fetchApplicationTypeDefinitions } from "@/lib/applications/application-actions"
import {
  DEFAULT_APPLICATION_TYPES,
  MODULE_OWNER_LABELS,
  type ApplicationTypeDefinition,
} from "@/lib/applications/application-types"

export function ApplicationsSettingsClient() {
  const [types, setTypes] = useState<ApplicationTypeDefinition[]>(DEFAULT_APPLICATION_TYPES)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const registry = await fetchApplicationTypeDefinitions()
      setTypes(Object.values(registry).sort((a, b) => a.sortOrder - b.sortOrder))
      setLoading(false)
    }
    void load()
  }, [])

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-12 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading application settings...
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Application Types</CardTitle>
          <CardDescription>
            Registered application types and their module owners. New types can be added in the
            database without code changes.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {types.map((type) => (
            <div
              key={type.id}
              className="flex flex-col gap-2 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-medium">{type.label}</p>
                <p className="text-sm text-muted-foreground">{type.description}</p>
                <p className="mt-1 text-xs text-muted-foreground">ID: {type.id}</p>
              </div>
              <Badge variant="outline">{MODULE_OWNER_LABELS[type.moduleOwner]}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Workflow</CardTitle>
          <CardDescription>Supported application statuses and actions</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
          <p>Draft → Submitted → Pending Review → Approved / Rejected / Withdrawn</p>
          <p>All actions are recorded in application history with reviewer and timestamp.</p>
        </CardContent>
      </Card>
    </div>
  )
}
