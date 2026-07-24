import Link from "next/link"
import type { ReactNode } from "react"
import {
  Archive,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Plus,
  Tag,
  Users,
} from "lucide-react"

import { ProgramCardActions } from "@/components/programs/program-card-actions"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  formatEnrollmentCapacityLabel,
  type ProgramCatalogCapacity,
} from "@/lib/programs/program-catalog-capacity"
import {
  YEAR_SEASON_LABEL,
  YEAR_SEASON_LABEL_PLURAL,
  programCountPhrase,
} from "@/lib/programs/program-display-labels"
import {
  formatProgramCatalogDate,
  getProgramCatalogEnrollmentColor,
  getProgramCatalogEnrollmentPercent,
  getProgramCatalogFlyerPlaceholderColor,
  getProgramCatalogOfferingCount,
  getProgramCatalogStatusBadgeClass,
  getProgramCatalogStatusBadgeVariant,
  getProgramCatalogStatusDotClass,
  resolveProgramCatalogCapacity,
} from "@/lib/programs/program-catalog-helpers"
import { formatProgramAgeEligibility } from "@/lib/programs/program-eligibility-display"
import {
  getProgramRegistrationAvailabilityLabel,
  isProgramAcceptingRegistration,
} from "@/lib/programs/program-enrollment-availability"
import { getProgramStatusLabel, type ProgramStatus } from "@/lib/programs/program-status"
import type { Program } from "@/lib/programs/program-types"
import { cn } from "@/lib/utils"

function ProgramStatusBadge({ status }: { status: ProgramStatus }) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        "gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium",
        getProgramCatalogStatusBadgeClass(status)
      )}
    >
      <span
        className={cn("h-1.5 w-1.5 rounded-full", getProgramCatalogStatusDotClass(status))}
      />
      {getProgramStatusLabel(status)}
    </Badge>
  )
}

