import Link from "next/link"
import { BookOpen, Building2, Calendar, Plus, Users } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { programCountPhrase } from "@/lib/programs/program-display-labels"
import type { ProgramListStats } from "@/lib/programs/program-offering-queries"
import { programWorkspaceHref } from "@/lib/programs/program-workspace-path"
import {
  getProgramKindTagLabel,
  type ProgramKind,
} from "@/lib/programs/program-kind"
import {
  getProgramStatusLabel,
  type ProgramStatus,
} from "@/lib/programs/program-status"
import type { Program } from "@/lib/programs/program-types"
import { cn } from "@/lib/utils"

function formatDate(value: string | null) {
  if (!value) return "—"
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (!match) return value
  const date = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  )
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  })
}

function statusBadgeClass(status: string) {
  if (status === "active") return "bg-emerald-50 text-emerald-800"
  if (status === "draft") return "bg-slate-100 text-slate-700"
  if (status === "paused") return "bg-amber-50 text-amber-800"
  if (status === "closed") return "bg-slate-200 text-slate-700"
  if (status === "archived") return "bg-zinc-100 text-zinc-600"
  return "bg-muted text-muted-foreground"
}

function statusDotClass(status: string) {
  if (status === "active") return "bg-emerald-500"
  if (status === "draft") return "bg-slate-400"
  if (status === "paused") return "bg-amber-500"
  if (status === "closed") return "bg-slate-500"
  if (status === "archived") return "bg-zinc-400"
  return "bg-muted-foreground"
}

function flyerPlaceholderColor(programId: string) {
  const colors = [
    "bg-sky-500",
    "bg-emerald-400",
    "bg-violet-500",
    "bg-amber-500",
    "bg-rose-400",
    "bg-indigo-500",
  ] as const
  let hash = 0
  for (let index = 0; index < programId.length; index += 1) {
    hash = (hash + programId.charCodeAt(index) * (index + 1)) % 997
  }
  return colors[hash % colors.length]
}

function kindBadgeClass(kind: ProgramKind) {
  return kind === "seasonal"
    ? "border-amber-200 bg-amber-50 text-amber-900"
    : "border-sky-200 bg-sky-50 text-sky-900"
}

function programHref(program: Program) {
  return programWorkspaceHref(program.id)
}

export function ProgramsAllList({
  programs,
  departmentNameById,
  statsByProgramId,
  createHref = null,
}: {
  programs: Program[]
  departmentNameById: Record<string, string>
  statsByProgramId: Record<string, ProgramListStats>
  createHref?: string | null
}) {
  if (programs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No programs yet</CardTitle>
          <CardDescription>
            Create a program to get started. Each program is tagged Academic or
            Seasonal.
          </CardDescription>
          {createHref ? (
            <div className="pt-2">
              <Button asChild size="sm">
                <Link href={createHref}>
                  <Plus className="h-4 w-4" />
                  New Program
                </Link>
              </Button>
            </div>
          ) : null}
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {programs.map((program) => {
        const departmentName = program.department_id
          ? departmentNameById[program.department_id] || "Department"
          : "No department"
        const kind = program.program_kind
        const stats = statsByProgramId[program.id] || {
          offeringCount: 0,
          enrolled: 0,
        }
        return (
          <Link key={program.id} href={programHref(program)} className="block">
            <Card className="overflow-hidden border-border/80 shadow-sm transition-colors hover:bg-muted/30">
              <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start">
                <div
                  className={cn(
                    "relative aspect-square w-16 shrink-0 overflow-hidden rounded-lg sm:w-20",
                    !program.flyer_url && flyerPlaceholderColor(program.id)
                  )}
                >
                  {program.flyer_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={program.flyer_url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <span className="text-xl font-semibold text-white/90">
                        {program.name.trim().charAt(0).toUpperCase() || "P"}
                      </span>
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-start gap-2">
                    <p className="text-base font-semibold leading-snug tracking-tight text-sky-800">
                      {program.name}
                    </p>
                    <Badge
                      variant="outline"
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[11px] font-medium",
                        kindBadgeClass(kind)
                      )}
                    >
                      {getProgramKindTagLabel(kind)}
                    </Badge>
                    <Badge
                      variant="secondary"
                      className={cn(
                        "gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium",
                        statusBadgeClass(program.status)
                      )}
                    >
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          statusDotClass(program.status)
                        )}
                      />
                      {getProgramStatusLabel(
                        (program.status as ProgramStatus) || "active"
                      )}
                    </Badge>
                  </div>

                  <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 shrink-0" />
                      <span>{departmentName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 shrink-0" />
                      <span>
                        {formatDate(program.start_date)} –{" "}
                        {formatDate(program.end_date)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-4 w-4 shrink-0" />
                      <span>{programCountPhrase(stats.offeringCount)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 shrink-0" />
                      <span>
                        {stats.enrolled} enrolled
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </Link>
        )
      })}
    </div>
  )
}
