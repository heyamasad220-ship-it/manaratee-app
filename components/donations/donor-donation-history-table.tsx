"use client"

import { useState } from "react"
import { Link2, MoreHorizontal, Pencil, Ban, RotateCcw } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { PaymentReceiptActions } from "@/components/donations/payment-receipt-actions"
import { formatPaymentStatusLabel } from "@/lib/donations/donation-status"
import type { PaymentAdminRecord } from "@/lib/donations/payment-admin-types"
import {
  allocatePaymentToOpenPledgeAction,
  recordPaymentRefundAction,
  stripeRefundPaymentAction,
  updatePaymentAction,
  voidPaymentAction,
} from "@/lib/donations/payment-admin-actions"
import { fetchOpenPledgesForAllocationAction } from "@/lib/donations/donation-list-actions"

export type DonationHistoryRow = {
  id: string
  date: string
  amount: number
  netAmount: number
  refundedAmount: number
  category: string
  method: string
  status: string | null
  sourceType: string | null
  memo: string | null
  pledgeId: string | null
  capabilities: PaymentAdminRecord["capabilities"]
}

type AllocationPledgeOption = {
  id: string
  campaign_name: string | null
  balance_remaining: number | null
  amount_pledged: number | null
}

type DonorDonationHistoryTableProps = {
  donorId: string
  donations: DonationHistoryRow[]
  onUpdated?: () => void
}

function formatMoney(value: number) {
  return `$${Number(value).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`
}

function paymentDateInputValue(isoDate: string) {
  if (!isoDate) return ""
  return isoDate.slice(0, 10)
}