function ProgramCard({
  program,
  offeringCount,
  catalogCapacity,
}: {
  program: Program
  offeringCount: number
  catalogCapacity: ProgramCatalogCapacity
}) {
  const percent = getProgramCatalogEnrollmentPercent(
    program.enrolled,
    catalogCapacity
  )
  const acceptingRegistration = isProgramAcceptingRegistration(program)
  const availabilityLabel = getProgramRegistrationAvailabilityLabel(program)
  const ageLabel = formatProgramAgeEligibility(program)
  const audienceLabel = `${program.gender || "All"} • ${ageLabel}`
  const enrollmentLabel = formatEnrollmentCapacityLabel(
    program.enrolled,
    catalogCapacity
  )

  return (
    <Card className="overflow-hidden border-border/80 shadow-sm">
      <div className="flex gap-4 p-4">
        <div
          className={cn(
            "relative aspect-square w-24 shrink-0 overflow-hidden rounded-lg sm:w-28",
            !program.flyer_url && getProgramCatalogFlyerPlaceholderColor(program.id)
          )}
        >
          {program.flyer_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={program.flyer_url}
              alt={`${program.name} flyer`}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <span className="text-2xl font-semibold text-white/90">
                {program.name.trim().charAt(0).toUpperCase() || "P"}
              </span>
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 space-y-1.5">
              <p className="text-base font-semibold leading-snug tracking-tight">
                {program.name}
              </p>
              <ProgramStatusBadge status={program.status} />
            </div>
            <div className="relative shrink-0">
              <ProgramCardActions
                programId={program.id}
                programName={program.name}
                programStatus={program.status}
              />
            </div>
          </div>

          <div className="space-y-1.5 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 shrink-0" />
              <span>
                {formatProgramCatalogDate(program.start_date)} -{" "}
                {formatProgramCatalogDate(program.end_date)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 shrink-0" />
              <span className="truncate">{audienceLabel}</span>
            </div>
            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4 shrink-0" />
              <span>
                {programCountPhrase(offeringCount)}
              </span>
            </div>
          </div>

          <div>
            <div className="mb-1 flex justify-between text-sm">
              <span className="text-muted-foreground">Enrollment</span>
              <span className="font-medium tabular-nums">{enrollmentLabel}</span>
            </div>

            <p
              className={cn(
                "mb-2 text-xs font-medium",
                acceptingRegistration
                  ? "text-emerald-700"
                  : "text-foreground/80"
              )}
            >
              {availabilityLabel}
            </p>

            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  acceptingRegistration
                    ? getProgramCatalogEnrollmentColor(
                        program.enrolled,
                        catalogCapacity
                      )
                    : "bg-muted-foreground/30"
                )}
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}

function ProgramsTable({
  programs,
  capacityByProgramId,
}: {
  programs: Program[]
  capacityByProgramId:
    | Map<string, ProgramCatalogCapacity>
    | Record<string, ProgramCatalogCapacity>
}) {
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{YEAR_SEASON_LABEL}</TableHead>
              <TableHead>Dates</TableHead>
              <TableHead>Enrollment</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[72px]">Actions</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {programs.map((program) => {
              const catalogCapacity = resolveProgramCatalogCapacity(
                program,
                capacityByProgramId
              )
              return (
                <TableRow key={program.id}>
                  <TableCell>
                    <p className="font-medium">{program.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {program.description || "No description"}
                    </p>
                  </TableCell>

                  <TableCell className="text-muted-foreground">
                    {formatProgramCatalogDate(program.start_date)} -{" "}
                    {formatProgramCatalogDate(program.end_date)}
                  </TableCell>

                  <TableCell>
                    {formatEnrollmentCapacityLabel(
                      program.enrolled,
                      catalogCapacity
                    )}
                  </TableCell>

                  <TableCell>
                    <Badge
                      variant={getProgramCatalogStatusBadgeVariant(program.status)}
                    >
                      {getProgramStatusLabel(program.status)}
                    </Badge>
                  </TableCell>

                  <TableCell>
                    <ProgramCardActions
                      programId={program.id}
                      programName={program.name}
                      programStatus={program.status}
                    />
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function CatalogPagination({
  page,
  totalPages,
  totalCount,
  pageSize,
  buildPageHref,
  onPageChange,
}: {
  page: number
  totalPages: number
  totalCount: number
  pageSize: number
  buildPageHref?: (page: number) => string
  onPageChange?: (page: number) => void
}) {
  if (totalCount === 0) return null

  const start = (page - 1) * pageSize + 1
  const end = Math.min(page * pageSize, totalCount)

  function PageControl({
    targetPage,
    children,
    ariaLabel,
    disabled,
  }: {
    targetPage: number
    children: ReactNode
    ariaLabel?: string
    disabled?: boolean
  }) {
    const isActive = targetPage === page
    const href = buildPageHref?.(targetPage)

    if (onPageChange) {
      return (
        <Button
          variant="outline"
          size="icon"
          className={cn(
            "h-8 w-8",
            isActive && "border-primary bg-primary/10 text-primary"
          )}
          disabled={disabled || isActive}
          aria-label={ariaLabel}
          onClick={() => onPageChange(targetPage)}
        >
          {children}
        </Button>
      )
    }

    return (
      <Button
        variant="outline"
        size="icon"
        className={cn(
          "h-8 w-8",
          isActive && "border-primary bg-primary/10 text-primary"
        )}
        disabled={disabled || isActive}
        asChild={!disabled && !isActive && Boolean(href)}
        aria-label={ariaLabel}
      >
        {!disabled && !isActive && href ? (
          <Link href={href}>{children}</Link>
        ) : (
          <span>{children}</span>
        )}
      </Button>
    )
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground">
        Showing {start} to {end} of {totalCount} program
        {totalCount === 1 ? "" : "s"}
      </p>

      <div className="flex items-center gap-1">
        <PageControl
          targetPage={page - 1}
          disabled={page <= 1}
          ariaLabel="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </PageControl>

        {Array.from({ length: totalPages }, (_, index) => {
          const pageNumber = index + 1
          return (
            <PageControl key={pageNumber} targetPage={pageNumber}>
              {pageNumber}
            </PageControl>
          )
        })}

        <PageControl
          targetPage={page + 1}
          disabled={page >= totalPages}
          ariaLabel="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </PageControl>
      </div>
    </div>
  )
}

export type ProgramCatalogViewProps = {
  programs: Program[]
  offeringCounts: Map<string, number> | Record<string, number>
  capacityByProgramId:
    | Map<string, ProgramCatalogCapacity>
    | Record<string, ProgramCatalogCapacity>
  viewMode: "cards" | "table"
  page: number
  totalPages: number
  totalCount: number
  pageSize: number
  buildPageHref?: (page: number) => string
  onPageChange?: (page: number) => void
  createHref?: string
  createLabel?: string
  emptyTitle?: string
  emptyDescription?: string
  filters?: ReactNode
  /** When false, omit the title row (department workspace already has chrome). */
  showTitle?: boolean
  title?: string
  description?: string
}

/** Shared Programs Catalog list — used by `/programs/catalog` and department Offerings. */
export function ProgramCatalogView({
  programs,
  offeringCounts,
  capacityByProgramId,
  viewMode,
  page,
  totalPages,
  totalCount,
  pageSize,
  buildPageHref,
  onPageChange,
  createHref = "/programs/create",
  createLabel = `Create ${YEAR_SEASON_LABEL}`,
  emptyTitle = `No ${YEAR_SEASON_LABEL_PLURAL.toLowerCase()} found`,
  emptyDescription = `Create a ${YEAR_SEASON_LABEL.toLowerCase()} or adjust your filters.`,
  filters,
  showTitle = true,
  title = YEAR_SEASON_LABEL_PLURAL,
  description = `Manage ${YEAR_SEASON_LABEL_PLURAL.toLowerCase()}, classes, camps, and activities.`,
}: ProgramCatalogViewProps) {
  return (
    <div className="flex flex-col gap-6">
      {showTitle ? (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            <p className="text-muted-foreground">{description}</p>
          </div>

          <Button asChild>
            <Link href={createHref}>
              <Plus className="mr-2 h-4 w-4" />
              {createLabel}
            </Link>
          </Button>
        </div>
      ) : (
        <div className="flex justify-end">
          <Button asChild>
            <Link href={createHref}>
              <Plus className="mr-2 h-4 w-4" />
              {createLabel}
            </Link>
          </Button>
        </div>
      )}

      {filters}

      {totalCount === 0 ? (
        <Card className="flex flex-col items-center justify-center py-12">
          <Archive className="mb-4 h-12 w-12 text-muted-foreground/50" />
          <h3 className="text-lg font-medium">{emptyTitle}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{emptyDescription}</p>

          <Button className="mt-4" asChild>
            <Link href={createHref}>
              <Plus className="mr-2 h-4 w-4" />
              {createLabel}
            </Link>
          </Button>
        </Card>
      ) : viewMode === "table" ? (
        <>
          <ProgramsTable
            programs={programs}
            capacityByProgramId={capacityByProgramId}
          />
          <CatalogPagination
            page={page}
            totalPages={totalPages}
            totalCount={totalCount}
            pageSize={pageSize}
            buildPageHref={buildPageHref}
            onPageChange={onPageChange}
          />
        </>
      ) : (
        <>
          <div className="grid gap-5 md:grid-cols-2">
            {programs.map((program) => (
              <ProgramCard
                key={program.id}
                program={program}
                offeringCount={getProgramCatalogOfferingCount(
                  program.id,
                  offeringCounts
                )}
                catalogCapacity={resolveProgramCatalogCapacity(
                  program,
                  capacityByProgramId
                )}
              />
            ))}
          </div>
          <CatalogPagination
            page={page}
            totalPages={totalPages}
            totalCount={totalCount}
            pageSize={pageSize}
            buildPageHref={buildPageHref}
            onPageChange={onPageChange}
          />
        </>
      )}
    </div>
  )
}
