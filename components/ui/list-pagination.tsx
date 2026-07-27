"use client"

import {
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DEFAULT_LIST_PAGE_SIZE,
  getListPageCount,
  getListPageRange,
  getVisiblePageNumbers,
  LIST_PAGE_SIZE_OPTIONS,
} from "@/lib/ui/list-pagination"
import { cn } from "@/lib/utils"

export type ListPaginationProps = {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  onPageSizeChange?: (pageSize: number) => void
  pageSizeOptions?: readonly number[]
  disabled?: boolean
  className?: string
  /** Noun for the summary, e.g. "entries" (default), "contacts", "registrations". */
  entryLabel?: string
  /** Hide the page-size selector (e.g. fixed server page size). */
  hidePageSize?: boolean
}

export function ListPagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = LIST_PAGE_SIZE_OPTIONS,
  disabled = false,
  className,
  entryLabel = "entries",
  hidePageSize = false,
}: ListPaginationProps) {
  const safePageSize = Math.max(1, pageSize || DEFAULT_LIST_PAGE_SIZE)
  const totalPages = getListPageCount(total, safePageSize)
  const currentPage = Math.min(Math.max(1, page), totalPages)
  const { start, end } = getListPageRange(currentPage, safePageSize, total)
  const pages = getVisiblePageNumbers(currentPage, totalPages)

  const summary =
    total === 0
      ? `Showing 0 to 0 of 0 ${entryLabel}.`
      : `Showing ${start.toLocaleString()} to ${end.toLocaleString()} of ${total.toLocaleString()} ${entryLabel}.`

  function goTo(next: number) {
    if (disabled) return
    const clamped = Math.min(Math.max(1, next), totalPages)
    if (clamped !== currentPage) onPageChange(clamped)
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      <p className="text-sm text-muted-foreground">{summary}</p>

      <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-end">
        <div className="flex items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground"
            aria-label="First page"
            disabled={disabled || currentPage <= 1}
            onClick={() => goTo(1)}
          >
            <ChevronFirst className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground"
            aria-label="Previous page"
            disabled={disabled || currentPage <= 1}
            onClick={() => goTo(currentPage - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          {pages.map((pageNumber) => {
            const isActive = pageNumber === currentPage
            return (
              <Button
                key={pageNumber}
                type="button"
                variant={isActive ? "default" : "ghost"}
                size="icon"
                className={cn(
                  "h-8 w-8 text-sm",
                  isActive
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "text-muted-foreground"
                )}
                aria-label={`Page ${pageNumber}`}
                aria-current={isActive ? "page" : undefined}
                disabled={disabled}
                onClick={() => goTo(pageNumber)}
              >
                {pageNumber}
              </Button>
            )
          })}

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground"
            aria-label="Next page"
            disabled={disabled || currentPage >= totalPages}
            onClick={() => goTo(currentPage + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground"
            aria-label="Last page"
            disabled={disabled || currentPage >= totalPages}
            onClick={() => goTo(totalPages)}
          >
            <ChevronLast className="h-4 w-4" />
          </Button>
        </div>

        {!hidePageSize && onPageSizeChange ? (
          <Select
            value={String(safePageSize)}
            onValueChange={(value) => {
              const next = Number(value)
              if (!Number.isFinite(next) || next <= 0) return
              onPageSizeChange(next)
            }}
            disabled={disabled}
          >
            <SelectTrigger
              size="sm"
              className="h-8 w-[4.5rem]"
              aria-label="Rows per page"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              {pageSizeOptions.map((option) => (
                <SelectItem key={option} value={String(option)}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
      </div>
    </div>
  )
}
