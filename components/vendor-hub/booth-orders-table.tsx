"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"
import Link from "next/link"
import { Columns3, Download, Search } from "lucide-react"

import { formatPhoneDisplay } from "@/lib/ui/format-phone"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  BOOTH_ORDER_COLUMN_DEFINITIONS,
  LOCKED_BOOTH_ORDER_COLUMNS,
  boothOrderMatchesQuery,
  defaultBoothOrderColumns,
  downloadBoothOrdersCsv,
  formatBoothOrderMoney,
  formatBoothOrderStatus,
  loadBoothOrderColumns,
  saveBoothOrderColumns,
  toggleBoothOrderColumn,
  type BoothOrderColumnId,
  type BoothOrderRow,
  type BoothOrdersColumnScope,
} from "@/lib/vendor-hub/booth-orders"
import { cn } from "@/lib/utils"

const statusColors: Record<string, string> = {
  paid: "border-emerald-200 bg-emerald-50 text-emerald-700",
  assigned: "border-emerald-200 bg-emerald-50 text-emerald-700",
  confirmed: "border-emerald-200 bg-emerald-50 text-emerald-700",
  reserved: "border-amber-200 bg-amber-50 text-amber-700",
  payment_pending: "border-amber-200 bg-amber-50 text-amber-700",
  cancelled: "border-red-200 bg-red-50 text-red-700",
  approved: "border-blue-200 bg-blue-50 text-blue-700",
}

function dash(value: string | null | undefined) {
  const trimmed = (value || "").trim()
  return trimmed || "—"
}

