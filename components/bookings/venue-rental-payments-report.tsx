"use client"

import Link from "next/link"
import { useEffect, useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { DollarSign, MoreHorizontal } from "lucide-react"

import {
  deleteVenueRentalPaymentRecord,
  recordVenueRentalPaymentReceived,
  updateVenueRentalPaymentRecord,
} from "@/lib/bookings/venue-rental-actions"
import type {
  RentalPaymentType,
  VenueRentalPaymentBalanceFilter,
  VenueRentalPaymentReportRow,
} from "@/lib/bookings/venue-rental-types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ListPagination } from "@/components/ui/list-pagination"
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
import { TableColumnHeaderFilter } from "@/components/ui/table-column-header-filter"
import { Textarea } from "@/components/ui/textarea"
import {
  DEFAULT_LIST_PAGE_SIZE,
  slicePageItems,
} from "@/lib/ui/list-pagination"

type PaymentTypeOption = "deposit" | "remaining_balance"

type VenueRentalPaymentsReportProps = {
  rows: VenueRentalPaymentReportRow[]
  canManage: boolean
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(value) || 0)
}

function balanceLabel(filter: VenueRentalPaymentBalanceFilter) {
  switch (filter) {
    case "paid":
      return "Paid"
    case "partial":
      return "Partial"
    case "unpaid":
      return "Unpaid"
    case "no_payments":
      return "No payments"
    default:
      return "All"
  }
}

function paymentTypeLabel(type: RentalPaymentType | PaymentTypeOption) {
  switch (type) {
    case "deposit":
      return "Deposit"
    case "remaining_balance":
      return "Remaining balance"
    case "addon_fee":
      return "Add-on fee"
    case "security_deposit":
      return "Security deposit"
    default:
      return type
  }
}

function toPaymentTypeOption(
  type: RentalPaymentType
): PaymentTypeOption {
  if (type === "remaining_balance" || type === "addon_fee") {
    return "remaining_balance"
  }
  return "deposit"
}

