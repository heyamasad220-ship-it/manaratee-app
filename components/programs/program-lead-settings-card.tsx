"use client"

import * as React from "react"
import { Loader2 } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  listProgramLeadCandidatesAction,
  type ProgramLeadCandidate,
} from "@/lib/programs/program-lead-actions"

const UNASSIGNED_LEAD = "__unassigned__"

export function ProgramLeadSettingsCard({
  programId,
  currentLeadContactId,
  leadContactId,
  onLeadContactIdChange,
}: {
  programId: string
  currentLeadContactId?: string | null
  leadContactId: string
  onLeadContactIdChange: (contactId: string) => void
}) {
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [candidates, setCandidates] = React.useState<ProgramLeadCandidate[]>([])
  const [canManage, setCanManage] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false
    async function loadCandidates() {
      setLoading(true)
      setError(null)
      const result = await listProgramLeadCandidatesAction(programId)
      if (cancelled) return
      if (!result.success) {
        setCanManage(false)
        setCandidates([])
        setError(result.error)
        setLoading(false)
        return
      }
      setCanManage(true)
      setCandidates(result.candidates)
      setLoading(false)
    }
    void loadCandidates()
    return () => {
      cancelled = true
    }
  }, [programId])

  const currentName =
    candidates.find((candidate) => candidate.contactId === currentLeadContactId)
      ?.fullName || null

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Program Lead</CardTitle>
          <CardDescription>
            One person who can open this program and see every offering.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading…
        </CardContent>
      </Card>
    )
  }

  if (!canManage) {
    if (error && !/permission/i.test(error)) {
      return (
        <Card>
          <CardHeader>
            <CardTitle>Program Lead</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-red-700">{error}</p>
          </CardContent>
        </Card>
      )
    }
    return (
      <Card>
        <CardHeader>
          <CardTitle>Program Lead</CardTitle>
          <CardDescription>
            One person who can open this program and see every offering.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {currentLeadContactId
              ? currentName
                ? `${currentName} is Program Lead.`
                : "A Program Lead is assigned."
              : "No Program Lead is assigned."}
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Program Lead</CardTitle>
        <CardDescription>
          Like Department Head, but only for this year or season — not the whole
          department. Camp group leads who cover a few classes stay Coordinator
          (or Primary instructor) on those offerings.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <Label htmlFor="settings-program-lead">Lead name</Label>
        <Select
          value={leadContactId || UNASSIGNED_LEAD}
          onValueChange={(value) =>
            onLeadContactIdChange(value === UNASSIGNED_LEAD ? "" : value)
          }
        >
          <SelectTrigger id="settings-program-lead" className="w-full">
            <SelectValue placeholder="Not assigned" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={UNASSIGNED_LEAD}>Not assigned</SelectItem>
            {candidates.map((candidate) => (
              <SelectItem key={candidate.contactId} value={candidate.contactId}>
                {candidate.fullName}
                {candidate.employmentStatus &&
                candidate.employmentStatus.toLowerCase() !== "active"
                  ? ` (${candidate.employmentStatus})`
                  : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {candidates.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Add employees to this department first, then choose the Program Lead
            here.
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}