export function BoothOrdersTable({
  rows,
  scope,
  title,
  description,
  emptyMessage,
  exportFileName,
  showSearch = true,
  linkVendors = false,
  onRowClick,
  actions,
}: {
  rows: BoothOrderRow[]
  scope: BoothOrdersColumnScope
  title?: string
  description?: string
  emptyMessage: string
  exportFileName: string
  showSearch?: boolean
  linkVendors?: boolean
  onRowClick?: (row: BoothOrderRow) => void
  actions?: ReactNode
}) {
  const [search, setSearch] = useState("")
  const [columnsOpen, setColumnsOpen] = useState(false)
  const [visibleColumns, setVisibleColumns] = useState<BoothOrderColumnId[]>(() =>
    defaultBoothOrderColumns(scope)
  )

  useEffect(() => {
    setVisibleColumns(loadBoothOrderColumns(scope))
  }, [scope])

  const visible = useMemo(() => new Set(visibleColumns), [visibleColumns])
  const filtered = useMemo(
    () => rows.filter((row) => boothOrderMatchesQuery(row, search)),
    [rows, search]
  )

  function applyColumns(next: BoothOrderColumnId[]) {
    setVisibleColumns(next)
    saveBoothOrderColumns(next, scope)
  }

  function handleColumnToggle(id: BoothOrderColumnId, checked: boolean) {
    applyColumns(toggleBoothOrderColumn(visibleColumns, id, checked, scope))
  }

  const visibleDefs = BOOTH_ORDER_COLUMN_DEFINITIONS.filter((column) => visible.has(column.id))

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            {title || description ? (
              <div>
                {title ? <CardTitle className="text-base">{title}</CardTitle> : null}
                {description ? <CardDescription>{description}</CardDescription> : null}
              </div>
            ) : (
              <div />
            )}
            <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setColumnsOpen(true)}
              >
                <Columns3 className="mr-2 h-4 w-4" />
                Columns
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => downloadBoothOrdersCsv(filtered, exportFileName)}
                disabled={filtered.length === 0}
              >
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
              {actions}
            </div>
          </div>
          {showSearch ? (
            <div className="relative pt-2">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search orders..."
                className="pl-9"
              />
            </div>
          ) : null}
        </CardHeader>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">
              {rows.length === 0 ? emptyMessage : "No orders match your search."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {visibleDefs.map((column) => (
                      <TableHead
                        key={column.id}
                        className={column.align === "right" ? "text-right" : undefined}
                      >
                        {column.label}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((row) => {
                    const statusClass =
                      (row.status && statusColors[row.status]) ||
                      "border-border bg-muted text-muted-foreground"
                    return (
                      <TableRow
                        key={row.id}
                        className={onRowClick ? "cursor-pointer hover:bg-muted/50" : undefined}
                        tabIndex={onRowClick ? 0 : undefined}
                        role={onRowClick ? "button" : undefined}
                        aria-label={
                          onRowClick ? `Edit registration for ${row.vendorName}` : undefined
                        }
                        onClick={onRowClick ? () => onRowClick(row) : undefined}
                        onKeyDown={
                          onRowClick
                            ? (event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                  event.preventDefault()
                                  onRowClick(row)
                                }
                              }
                            : undefined
                        }
                      >
                        {visible.has("event") ? (
                          <TableCell className="whitespace-nowrap">{row.eventName}</TableCell>
                        ) : null}
                        {visible.has("vendor") ? (
                          <TableCell className="font-medium">
                            {linkVendors ? (
                              <Link
                                href={row.profileHref}
                                className="text-primary hover:underline"
                                onClick={(event) => event.stopPropagation()}
                              >
                                {row.vendorName}
                              </Link>
                            ) : (
                              <span className="text-primary">{row.vendorName}</span>
                            )}
                          </TableCell>
                        ) : null}
                        {visible.has("contact") ? (
                          <TableCell>{dash(row.contactName)}</TableCell>
                        ) : null}
                        {visible.has("email") ? (
                          <TableCell className="max-w-[220px] truncate">
                            {dash(row.email)}
                          </TableCell>
                        ) : null}
                        {visible.has("phone") ? (
                          <TableCell className="whitespace-nowrap">
                            {dash(formatPhoneDisplay(row.phone))}
                          </TableCell>
                        ) : null}
                        {visible.has("type") ? (
                          <TableCell>{dash(row.vendorType)}</TableCell>
                        ) : null}
                        {visible.has("boothType") ? (
                          <TableCell>{dash(row.boothType)}</TableCell>
                        ) : null}
                        {visible.has("booth") ? (
                          <TableCell className="tabular-nums">
                            {row.boothNumber?.trim() ? row.boothNumber : "—"}
                          </TableCell>
                        ) : null}
                        {visible.has("status") ? (
                          <TableCell>
                            {row.status ? (
                              <Badge
                                variant="outline"
                                className={cn("font-normal", statusClass)}
                              >
                                {formatBoothOrderStatus(row.status)}
                              </Badge>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                        ) : null}
                        {visible.has("boothFee") ? (
                          <TableCell className="text-right tabular-nums">
                            {formatBoothOrderMoney(row.boothFee)}
                          </TableCell>
                        ) : null}
                        {visible.has("paid") ? (
                          <TableCell className="text-right tabular-nums">
                            {row.paid > 0 ? formatBoothOrderMoney(row.paid) : "—"}
                          </TableCell>
                        ) : null}
                        {visible.has("paidDate") ? (
                          <TableCell className="whitespace-nowrap">
                            {dash(row.paidAt)}
                          </TableCell>
                        ) : null}
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={columnsOpen} onOpenChange={setColumnsOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Choose columns</DialogTitle>
            <DialogDescription>
              Check the columns you want to see in the booth orders table.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-1">
            {BOOTH_ORDER_COLUMN_DEFINITIONS.map((column) => {
              const locked = LOCKED_BOOTH_ORDER_COLUMNS.includes(column.id)
              const checked = visible.has(column.id)
              return (
                <label key={column.id} className="flex items-center gap-3 text-sm">
                  <Checkbox
                    checked={checked}
                    disabled={locked}
                    onCheckedChange={(value) =>
                      handleColumnToggle(column.id, value === true)
                    }
                  />
                  <span>{column.label}</span>
                </label>
              )
            })}
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              onClick={() => applyColumns(defaultBoothOrderColumns(scope))}
            >
              Reset
            </Button>
            <Button type="button" onClick={() => setColumnsOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
