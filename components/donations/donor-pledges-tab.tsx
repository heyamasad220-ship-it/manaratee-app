"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Ban, CheckCircle2, DollarSign, MoreHorizontal, Pencil } from "lucide-react"

import {
  DonationAttributionFields,
  EMPTY_DONATION_ATTRIBUTION_VALUE,
  type DonationAttributionValue,
} from "@/components/donations/donation-attribution-fields"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { formatPledgeStatusLabel, type PledgeDisplayStatus } from "@/lib/donations/donation-status"
import { getDonorPledgesAction } from "@/lib/donations/pledge-reminder-actions"
import {
  cancelPledgeAction,
  getPledgeForEditAction,
  markPledgePaidAction,
  recordPledgePaymentAction,
  updatePledgeAction,
} from "@/lib/donations/pledge-admin-actions"

type DonorPledgeRow = {
  id: string
  campaignName: string | null
  amountPledged: number
  amountPaid: number
  balanceRemaining: number
  status: string | null
  pledgeDate: string | null
  frequency: string | null
}

type DonorPledgesTabProps = {
  donorId: string
  donorName?: string
  embedded?: boolean
  onUpdated?: () => void
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value)
}

function formatDate(value: string | null) {
  if (!value) return "—"
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function formatFrequency(value: string | null | undefined) {
  if (!value) return "—"
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())
}

function getTodayPlainDate() {
  const today = new Date()
  const timezoneOffset = today.getTimezoneOffset() * 60 * 1000
  return new Date(today.getTime() - timezoneOffset).toISOString().slice(0, 10)
}

function isCancelled(status: string | null | undefined) {
  return String(status || "").toLowerCase() === "cancelled"
}

