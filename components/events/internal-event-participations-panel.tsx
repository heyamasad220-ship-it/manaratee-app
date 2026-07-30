"use client"

import { useTransition } from "react"
import { Loader2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { updateServiceParticipationStatus } from "@/lib/service-participations/service-participation-actions"
import type {
  ServiceParticipationType,
  ServiceParticipationWithContact,
} from "@/lib/service-participations/service-participation-types"
import {
  SERVICE_PARTICIPATION_STATUS_LABELS,
  SERVICE_PARTICIPATION_TYPE_LABELS,
} from "@/lib/service-participations/service-participation-types"

type InternalEventParticipationsPanelProps = {
  participations: ServiceParticipationWithContact[]
  canManage: boolean
  participationType?: ServiceParticipationType
  title?: string
  description?: string
  emptyMessage?: string
}

export function InternalEventParticipationsPanel({
  participations,
  canManage,
  participationType,
  title = "Sign-ups",
  description = "Volunteers, childcare providers, and vendors who signed up. All submissions start pending until you confirm them.",
  emptyMessage = "No sign-ups yet.",
}: InternalEventParticipationsPanelProps) {
  const [isPending, startTransition] = useTransition()

  function updateStatus(participationId: string, status: "confirmed" | "declined" | "cancelled") {
    startTransition(async () => {
      await updateServiceParticipationStatus({ participationId, status })
    })
  }

  const filtered = participationType
    ? participations.filter((row) => row.participation_type === participationType)
    : participations

  const grouped = participationType
    ? { [participationType]: filtered }
    : {
        volunteer: participations.filter((row) => row.participation_type === "volunteer"),
        childcare_provider: participations.filter(
          (row) => row.participation_type === "childcare_provider"
        ),
        vendor: participations.filter((row) => row.participation_type === "vendor"),
      }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent className="space-y-6">
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        ) : (
          Object.entries(grouped).map(([type, rows]) =>
            rows.length === 0 ? null : (
              <div key={type} className="space-y-2">
                {!participationType ? (
                  <h3 className="text-sm font-medium">
                    {
                      SERVICE_PARTICIPATION_TYPE_LABELS[
                        type as keyof typeof SERVICE_PARTICIPATION_TYPE_LABELS
                      ]
                    }
                  </h3>
                ) : null}
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Details</TableHead>
                      <TableHead>Status</TableHead>
                      {canManage ? <TableHead className="text-right">Actions</TableHead> : null}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{row.contact_name}</p>
                            {row.contact_email ? (
                              <p className="text-xs text-muted-foreground">{row.contact_email}</p>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {row.volunteer_role ? `Role: ${row.volunteer_role}` : null}
                          {row.notes ? <p>{row.notes}</p> : !row.volunteer_role ? "—" : null}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {SERVICE_PARTICIPATION_STATUS_LABELS[row.status]}
                          </Badge>
                        </TableCell>
                        {canManage ? (
                          <TableCell className="text-right">
                            {row.status === "pending" ? (
                              <div className="flex justify-end gap-2">
                                <Button
                                  size="sm"
                                  disabled={isPending}
                                  onClick={() => updateStatus(row.id, "confirmed")}
                                >
                                  Confirm
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={isPending}
                                  onClick={() => updateStatus(row.id, "declined")}
                                >
                                  Decline
                                </Button>
                              </div>
                            ) : isPending ? (
                              <Loader2 className="ml-auto h-4 w-4 animate-spin" />
                            ) : null}
                          </TableCell>
                        ) : null}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )
          )
        )}
      </CardContent>
    </Card>
  )
}

export function InternalEventModuleDisabledState({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardHeader>
    </Card>
  )
}
