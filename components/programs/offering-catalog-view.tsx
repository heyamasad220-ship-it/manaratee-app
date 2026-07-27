import type { ReactNode } from "react"
import { Calendar, ChevronLeft, ChevronRight, Users } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  formatOfferingEnrollmentLabel,
  getOfferingEnrollmentPercent,
} from "@/lib/programs/program-catalog-capacity"
import {
  formatProgramCatalogDate,
  getProgramCatalogEnrollmentColor,
  getProgramCatalogStatusBadgeClass,
  getProgramCatalogStatusDotClass,
  PROGRAM_CATALOG_PAGE_SIZE,
} from "@/lib/programs/program-catalog-helpers"
import { formatProgramAgeEligibility, formatProgramGenderLabel } from "@/lib/programs/program-eligibility-display"
import { isOfferingEnrollmentOpen } from "@/lib/programs/program-offering-display"
import { PROGRAM_OFFERING_STATUS_LABELS } from "@/lib/programs/program-offering-types"
import type { OfferingCatalogCard } from "@/lib/programs/offering-catalog-queries"
import { catalogCapacityFromProgramTotal } from "@/lib/programs/program-catalog-capacity"
import { cn } from "@/lib/utils"

const DEFAULT_PLACEHOLDER_COLOR = "#2563eb"

function normalizeHexColor(value: string | null | undefined) {
  if (!value) return null
  const trimmed = value.trim()
  return /^#[0-9A-Fa-f]{6}$/.test(trimmed) ? trimmed : null
}

function OfferingStatusBadge({ status }: { status: OfferingCatalogCard["status"] }) {
  const programLikeStatus =
    status === "active" ? "active" : status === "archived" ? "archived" : "draft"

  return (
    <Badge
      variant="secondary"
      className={cn(
        "gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium",
        getProgramCatalogStatusBadgeClass(programLikeStatus as "active")
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          getProgramCatalogStatusDotClass(programLikeStatus as "active")
        )}
      />
      {PROGRAM_OFFERING_STATUS_LABELS[status]}
    </Badge>
  )
}

function OfferingCatalogCardView({ offering }: { offering: OfferingCatalogCard }) {
  const enrollmentLabel = formatOfferingEnrollmentLabel(offering.enrolled, offering)
  const percent = getOfferingEnrollmentPercent(offering.enrolled, offering)
  const capacityForColor = catalogCapacityFromProgramTotal(
    offering.capacity_mode === "limited" ? Number(offering.capacity || 0) : 0
  )
  const acceptingRegistration =
    offering.status === "active" &&
    isOfferingEnrollmentOpen({
      enrollment_open_date: offering.display_enrollment_open_date,
      enrollment_close_date: offering.display_enrollment_close_date,
    }) &&
    !(
      offering.capacity_mode === "limited" &&
      Number(offering.capacity || 0) > 0 &&
      offering.enrolled >= Number(offering.capacity || 0)
    )

  const ageLabel = formatProgramAgeEligibility({
    min_age: offering.display_min_age,
    max_age: offering.display_max_age,
  })
  const audienceLabel = `${formatProgramGenderLabel(offering.display_gender)} • ${ageLabel}`
  const pickedColor = normalizeHexColor(offering.background_color)

  return (
    <Card className="overflow-hidden border-border/80 shadow-sm">
      <div className="flex gap-4 p-4">
        <div
          className="relative aspect-square w-24 shrink-0 overflow-hidden rounded-lg sm:w-28"
          style={
            offering.flyer_url
              ? undefined
              : {
                  backgroundColor:
                    pickedColor || DEFAULT_PLACEHOLDER_COLOR,
                }
          }
        >
          {offering.flyer_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={offering.flyer_url}
              alt={`${offering.name} flyer`}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center px-2 text-center">
              <span className="line-clamp-4 text-sm font-semibold leading-snug text-white/95">
                {offering.name.trim() || "Program"}
              </span>
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <div className="min-w-0 space-y-1.5">
            <p className="text-base font-semibold leading-snug tracking-tight">
              {offering.name}
            </p>
            <p className="text-sm text-muted-foreground">{offering.yearSeasonName}</p>
            <OfferingStatusBadge status={offering.status} />
          </div>

          <div className="space-y-1.5 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 shrink-0" />
              <span>
                {formatProgramCatalogDate(offering.display_start_date)} -{" "}
                {formatProgramCatalogDate(offering.display_end_date)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 shrink-0" />
              <span className="truncate">{audienceLabel}</span>
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
              {acceptingRegistration
                ? "Open for registration"
                : "Enrollment closed"}
            </p>

            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  acceptingRegistration
                    ? getProgramCatalogEnrollmentColor(
                        offering.enrolled,
                        capacityForColor
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

export function OfferingCatalogView({
  offerings,
  page,
  totalPages,
  totalCount,
  pageSize = PROGRAM_CATALOG_PAGE_SIZE,
  title = "Programs",
  emptyTitle = "No active programs found",
  emptyDescription = "Add programs from a department workspace, or adjust your filters.",
  buildPageHref,
  filters,
}: {
  offerings: OfferingCatalogCard[]
  page: number
  totalPages: number
  totalCount: number
  pageSize?: number
  title?: string
  emptyTitle?: string
  emptyDescription?: string
  buildPageHref: (page: number) => string
  filters?: ReactNode
}) {
  const from = totalCount === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, totalCount)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      </div>

      {filters}

      {offerings.length === 0 ? (
        <div className="rounded-lg border border-dashed px-4 py-16 text-center">
          <p className="font-medium">{emptyTitle}</p>
          <p className="mt-1 text-sm text-muted-foreground">{emptyDescription}</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {offerings.map((offering) => (
            <OfferingCatalogCardView key={offering.id} offering={offering} />
          ))}
        </div>
      )}

      {totalCount > 0 ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {from} to {to} of {totalCount} programs.
          </p>
          {totalPages > 1 ? (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                asChild={page > 1}
              >
                {page > 1 ? (
                  <a href={buildPageHref(page - 1)}>
                    <ChevronLeft className="mr-1 h-4 w-4" />
                    Previous
                  </a>
                ) : (
                  <span>
                    <ChevronLeft className="mr-1 h-4 w-4" />
                    Previous
                  </span>
                )}
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                asChild={page < totalPages}
              >
                {page < totalPages ? (
                  <a href={buildPageHref(page + 1)}>
                    Next
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </a>
                ) : (
                  <span>
                    Next
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </span>
                )}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
