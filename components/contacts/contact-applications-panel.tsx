"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import {
  fetchApplicationTypeDefinitions,
  fetchContactApplications,
} from "@/lib/applications/application-actions"
import {
  getTypeIcon,
  getTypeLabel,
  type ApplicationRecord,
  type ApplicationTypeDefinition,
} from "@/lib/applications/application-types"
import { ApplicationStatusBadge } from "@/components/applications/application-status-badge"

export function ContactApplicationsPanel({ contactId }: { contactId: string }) {
  const [applications, setApplications] = useState<ApplicationRecord[]>([])
  const [typeRegistry, setTypeRegistry] = useState<Record<string, ApplicationTypeDefinition>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const [apps, registry] = await Promise.all([
          fetchContactApplications(contactId),
          fetchApplicationTypeDefinitions(),
        ])
        setApplications(apps)
        setTypeRegistry(registry)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load applications")
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [contactId])

  const grouped = useMemo(() => {
    const groups: Record<string, ApplicationRecord[]> = {}
    for (const app of applications) {
      groups[app.application_type] = groups[app.application_type] ?? []
      groups[app.application_type].push(app)
    }
    return groups
  }, [applications])

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading applications...
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardContent className="pt-6 text-sm text-red-700">{error}</CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Applications</CardTitle>
          <CardDescription>Application history linked to this contact</CardDescription>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/applications/all?contact_id=${contactId}`}>View all</Link>
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {applications.length === 0 && (
          <p className="text-sm text-muted-foreground">No applications linked to this contact yet.</p>
        )}

        {Object.entries(grouped).map(([typeId, items]) => {
          const TypeIcon = getTypeIcon(typeId)
          return (
            <div key={typeId} className="rounded-lg border p-4">
              <div className="mb-3 flex items-center gap-2">
                <TypeIcon className="h-4 w-4 text-muted-foreground" />
                <p className="font-medium">{getTypeLabel(typeId, typeRegistry)}</p>
              </div>
              <div className="flex flex-col gap-2">
                {items.map((app) => (
                  <div
                    key={app.id}
                    className="flex flex-col gap-2 rounded-md bg-muted/40 p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        Submitted{" "}
                        {app.submitted_at
                          ? new Date(app.submitted_at).toLocaleDateString()
                          : "—"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Updated {new Date(app.updated_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <ApplicationStatusBadge status={app.status} />
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/applications/${app.id}`}>Open</Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