export function VenueRentalPaymentsReport({
  rows,
  canManage,
}: VenueRentalPaymentsReportProps) {
  const router = useRouter()
  const [customerFilterInput, setCustomerFilterInput] = useState("")
  const [customerFilter, setCustomerFilter] = useState("")
  const [balanceFilter, setBalanceFilter] =
    useState<VenueRentalPaymentBalanceFilter>("all")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_LIST_PAGE_SIZE)
  const [receiveOpen, setReceiveOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [selected, setSelected] = useState<VenueRentalPaymentReportRow | null>(
    null
  )
  const [selectedPaymentId, setSelectedPaymentId] = useState("")
  const [paymentType, setPaymentType] = useState<PaymentTypeOption>("deposit")
  const [amount, setAmount] = useState("")
  const [notes, setNotes] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const query = customerFilter.toLowerCase()
      const matchesCustomer =
        !query ||
        row.customerName.toLowerCase().includes(query) ||
        (row.customerEmail || "").toLowerCase().includes(query) ||
        (row.customerPhone || "").toLowerCase().includes(query)

      const matchesBalance =
        balanceFilter === "all" || row.paymentBalance === balanceFilter

      return matchesCustomer && matchesBalance
    })
  }, [rows, customerFilter, balanceFilter])

  useEffect(() => {
    setPage(1)
  }, [customerFilter, balanceFilter])

  const currentPage = Math.min(
    page,
    Math.max(1, Math.ceil(filteredRows.length / pageSize) || 1)
  )
  const pagedRows = useMemo(
    () => slicePageItems(filteredRows, currentPage, pageSize),
    [filteredRows, currentPage, pageSize]
  )

  const totals = useMemo(() => {
    return filteredRows.reduce(
      (acc, row) => {
        acc.totalFee += row.totalFee
        acc.depositReceived += row.depositReceived
        acc.remainingDue += row.remainingDue
        acc.balanceDue += row.balanceDue
        return acc
      },
      { totalFee: 0, depositReceived: 0, remainingDue: 0, balanceDue: 0 }
    )
  }, [filteredRows])

  const selectedPayments = selected?.payments ?? []
  const selectedPayment =
    selectedPayments.find((payment) => payment.id === selectedPaymentId) ?? null

  function openReceive(row: VenueRentalPaymentReportRow) {
    setSelected(row)
    setError(null)
    setNotes("")

    if (row.depositAmount > row.depositReceived) {
      setPaymentType("deposit")
      setAmount(String(Math.max(0, row.depositAmount - row.depositReceived) || row.depositAmount || ""))
    } else if (row.remainingDue > 0) {
      setPaymentType("remaining_balance")
      setAmount(String(row.remainingDue))
    } else {
      setPaymentType("deposit")
      setAmount("")
    }

    setReceiveOpen(true)
  }

  function openEdit(row: VenueRentalPaymentReportRow) {
    const first = row.payments[0]
    if (!first) return

    setSelected(row)
    setSelectedPaymentId(first.id)
    setPaymentType(toPaymentTypeOption(first.paymentType))
    setAmount(String(first.amount || ""))
    setNotes(first.notes || "")
    setError(null)
    setEditOpen(true)
  }

  function openDelete(row: VenueRentalPaymentReportRow) {
    const first = row.payments[0]
    if (!first) return

    setSelected(row)
    setSelectedPaymentId(first.id)
    setError(null)
    setDeleteOpen(true)
  }

  function onEditPaymentSelect(paymentId: string) {
    const payment = selected?.payments.find((item) => item.id === paymentId)
    setSelectedPaymentId(paymentId)
    if (!payment) return
    setPaymentType(toPaymentTypeOption(payment.paymentType))
    setAmount(String(payment.amount || ""))
    setNotes(payment.notes || "")
  }

  function submitReceive() {
    if (!selected) return
    setError(null)
    startTransition(async () => {
      try {
        await recordVenueRentalPaymentReceived({
          venueRentalId: selected.id,
          paymentType,
          amount: Number(amount),
          notes,
        })
        setReceiveOpen(false)
        setSelected(null)
        router.refresh()
      } catch (submitError) {
        setError(
          submitError instanceof Error
            ? submitError.message
            : "Failed to record payment"
        )
      }
    })
  }

  function submitEdit() {
    if (!selectedPaymentId) return
    setError(null)
    startTransition(async () => {
      try {
        await updateVenueRentalPaymentRecord({
          paymentId: selectedPaymentId,
          paymentType,
          amount: Number(amount),
          notes,
        })
        setEditOpen(false)
        setSelected(null)
        router.refresh()
      } catch (submitError) {
        setError(
          submitError instanceof Error
            ? submitError.message
            : "Failed to update payment"
        )
      }
    })
  }

  function submitDelete() {
    if (!selectedPaymentId) return
    setError(null)
    startTransition(async () => {
      try {
        await deleteVenueRentalPaymentRecord({
          paymentId: selectedPaymentId,
        })
        setDeleteOpen(false)
        setSelected(null)
        router.refresh()
      } catch (submitError) {
        setError(
          submitError instanceof Error
            ? submitError.message
            : "Failed to delete payment"
        )
      }
    })
  }

  return (
    <div className="flex flex-col gap-4 sm:gap-6 p-4 sm:p-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Payments</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Rental fees, deposits received, and remaining balances.
        </p>
      </div>

      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Total fees" value={formatMoney(totals.totalFee)} />
        <SummaryCard
          label="Deposits received"
          value={formatMoney(totals.depositReceived)}
        />
        <SummaryCard
          label="Remaining due"
          value={formatMoney(totals.remainingDue)}
        />
        <SummaryCard
          label="Balance due"
          value={formatMoney(totals.balanceDue)}
        />
      </div>

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="min-w-[900px]">
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <TableColumnHeaderFilter
                      label="Customer"
                      active={Boolean(customerFilter.trim())}
                    >
                      {({ close }) => (
                        <Input
                          placeholder="Search by name, email, or phone"
                          value={customerFilterInput}
                          onChange={(event) => {
                            setCustomerFilterInput(event.target.value)
                            setCustomerFilter(event.target.value)
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              setCustomerFilter(customerFilterInput)
                              close()
                            }
                          }}
                        />
                      )}
                    </TableColumnHeaderFilter>
                  </TableHead>
                  <TableHead>Event / space</TableHead>
                  <TableHead className="text-right">Total fee</TableHead>
                  <TableHead className="text-right">Deposit received</TableHead>
                  <TableHead className="text-right">Remaining</TableHead>
                  <TableHead>
                    <TableColumnHeaderFilter
                      label="Balance"
                      active={balanceFilter !== "all"}
                    >
                      {({ close }) => (
                        <Select
                          value={balanceFilter}
                          onValueChange={(value) => {
                            setBalanceFilter(value as VenueRentalPaymentBalanceFilter)
                            close()
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Filter balance" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All</SelectItem>
                            <SelectItem value="unpaid">Unpaid</SelectItem>
                            <SelectItem value="partial">Partial</SelectItem>
                            <SelectItem value="paid">Paid</SelectItem>
                            <SelectItem value="no_payments">No payments</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </TableColumnHeaderFilter>
                  </TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedRows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="h-32 text-center text-muted-foreground"
                    >
                      No rentals match these filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  pagedRows.map((row) => {
                    const hasPayments = row.payments.length > 0
                    return (
                      <TableRow key={row.id}>
                        <TableCell>
                          <div className="font-medium">{row.customerName}</div>
                          {row.customerEmail ? (
                            <div className="text-xs text-muted-foreground">
                              {row.customerEmail}
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell className="max-w-[260px] text-sm">
                          {row.eventTypeName ? (
                            <div className="font-medium">{row.eventTypeName}</div>
                          ) : null}
                          <div className="text-muted-foreground">{row.spaceLabel}</div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.totalFee > 0 ? formatMoney(row.totalFee) : "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.depositReceived > 0
                            ? formatMoney(row.depositReceived)
                            : "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.remainingDue > 0
                            ? formatMoney(row.remainingDue)
                            : row.remainingAmount > 0
                              ? formatMoney(0)
                              : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {balanceLabel(row.paymentBalance)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">Payment actions</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <Link href={`/bookings/rentals/${row.id}`}>
                                  Open rental
                                </Link>
                              </DropdownMenuItem>
                              {canManage ? (
                                <>
                                  <DropdownMenuItem
                                    onSelect={() => openReceive(row)}
                                  >
                                    Receive payment
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    disabled={!hasPayments}
                                    onSelect={() => openEdit(row)}
                                  >
                                    Edit payment
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    disabled={!hasPayments}
                                    className="text-destructive focus:text-destructive"
                                    onSelect={() => openDelete(row)}
                                  >
                                    Delete payment
                                  </DropdownMenuItem>
                                </>
                              ) : null}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
          {filteredRows.length > 0 ? (
            <div className="border-t border-border px-3 py-3 sm:px-4">
              <ListPagination
                page={currentPage}
                pageSize={pageSize}
                total={filteredRows.length}
                entryLabel="rentals"
                onPageChange={setPage}
                onPageSizeChange={(next) => {
                  setPageSize(next)
                  setPage(1)
                }}
              />
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={receiveOpen} onOpenChange={setReceiveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Receive payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selected ? (
              <p className="text-sm text-muted-foreground">
                {selected.customerName}
                {selected.eventTypeName ? ` · ${selected.eventTypeName}` : ""}
              </p>
            ) : null}
            {error ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            ) : null}
            <div className="space-y-2">
              <Label>Payment type</Label>
              <Select
                value={paymentType}
                onValueChange={(value) =>
                  setPaymentType(value as PaymentTypeOption)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="deposit">Deposit</SelectItem>
                  <SelectItem value="remaining_balance">Remaining balance</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="payment-amount">Amount</Label>
              <Input
                id="payment-amount"
                type="number"
                min={0}
                step="0.01"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="payment-notes">Notes</Label>
              <Textarea
                id="payment-notes"
                rows={3}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setReceiveOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button onClick={submitReceive} disabled={isPending}>
              <DollarSign className="mr-2 h-4 w-4" />
              {isPending ? "Saving..." : "Record payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selected ? (
              <p className="text-sm text-muted-foreground">
                {selected.customerName}
                {selected.eventTypeName ? ` · ${selected.eventTypeName}` : ""}
              </p>
            ) : null}
            {error ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            ) : null}
            {selectedPayments.length > 1 ? (
              <div className="space-y-2">
                <Label>Payment</Label>
                <Select
                  value={selectedPaymentId}
                  onValueChange={onEditPaymentSelect}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedPayments.map((payment) => (
                      <SelectItem key={payment.id} value={payment.id}>
                        {paymentTypeLabel(payment.paymentType)} ·{" "}
                        {formatMoney(payment.amount)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : selectedPayment ? (
              <p className="text-sm text-muted-foreground">
                {paymentTypeLabel(selectedPayment.paymentType)} ·{" "}
                {formatMoney(selectedPayment.amount)}
              </p>
            ) : null}
            <div className="space-y-2">
              <Label>Payment type</Label>
              <Select
                value={paymentType}
                onValueChange={(value) =>
                  setPaymentType(value as PaymentTypeOption)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="deposit">Deposit</SelectItem>
                  <SelectItem value="remaining_balance">Remaining balance</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-payment-amount">Amount</Label>
              <Input
                id="edit-payment-amount"
                type="number"
                min={0}
                step="0.01"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-payment-notes">Notes</Label>
              <Textarea
                id="edit-payment-notes"
                rows={3}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button onClick={submitEdit} disabled={isPending || !selectedPaymentId}>
              {isPending ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selected ? (
              <p className="text-sm text-muted-foreground">
                {selected.customerName}
                {selected.eventTypeName ? ` · ${selected.eventTypeName}` : ""}
              </p>
            ) : null}
            {error ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            ) : null}
            {selectedPayments.length > 1 ? (
              <div className="space-y-2">
                <Label>Payment to delete</Label>
                <Select
                  value={selectedPaymentId}
                  onValueChange={setSelectedPaymentId}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedPayments.map((payment) => (
                      <SelectItem key={payment.id} value={payment.id}>
                        {paymentTypeLabel(payment.paymentType)} ·{" "}
                        {formatMoney(payment.amount)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : selectedPayment ? (
              <p className="text-sm">
                Delete {paymentTypeLabel(selectedPayment.paymentType)} of{" "}
                <span className="font-medium tabular-nums">
                  {formatMoney(selectedPayment.amount)}
                </span>
                ?
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">No payment selected.</p>
            )}
            <p className="text-sm text-muted-foreground">
              This removes the payment record and recalculates the rental balance.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={submitDelete}
              disabled={isPending || !selectedPaymentId}
            >
              {isPending ? "Deleting..." : "Delete payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  )
}