export function DonorDonationHistoryTable({
  donorId,
  donations,
  onUpdated,
}: DonorDonationHistoryTableProps) {
  const [active, setActive] = useState<DonationHistoryRow | null>(null)
  const [dialog, setDialog] = useState<"edit" | "void" | "refund" | "allocate" | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [allocationPledges, setAllocationPledges] = useState<AllocationPledgeOption[]>([])
  const [loadingPledges, setLoadingPledges] = useState(false)
  const [selectedPledgeId, setSelectedPledgeId] = useState("")

  const [editAmount, setEditAmount] = useState("")
  const [editDate, setEditDate] = useState("")
  const [editMethod, setEditMethod] = useState("")
  const [editMemo, setEditMemo] = useState("")

  const [voidReason, setVoidReason] = useState("")
  const [refundAmount, setRefundAmount] = useState("")
  const [refundReason, setRefundReason] = useState("")
  const [refundFull, setRefundFull] = useState(true)

  function openDialog(row: DonationHistoryRow, next: "edit" | "void" | "refund") {
    setActive(row)
    setDialog(next)
    setError(null)
    setEditAmount(String(row.amount))
    setEditDate(paymentDateInputValue(row.date))
    setEditMethod(row.method)
    setEditMemo(row.memo || "")
    setVoidReason("")
    setRefundReason("")
    setRefundFull(true)
    setRefundAmount(String(row.capabilities.remainingRefundable))
  }

  function closeDialog() {
    setDialog(null)
    setActive(null)
    setError(null)
    setSaving(false)
    setSelectedPledgeId("")
    setAllocationPledges([])
  }

  async function openAllocateDialog(row: DonationHistoryRow) {
    setActive(row)
    setDialog("allocate")
    setError(null)
    setSelectedPledgeId("")
    setLoadingPledges(true)

    const result = await fetchOpenPledgesForAllocationAction(donorId)
    setLoadingPledges(false)

    if (!result.success) {
      setError(result.error)
      setAllocationPledges([])
      return
    }

    setAllocationPledges(result.pledges as AllocationPledgeOption[])
  }

  async function handleAllocate() {
    if (!active) return
    if (!selectedPledgeId) {
      setError("Please select a pledge.")
      return
    }

    setSaving(true)
    setError(null)

    const result = await allocatePaymentToOpenPledgeAction({
      paymentId: active.id,
      pledgeId: selectedPledgeId,
    })

    setSaving(false)
    if (!result.success) {
      setError(result.error)
      return
    }

    closeDialog()
    onUpdated?.()
  }

  async function handleEditSave() {
    if (!active) return
    setSaving(true)
    setError(null)

    const result = await updatePaymentAction({
      paymentId: active.id,
      amount: active.capabilities.canEditAmount ? Number(editAmount) : undefined,
      paymentDate: active.capabilities.canEditAmount ? editDate : undefined,
      source: active.capabilities.canEditAmount ? editMethod : undefined,
      memo: editMemo,
    })

    setSaving(false)
    if (!result.success) {
      setError(result.error)
      return
    }

    closeDialog()
    onUpdated?.()
  }

  async function handleVoid() {
    if (!active) return
    setSaving(true)
    setError(null)

    const result = await voidPaymentAction({
      paymentId: active.id,
      reason: voidReason,
    })

    setSaving(false)
    if (!result.success) {
      setError(result.error)
      return
    }

    closeDialog()
    onUpdated?.()
  }

  async function handleRefund() {
    if (!active) return
    setSaving(true)
    setError(null)

    const amount = refundFull
      ? active.capabilities.remainingRefundable
      : Number(refundAmount)

    const result = active.capabilities.canStripeRefund
      ? await stripeRefundPaymentAction({
          paymentId: active.id,
          refundAmount: amount,
          reason: refundReason,
        })
      : await recordPaymentRefundAction({
          paymentId: active.id,
          refundAmount: amount,
          reason: refundReason,
        })

    setSaving(false)
    if (!result.success) {
      setError(result.error)
      return
    }

    closeDialog()
    onUpdated?.()
  }

  if (donations.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">No donations yet.</p>
    )
  }

  const refundTitle = active?.capabilities.canStripeRefund
    ? "Refund via Stripe"
    : "Record Refund"

  return (
    <>
      <TableWrapper>
        <colgroup>
          <col style={{ width: "9%" }} />
          <col style={{ width: "14%" }} />
          <col style={{ width: "18%" }} />
          <col style={{ width: "10%" }} />
          <col style={{ width: "14%" }} />
          <col style={{ width: "18%" }} />
          <col style={{ width: "7%" }} />
        </colgroup>
        <thead>
          <tr className="border-b">
            <th className="px-3 py-2 text-left font-medium">Date</th>
            <th className="px-3 py-2 text-left font-medium">Amount</th>
            <th className="px-3 py-2 text-left font-medium">Category</th>
            <th className="px-3 py-2 text-left font-medium">Method</th>
            <th className="px-3 py-2 text-left font-medium">Status</th>
            <th className="px-3 py-2 text-left font-medium">Receipt</th>
            <th className="px-3 py-2 text-right font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {donations.map((donation) => (
            <tr key={donation.id} className="border-b last:border-0">
              <td className="px-3 py-2 whitespace-nowrap">{new Date(donation.date).toLocaleDateString()}</td>
              <td className="px-3 py-2 font-medium">
                <div>{formatMoney(donation.netAmount)}</div>
                {donation.refundedAmount > 0 ? (
                  <div className="truncate text-xs text-muted-foreground">
                    {formatMoney(donation.amount)} − {formatMoney(donation.refundedAmount)} refunded
                  </div>
                ) : null}
              </td>
              <td className="px-3 py-2">
                <Badge variant="secondary" className="max-w-full truncate">
                  {donation.category}
                </Badge>
              </td>
              <td className="px-3 py-2 capitalize">{donation.method}</td>
              <td className="px-3 py-2">
                <Badge variant="outline" className="whitespace-nowrap">
                  {formatPaymentStatusLabel(donation.status)}
                </Badge>
              </td>
              <td className="px-3 py-2">
                <PaymentReceiptActions paymentId={donation.id} compact onUpdated={onUpdated} />
              </td>
                    <td className="px-3 py-2 text-right">
                      <PaymentRowMenu
                        donation={donation}
                        onAction={openDialog}
                        onAllocate={() => void openAllocateDialog(donation)}
                      />
                    </td>
            </tr>
          ))}
        </tbody>
      </TableWrapper>

      <Dialog open={dialog === "edit"} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Payment</DialogTitle>
            <DialogDescription>
              {active?.capabilities.canEditAmount
                ? "Update payment details."
                : "Only notes can be edited for app-collected Stripe payments."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {active?.capabilities.canEditAmount ? (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="edit-amount">Amount</Label>
                    <Input
                      id="edit-amount"
                      type="number"
                      min="0"
                      step="0.01"
                      value={editAmount}
                      onChange={(e) => setEditAmount(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-date">Date</Label>
                    <Input
                      id="edit-date"
                      type="date"
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-method">Method</Label>
                  <Input
                    id="edit-method"
                    value={editMethod}
                    onChange={(e) => setEditMethod(e.target.value)}
                    placeholder="check, zelle, cash..."
                  />
                </div>
              </>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="edit-memo">Notes</Label>
              <Textarea
                id="edit-memo"
                rows={3}
                value={editMemo}
                onChange={(e) => setEditMemo(e.target.value)}
              />
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleEditSave} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "void"} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Void Payment</DialogTitle>
            <DialogDescription>
              This removes the payment from totals and pledge balances. The record is kept for
              audit purposes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="void-reason">Reason (optional)</Label>
              <Textarea
                id="void-reason"
                rows={3}
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
              />
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={saving}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleVoid} disabled={saving}>
              {saving ? "Voiding..." : "Void Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "refund"} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{refundTitle}</DialogTitle>
            <DialogDescription>
              {active?.capabilities.canStripeRefund
                ? `Issue a refund through Stripe. Up to ${formatMoney(active.capabilities.remainingRefundable)} remaining.`
                : active?.capabilities.stripeRefundBlockedReason ||
                  `Record a refund processed outside the app. Up to ${formatMoney(active?.capabilities.remainingRefundable || 0)} remaining.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={refundFull ? "default" : "outline"}
                onClick={() => {
                  setRefundFull(true)
                  setRefundAmount(String(active?.capabilities.remainingRefundable || 0))
                }}
              >
                Full refund
              </Button>
              <Button
                type="button"
                size="sm"
                variant={!refundFull ? "default" : "outline"}
                onClick={() => setRefundFull(false)}
              >
                Partial refund
              </Button>
            </div>
            {!refundFull ? (
              <div className="space-y-2">
                <Label htmlFor="refund-amount">Refund amount</Label>
                <Input
                  id="refund-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                />
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="refund-reason">Reason (optional)</Label>
              <Textarea
                id="refund-reason"
                rows={3}
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
              />
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleRefund} disabled={saving}>
              {saving ? "Processing..." : active?.capabilities.canStripeRefund ? "Refund" : "Record Refund"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "allocate"} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Allocate Payment</DialogTitle>
            <DialogDescription>
              Link this payment to an open pledge for this donor.
            </DialogDescription>
          </DialogHeader>
          {active ? (
            <div className="space-y-4 py-2">
              <div className="rounded-md border p-4 text-sm">
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <span className="text-muted-foreground">Amount:</span>{" "}
                    <span className="font-medium">{formatMoney(active.netAmount)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Method:</span>{" "}
                    <span className="font-medium capitalize">{active.method}</span>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-muted-foreground">Memo:</span>{" "}
                    <span className="font-medium">{active.memo || "—"}</span>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="allocate-pledge">Open pledge</Label>
                {loadingPledges ? (
                  <p className="text-sm text-muted-foreground">Loading pledges...</p>
                ) : (
                  <Select value={selectedPledgeId} onValueChange={setSelectedPledgeId}>
                    <SelectTrigger id="allocate-pledge">
                      <SelectValue placeholder="Choose a pledge" />
                    </SelectTrigger>
                    <SelectContent>
                      {allocationPledges.length === 0 ? (
                        <SelectItem value="no-pledges" disabled>
                          No open pledges for this donor
                        </SelectItem>
                      ) : (
                        allocationPledges.map((pledge) => (
                          <SelectItem key={pledge.id} value={pledge.id}>
                            {pledge.campaign_name || "No campaign"} — Balance:{" "}
                            {formatMoney(Number(pledge.balance_remaining || 0))}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                )}
              </div>
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={saving}>
              Cancel
            </Button>
            <Button
              onClick={() => void handleAllocate()}
              disabled={saving || loadingPledges || allocationPledges.length === 0}
            >
              {saving ? "Allocating..." : "Allocate Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function TableWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full rounded-md border">
      <table className="w-full table-fixed text-sm">{children}</table>
    </div>
  )
}

function PaymentRowMenu({
  donation,
  onAction,
  onAllocate,
}: {
  donation: DonationHistoryRow
  onAction: (row: DonationHistoryRow, action: "edit" | "void" | "refund") => void
  onAllocate: () => void
}) {
  const { capabilities } = donation
  const hasRefund =
    capabilities.canStripeRefund || capabilities.canRecordRefund
  const hasAnyAction =
    capabilities.canEdit || capabilities.canVoid || hasRefund || capabilities.canAllocate

  if (!hasAnyAction) {
    return <span className="text-xs text-muted-foreground">—</span>
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8">
          <MoreHorizontal className="size-4" />
          <span className="sr-only">Payment actions</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {capabilities.canAllocate ? (
          <DropdownMenuItem onClick={onAllocate}>
            <Link2 className="mr-2 size-4" />
            Allocate
          </DropdownMenuItem>
        ) : null}
        {capabilities.canEdit ? (
          <DropdownMenuItem onClick={() => onAction(donation, "edit")}>
            <Pencil className="mr-2 size-4" />
            Edit
          </DropdownMenuItem>
        ) : null}
        {hasRefund ? (
          <DropdownMenuItem onClick={() => onAction(donation, "refund")}>
            <RotateCcw className="mr-2 size-4" />
            {capabilities.canStripeRefund ? "Refund" : "Record Refund"}
          </DropdownMenuItem>
        ) : null}
        {capabilities.canVoid ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => onAction(donation, "void")}
            >
              <Ban className="mr-2 size-4" />
              Void
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
