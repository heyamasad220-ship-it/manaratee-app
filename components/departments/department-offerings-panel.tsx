"use client"

import { useCallback, useEffect, useState, useTransition } from "react"
import Link from "next/link"
import { BookOpen, ExternalLink, Loader2, Plus } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  createDepartmentOfferingAction,
  createDepartmentProgramAction,
  fetchDepartmentOfferingsAction,
  type DepartmentOfferingRow,
  type DepartmentProgramOption,
} from "@/lib/departments/department-offerings"
import { programOfferingManageHref } from "@/lib/programs/program-offering-paths"
import {
  PROGRAM_OFFERING_STATUS_LABELS,
  type ProgramOfferingStatus,
  type ProgramOfferingType,
} from "@/lib/programs/program-offering-types"

function formatDate(value: string | null) {
  if (!value) return "—"
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

const OFFERING_TYPE_OPTIONS: { value: ProgramOfferingType; label: string }[] = [
  { value: "academic_year", label: "Academic year" },
  { value: "summer", label: "Summer" },
  { value: "season", label: "Season" },
  { value: "standard", label: "Standard" },
  { value: "recurring", label: "Recurring" },
]

export function DepartmentOfferingsPanel({
  departmentId,
  departmentName,
}: {
  departmentId: string
  departmentName: string
}) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [programs, setPrograms] = useState<DepartmentProgramOption[]>([])
  const [offerings, setOfferings] = useState<DepartmentOfferingRow[]>([])
  const [createOpen, setCreateOpen] = useState(false)
  const [programOpen, setProgramOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const result = await fetchDepartmentOfferingsAction(departmentId)
    if (!result.success) {
      setError(result.error)
      setPrograms([])
      setOfferings([])
      setLoading(false)
      return
    }
    setPrograms(result.programs)
    setOfferings(result.offerings)
    setLoading(false)
  }, [departmentId])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <BookOpen className="size-4" />
              Offerings
            </CardTitle>
            <CardDescription>
              Courses and seasonal runs for {departmentName}. Create offerings here each year;
              Catalog under Programs reads from the same data. Open Manage for fees, registration,
              and details.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => setProgramOpen(true)}>
              Add program
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => setCreateOpen(true)}
              disabled={programs.length === 0}
            >
              <Plus className="mr-1.5 size-4" />
              Add offering
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Loading offerings...
            </p>
          ) : error ? (
            <p className="py-6 text-sm text-destructive">{error}</p>
          ) : programs.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No programs linked to this department yet. Add a program (for example &quot;
              {departmentName} Courses&quot;), then add offerings like Tajweed Beginner for this
              year.
            </p>
          ) : offerings.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No offerings yet. Add an offering for this academic year or season.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Offering</TableHead>
                    <TableHead>Program</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Dates</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[100px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {offerings.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell className="text-muted-foreground">{row.programName}</TableCell>
                      <TableCell className="capitalize text-muted-foreground">
                        {row.offeringType.replace(/_/g, " ")}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(row.startDate)} – {formatDate(row.endDate)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="font-normal">
                          {PROGRAM_OFFERING_STATUS_LABELS[row.status] || row.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button type="button" size="sm" variant="outline" asChild>
                          <Link href={programOfferingManageHref(row.programId, row.id)}>
                            Manage
                            <ExternalLink className="ml-1.5 size-3.5" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <CreateOfferingDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        departmentId={departmentId}
        programs={programs}
        onSaved={async () => {
          setCreateOpen(false)
          await load()
        }}
      />

      <CreateProgramDialog
        open={programOpen}
        onOpenChange={setProgramOpen}
        departmentId={departmentId}
        departmentName={departmentName}
        onSaved={async () => {
          setProgramOpen(false)
          await load()
        }}
      />
    </>
  )
}

function CreateOfferingDialog({
  open,
  onOpenChange,
  departmentId,
  programs,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  departmentId: string
  programs: DepartmentProgramOption[]
  onSaved: () => Promise<void>
}) {
  const [programId, setProgramId] = useState("")
  const [name, setName] = useState("")
  const [offeringType, setOfferingType] = useState<ProgramOfferingType>("academic_year")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [status, setStatus] = useState<ProgramOfferingStatus>("draft")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (!open) return
    setProgramId(programs[0]?.id || "")
    setName("")
    setOfferingType("academic_year")
    setStartDate("")
    setEndDate("")
    setStatus("draft")
    setError(null)
  }, [open, programs])

  function handleSave() {
    if (!programId) {
      setError("Select a program.")
      return
    }
    if (!name.trim()) {
      setError("Enter an offering name.")
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await createDepartmentOfferingAction({
        departmentId,
        programId,
        name,
        offeringType,
        startDate: startDate || null,
        endDate: endDate || null,
        status,
      })
      if (!result.success) {
        setError(result.error)
        return
      }
      await onSaved()
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add offering</DialogTitle>
          <DialogDescription>
            Create a course or seasonal run for this year (for example Tajweed Beginner 2026–27).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {error ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          ) : null}
          <div className="space-y-2">
            <Label>Program</Label>
            <Select value={programId} onValueChange={setProgramId} disabled={isPending}>
              <SelectTrigger>
                <SelectValue placeholder="Select program" />
              </SelectTrigger>
              <SelectContent>
                {programs.map((program) => (
                  <SelectItem key={program.id} value={program.id}>
                    {program.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="offering-name">Offering name</Label>
            <Input
              id="offering-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={isPending}
              placeholder="e.g. Tajweed Beginner 2026–27"
            />
          </div>
          <div className="space-y-2">
            <Label>Type</Label>
            <Select
              value={offeringType}
              onValueChange={(value) => setOfferingType(value as ProgramOfferingType)}
              disabled={isPending}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OFFERING_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="offering-start">Start date</Label>
              <Input
                id="offering-start"
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                disabled={isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="offering-end">End date</Label>
              <Input
                id="offering-end"
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                disabled={isPending}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={status}
              onValueChange={(value) => setStatus(value as ProgramOfferingStatus)}
              disabled={isPending}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={isPending}>
            {isPending ? "Creating..." : "Create offering"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CreateProgramDialog({
  open,
  onOpenChange,
  departmentId,
  departmentName,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  departmentId: string
  departmentName: string
  onSaved: () => Promise<void>
}) {
  const [name, setName] = useState(`${departmentName} Courses`)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (!open) return
    setName(`${departmentName} Courses`)
    setError(null)
  }, [open, departmentName])

  function handleSave() {
    if (!name.trim()) {
      setError("Enter a program name.")
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await createDepartmentProgramAction({
        departmentId,
        name,
      })
      if (!result.success) {
        setError(result.error)
        return
      }
      await onSaved()
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add program</DialogTitle>
          <DialogDescription>
            Programs group offerings under this department (for example &quot;{departmentName}{" "}
            Courses&quot; or &quot;Qur&apos;an for Little Hearts&quot;).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {error ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="program-name">Program name</Label>
            <Input
              id="program-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={isPending}
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={isPending}>
            {isPending ? "Creating..." : "Create program"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
