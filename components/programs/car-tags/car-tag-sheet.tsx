"use client"

import * as React from "react"
import { Printer } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import type { CarTagLayout, CarTagRow } from "@/lib/programs/car-tag-types"

function CarTagCard({ tag }: { tag: CarTagRow }) {
  return (
    <article className="car-tag-card flex h-full flex-col justify-between rounded-lg border-2 border-black bg-white p-4 text-black">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-600">
          {tag.programName}
        </p>
        {tag.offeringName ? (
          <p className="text-xs text-neutral-700">{tag.offeringName}</p>
        ) : null}
        {tag.sessionLabel ? (
          <p className="text-xs text-neutral-700">{tag.sessionLabel}</p>
        ) : null}
      </div>

      <div className="py-3 text-center">
        <p className="text-3xl font-bold leading-tight">{tag.participantName}</p>
        {tag.familyLastName ? (
          <p className="mt-1 text-xl font-semibold uppercase tracking-wide">
            {tag.familyLastName} Family
          </p>
        ) : null}
      </div>

      <div className="space-y-1 text-sm">
        {tag.gradeLabel ? (
          <p>
            <span className="font-semibold">Grade:</span> {tag.gradeLabel}
          </p>
        ) : null}
        {tag.dismissalGroup ? (
          <p>
            <span className="font-semibold">Dismissal:</span>{" "}
            {tag.dismissalGroup}
          </p>
        ) : null}
        {tag.authorizedPickupNames.length > 0 ? (
          <p>
            <span className="font-semibold">Pickup:</span>{" "}
            {tag.authorizedPickupNames.join(", ")}
          </p>
        ) : null}
        {tag.contactPhone ? (
          <p>
            <span className="font-semibold">Phone:</span> {tag.contactPhone}
          </p>
        ) : null}
      </div>
    </article>
  )
}

export function CarTagSheet({
  tags,
  initialSelectedIds,
}: {
  tags: CarTagRow[]
  initialSelectedIds?: string[]
}) {
  const [layout, setLayout] = React.useState<CarTagLayout>("2-up")
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(
    () => new Set(initialSelectedIds?.length ? initialSelectedIds : tags.map((t) => t.enrollmentId))
  )

  React.useEffect(() => {
    if (initialSelectedIds?.length) {
      setSelectedIds(new Set(initialSelectedIds))
    }
  }, [initialSelectedIds])

  const selectedTags = tags.filter((tag) => selectedIds.has(tag.enrollmentId))
  const allVisibleSelected =
    tags.length > 0 && tags.every((tag) => selectedIds.has(tag.enrollmentId))

  function toggleTag(enrollmentId: string) {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(enrollmentId)) {
        next.delete(enrollmentId)
      } else {
        next.add(enrollmentId)
      }
      return next
    })
  }

  function toggleAllVisible() {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (allVisibleSelected) {
        tags.forEach((tag) => next.delete(tag.enrollmentId))
      } else {
        tags.forEach((tag) => next.add(tag.enrollmentId))
      }
      return next
    })
  }

  function handlePrint(useSelection: boolean) {
    const root = document.getElementById("car-tag-print-root")
    if (!root) return

    root.dataset.printMode = useSelection ? "selected" : "all"
    window.print()
  }

  return (
    <>
      <style jsx global>{`
        @media print {
          @page {
            size: letter;
            margin: 0.4in;
          }

          body {
            background: white !important;
          }

          aside,
          header,
          .no-print {
            display: none !important;
          }

          main {
            overflow: visible !important;
            height: auto !important;
          }

          #car-tag-print-root {
            display: block !important;
          }

          #car-tag-print-root[data-print-mode="selected"]
            .car-tag-print-item:not([data-selected="true"]) {
            display: none !important;
          }

          .car-tag-print-grid {
            display: grid !important;
            gap: 0.35in;
          }

          .car-tag-print-grid.layout-2-up {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .car-tag-print-grid.layout-4-up {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .car-tag-print-grid.layout-4-up .car-tag-card {
            min-height: 3.1in;
            padding: 0.2in;
          }

          .car-tag-print-grid.layout-4-up .car-tag-card p.text-3xl {
            font-size: 1.35rem;
          }

          .car-tag-print-grid.layout-2-up .car-tag-card {
            min-height: 4.5in;
            page-break-inside: avoid;
          }

          .car-tag-print-item {
            break-inside: avoid;
            page-break-inside: avoid;
          }
        }

        @media screen {
          #car-tag-print-root {
            display: none;
          }
        }
      `}</style>

      <div className="no-print space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            onClick={() => handlePrint(true)}
            disabled={selectedTags.length === 0}
          >
            <Printer className="mr-2 h-4 w-4" />
            Print selected ({selectedTags.length})
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => handlePrint(false)}
            disabled={tags.length === 0}
          >
            Print all visible ({tags.length})
          </Button>

          <div className="flex items-center gap-2">
            <Label htmlFor="car-tag-layout" className="text-sm">
              Layout
            </Label>
            <select
              id="car-tag-layout"
              value={layout}
              onChange={(event) =>
                setLayout(event.target.value as CarTagLayout)
              }
              className="h-9 rounded-md border bg-background px-2 text-sm"
            >
              <option value="2-up">2 per page (large)</option>
              <option value="4-up">4 per page (compact)</option>
            </select>
          </div>
        </div>

        {tags.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No active enrollments match the current filters.
          </p>
        ) : (
          <div className="rounded-lg border">
            <div className="flex items-center gap-3 border-b px-4 py-3">
              <Checkbox
                checked={allVisibleSelected}
                onCheckedChange={toggleAllVisible}
                aria-label="Select all visible tags"
              />
              <span className="text-sm font-medium">Select participants</span>
            </div>
            <ul className="divide-y">
              {tags.map((tag) => (
                <li key={tag.enrollmentId} className="flex items-start gap-3 px-4 py-3">
                  <Checkbox
                    checked={selectedIds.has(tag.enrollmentId)}
                    onCheckedChange={() => toggleTag(tag.enrollmentId)}
                    aria-label={`Select ${tag.participantName}`}
                    className="mt-1"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{tag.participantName}</p>
                    <p className="text-sm text-muted-foreground">
                      {tag.familyLastName
                        ? `${tag.familyLastName} family`
                        : "Family name unavailable"}
                      {tag.sessionLabel ? ` · ${tag.sessionLabel}` : ""}
                      {tag.contactPhone ? ` · ${tag.contactPhone}` : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div
        id="car-tag-print-root"
        data-print-mode="selected"
        aria-hidden
        className={`car-tag-print-grid layout-${layout} hidden print:grid`}
      >
        {tags.map((tag) => (
          <div
            key={tag.enrollmentId}
            className="car-tag-print-item"
            data-selected={selectedIds.has(tag.enrollmentId) ? "true" : "false"}
          >
            <CarTagCard tag={tag} />
          </div>
        ))}
      </div>
    </>
  )
}