export function DonorPledgesTab({
  donorId,
  donorName,
  embedded = false,
  onUpdated,
}: DonorPledgesTabProps) {
  const [pledges, setPledges] = useState<DonorPledgeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [activePledge, setActivePledge] = useState<DonorPledgeRow | null>(null)
  const [dialog, setDialog] = useState<"edit" | "payment" | "markPaid" | null>(null)

  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [editAmount, setEditAmount] = useState("")
  const [editPledgeDate, setEditPledgeDate] = useState("")
  const [editFrequency, setEditFrequency] = useState("One-Time")
  const [editStatus, setEditStatus] = useState<PledgeDisplayStatus>("Open")
  const [editNotes, setEditNotes] = useState("")
  const [editAttribution, setEditAttribution] = useState<DonationAttributionValue>(
    EMPTY_DONATION_ATTRIBUTION_VALUE
  )

  const [paymentAmount, setPaymentAmount] = useState("")
  const [paymentDate, setPaymentDate] = useState(getTodayPlainDate())
  const [paymentSource, setPaymentSource] = useState("check")
  const [paymentMemo, setPaymentMemo] = useState("")

  const loadPledges = useCallback(async () => {
    setLoading(true)
    setError(null)
    const result = await getDonorPledgesAction(donorId)
    if (!result.success) {
      setError(result.error)
      setPledges([])
    } else {
      setPledges(result.pledges)
    }
    setLoading(false)
  }, [donorId])

  useEffect(() => {
    void loadPledges()
  }, [loadPledges])

  function closeDialog() {
    setDialog(null)
    setActivePledge(null)
    setActionError(null)
    setSaving(false)
  }

  async function openEditDialog(pledge: DonorPledgeRow) {
    setActionError(null)
    setActivePledge(pledge)
    setDialog("edit")

    const result = await getPledgeForEditAction(pledge.id)
    if (!result.success) {
      setActionError(result.error)
      return
    }

    setOrganizationId(result.organizationId)
    setEditAmount(String(result.pledge.amountPledged))
    setEditPledgeDate(result.pledge.pledgeDate)
    setEditFrequency(result.pledge.frequency)
    setEditStatus(result.pledge.status)
    setEditNotes(result.pledge.notes)
    setEditAttribution({
      campaignId: result.pledge.campaignId,
      categoryId: result.pledge.categoryId,
      subcategoryId: result.pledge.subcategoryId,
    })
  }

  function openPaymentDialog(pledge: DonorPledgeRow, markPaid = false) {
    setActionError(null)
    setActivePledge(pledge)
    setDialog(markPaid ? "markPaid" : "payment")
    setPaymentAmount(markPaid ? String(pledge.balanceRemaining) : "")
    setPaymentDate(getTodayPlainDate())
    setPaymentSource("check")
    setPaymentMemo(markPaid ? "Marked as paid" : "")
  }

  async function handleSaveEdit() {
    if (!activePledge) return
    setSaving(true)
    setActionError(null)

    const result = await updatePledgeAction({
      pledgeId: activePledge.id,
      amountPledged: Number(editAmount),
      pledgeDate: editPledgeDate,
      frequency: editFrequency,
      status: editStatus,
      campaignId: editAttribution.campaignId || null,
      categoryId: editAttribution.categoryId || null,
      subcategoryId: editAttribution.subcategoryId || null,
      notes: editNotes,
    })

    setSaving(false)
    if (!result.success) {
      setActionError(result.error)
      return
    }

    closeDialog()
    await loadPledges()
    onUpdated?.()
  }

  async function handleSavePayment(markPaid: boolean) {
    if (!activePledge) return
    setSaving(true)
    setActionError(null)

    const payload = {
      pledgeId: activePledge.id,
      amount: Number(paymentAmount),
      paymentDate,
      source: paymentSource,
      memo: paymentMemo,
    }

    const result = markPaid
      ? await markPledgePaidAction(payload)
      : await recordPledgePaymentAction(payload)

    setSaving(false)
    if (!result.success) {
      setActionError(result.error)
      return
    }

    closeDialog()
    await loadPledges()
    onUpdated?.()
  }

  async function handleCancelPledge(pledge: DonorPledgeRow) {
    if (
      !confirm(
        `Cancel the pledge for ${pledge.campaignName || "this campaign"}? Outstanding balance will be cleared from collection views.`
      )
    ) {
      return
    }

    const result = await cancelPledgeAction(pledge.id)
    if (!result.success) {
      alert(result.error)
      return
    }

    await loadPledges()
    onUpdated?.()
  }

  const tableContent = (
    <>
      {pledges.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          There are no pledges for this donor.
        </p>
      ) : (
        <div className="w-full rounded-md border">
          <table className="w-full table-fixed text-sm">
            <colgroup>
              <col style={{ width: "20%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "8%" }} />
            </colgroup>
            <thead className="bg-muted/50">
              <tr className="border-b">
                <th className="px-3 py-2 text-left font-medium">Campaign</th>
                <th className="px-3 py-2 text-left font-medium">Pledge Date</th>
                <th className="px-3 py-2 text-left font-medium">Frequency</th>
                <th className="px-3 py-2 text-right font-medium">Pledged</th>
                <th className="px-3 py-2 text-right font-medium">Paid</th>
                <th className="px-3 py-2 text-right font-medium">Balance</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
                <th className="px-3 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pledges.map((pledge) => {
                const cancelled = isCancelled(pledge.status)
                const canPay = !cancelled && pledge.balanceRemaining > 0

                return (
                  <tr key={pledge.id} className="border-b last:border-0">
                    <td className="truncate px-3 py-2 font-medium">
                      {pledge.campaignName || "—"}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">
                      {formatDate(pledge.pledgeDate)}
                    </td>
                    <td className="px-3 py-2">{formatFrequency(pledge.frequency)}</td>
                    <td className="px-3 py-2 text-right">
                      {formatCurrency(pledge.amountPledged)}
                    </td>
                    <td className="px-3 py-2 text-right text-emerald-700">
                      {formatCurrency(pledge.amountPaid)}
                    </td>
                    <td
                      className={`px-3 py-2 text-right font-medium ${
                        pledge.balanceRemaining > 0 ? "text-amber-700" : "text-muted-foreground"
                      }`}
                    >
                      {formatCurrency(pledge.balanceRemaining)}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant="secondary" className="whitespace-nowrap">
                        {formatPledgeStatusLabel(pledge.status)}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <PledgeRowMenu
                        pledge={pledge}
                        canPay={canPay}
                        cancelled={cancelled}
                        onEdit={() => void openEditDialog(pledge)}
                        onRecordPayment={() => openPaymentDialog(pledge)}
                        onMarkPaid={() => openPaymentDialog(pledge, true)}
                        onCancel={() => void handleCancelPledge(pledge)}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {pledges.length > 0 && !embedded ? (
        <div className="border-t px-1 pt-3 text-right">
          <Link href="/donations/pledges" className="text-sm text-primary hover:underline">
            View all pledges
          </Link>
        </div>
      ) : null}
    </>
  )

  if (loading) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">Loading pledges...</div>
    )
  }

  if (error) {
    return <div className="py-8 text-center text-sm text-destructive">{error}</div>
  }

  return (
    <>
      {embedded ? (
        tableContent
      ) : (
        <div className="rounded-lg border bg-white">
          <div className="border-b px-6 py-4">
            <h3 className="text-lg font-semibold">Pledges</h3>
            <p className="text-sm text-muted-foreground">
              All pledge commitments for this donor
            </p>
          </div>
          <div className="p-6">{tableContent}</div>
        </div>
      )}

      <Dialog open={dialog === "edit"} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Pledge</DialogTitle>
            <DialogDescription>
              Update pledge details for {donorName || "this donor"}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="pledge-edit-amount">Total Amount</Label>
                <Input
                  id="pledge-edit-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pledge-edit-date">Pledge Date</Label>
                <Input
                  id="pledge-edit-date"
                  type="date"
                  value={editPledgeDate}
                  onChange={(e) => setEditPledgeDate(e.target.value)}
                />
              </div>
            </div>
            <DonationAttributionFields
              organizationId={organizationId}
              value={editAttribution}
              onChange={setEditAttribution}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="pledge-edit-frequency">Frequency</Label>
                <Select value={editFrequency} onValueChange={setEditFrequency}>
                  <SelectTrigger id="pledge-edit-frequency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="One-Time">One-Time</SelectItem>
                    <SelectItem value="Monthly">Monthly</SelectItem>
                    <SelectItem value="Quarterly">Quarterly</SelectItem>
                    <SelectItem value="Yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pledge-edit-status">Status</Label>
                <Select
                  value={editStatus}
                  onValueChange={(value) => setEditStatus(value as PledgeDisplayStatus)}
                >
                  <SelectTrigger id="pledge-edit-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Open">Open</SelectItem>
                    <SelectItem value="Partial">Partial</SelectItem>
                    <SelectItem value="Fulfilled">Fulfilled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pledge-edit-notes">Notes</Label>
              <Textarea
                id="pledge-edit-notes"
                rows={3}
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
              />
            </div>
            {actionError ? <p className="text-sm text-destructive">{actionError}</p> : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={() => void handleSaveEdit()} disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={dialog === "payment" || dialog === "markPaid"}
        onOpenChange={(open) => !open && closeDialog()}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {dialog === "markPaid" ? "Mark Pledge as Paid" : "Record Payment"}
            </DialogTitle>
            <DialogDescription>
              {dialog === "markPaid"
                ? `Record a payment for the remaining balance on ${activePledge?.campaignName || "this pledge"}.`
                : `Add a payment toward ${activePledge?.campaignName || "this pledge"}.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="pledge-payment-amount">Amount</Label>
              <Input
                id="pledge-payment-amount"
                type="number"
                min="0"
                step="0.01"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                disabled={dialog === "markPaid"}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pledge-payment-date">Payment Date</Label>
              <Input
                id="pledge-payment-date"
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pledge-payment-method">Method</Label>
              <Select value={paymentSource} onValueChange={setPaymentSource}>
                <SelectTrigger id="pledge-payment-method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="check">Check</SelectItem>
                  <SelectItem value="zelle">Zelle</SelectItem>
                  <SelectItem value="venmo">Venmo</SelectItem>
                  <SelectItem value="paypal">PayPal</SelectItem>
                  <SelectItem value="stripe">Stripe</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pledge-payment-memo">Memo</Label>
              <Textarea
                id="pledge-payment-memo"
                rows={2}
                value={paymentMemo}
                onChange={(e) => setPaymentMemo(e.target.value)}
              />
            </div>
            {actionError ? <p className="text-sm text-destructive">{actionError}</p> : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={saving}>
              Cancel
            </Button>
            <Button
              onClick={() => void handleSavePayment(dialog === "markPaid")}
              disabled={saving}
            >
              {saving ? "Saving..." : dialog === "markPaid" ? "Mark as Paid" : "Save Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function PledgeRowMenu({
  pledge,
  canPay,
  cancelled,
  onEdit,
  onRecordPayment,
  onMarkPaid,
  onCancel,
}: {
  pledge: DonorPledgeRow
  canPay: boolean
  cancelled: boolean
  onEdit: () => void
  onRecordPayment: () => void
  onMarkPaid: () => void
  onCancel: () => void
}) {
  if (cancelled) {
    return <span className="text-xs text-muted-foreground">—</span>
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-8">
          <MoreHorizontal className="size-4" />
          <span className="sr-only">Pledge actions</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onEdit}>
          <Pencil className="mr-2 size-4" />
          Edit
        </DropdownMenuItem>
        {canPay ? (
          <>
            <DropdownMenuItem onClick={onRecordPayment}>
              <DollarSign className="mr-2 size-4" />
              Record Payment
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onMarkPaid}>
              <CheckCircle2 className="mr-2 size-4" />
              Mark as Paid
            </DropdownMenuItem>
          </>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={onCancel}>
          <Ban className="mr-2 size-4" />
          Cancel Pledge
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
