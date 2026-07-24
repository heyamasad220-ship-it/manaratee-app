"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  Banknote,
  HandCoins,
  Loader2,
  MoreHorizontal,
  NotebookPen,
  Pencil,
  Percent,
  UserMinus,
} from "lucide-react"

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
import { Textarea } from "@/components/ui/textarea"
import {
  applyEnrollmentFinancialAssistanceAction,
  createEnrollmentCustomPaymentPlanAction,
  getEnrollmentAssistanceContextAction,
  getEnrollmentEditContextAction,
  receiveEnrollmentPaymentAction,
  updateEnrollmentNotesAction,
  updateEnrollmentRegistrationAction,
  withdrawAndSettleEnrollmentAction,
  type WithdrawSettlementMode,
} from "@/lib/programs/enrollment-payment-actions"

type PaymentDialog =
  | "receive"
  | "registration"
  | "assistance"
  | "plan"
  | "notes"
  | "withdraw"
  | null

type AssistanceMode = "total" | "monthly"

type EditOfferingOption = {
  id: string
  name: string
  programId: string
  programName: string
}

function money(value: number) {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  })
}

function todayDateString() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, "0")
  const d = String(now.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

export function RegistrationRowActions({
  registrationId,
  recordType,
  participantName,
  enrollmentStatus = null,
  totalAmount = 0,
  amountPaid = 0,
  notes = null,
}: {
  registrationId: string
  recordType: "enrollment" | "waitlist"
  participantName: string
  enrollmentStatus?: string | null
  totalAmount?: number
  amountPaid?: number
  notes?: string | null
  /** @deprecated Kept for call-site compatibility; payment actions do not use program links. */
  programId?: string | null
}) {
  const router = useRouter()
  const [dialog, setDialog] = React.useState<PaymentDialog>(null)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const [paymentAmount, setPaymentAmount] = React.useState("")
  const [paymentNote, setPaymentNote] = React.useState("")
  const [feeAmount, setFeeAmount] = React.useState("")
  const [feeNote, setFeeNote] = React.useState("")
  const [editOfferingId, setEditOfferingId] = React.useState("")
  const [editOfferings, setEditOfferings] = React.useState<EditOfferingOption[]>(
    []
  )
  const [editContextLoading, setEditContextLoading] = React.useState(false)
  const [discountedAmount, setDiscountedAmount] = React.useState("")
  const [assistanceNote, setAssistanceNote] = React.useState("")
  const [assistanceMode, setAssistanceMode] =
    React.useState<AssistanceMode>("total")
  const [monthlyAmount, setMonthlyAmount] = React.useState("")
  const [remainingMonths, setRemainingMonths] = React.useState("8")
  const [currentMonthlyAmount, setCurrentMonthlyAmount] = React.useState<
    number | null
  >(null)
  const [assistanceContextLoading, setAssistanceContextLoading] =
    React.useState(false)
  const [installmentCount, setInstallmentCount] = React.useState("3")
  const [firstDueDate, setFirstDueDate] = React.useState(todayDateString())
  const [planNote, setPlanNote] = React.useState("")
  const [notesDraft, setNotesDraft] = React.useState(notes || "")
  const [withdrawReason, setWithdrawReason] = React.useState("")
  const [settlement, setSettlement] =
    React.useState<WithdrawSettlementMode>("write_off")
  const [collectAmount, setCollectAmount] = React.useState("")

  const balance = Math.max(0, Number(totalAmount || 0) - Number(amountPaid || 0))
  const isEnrollment = recordType === "enrollment"
  const status = (enrollmentStatus || "").toLowerCase()
  const canWithdraw = !["withdrawn", "cancelled", "transferred"].includes(status)

  function openDialog(next: PaymentDialog) {
    setError(null)
    setBusy(false)
    if (next === "receive") {
      setPaymentAmount(balance > 0 ? balance.toFixed(2) : "")
      setPaymentNote("")
    }
    if (next === "registration") {
      setFeeAmount(Number(totalAmount || 0).toFixed(2))
      setFeeNote("")
      setEditOfferingId("")
      setEditOfferings([])
      setEditContextLoading(true)
      void getEnrollmentEditContextAction(registrationId).then((result) => {
        setEditContextLoading(false)
        if (!result.success) {
          setError(result.error)
          return
        }
        setFeeAmount(Number(result.totalAmount || 0).toFixed(2))
        setEditOfferingId(result.offeringId || "")
        setEditOfferings(result.offerings)
      })
    }
    if (next === "assistance") {
      setDiscountedAmount("")
      setAssistanceNote("")
      setAssistanceMode("total")
      setMonthlyAmount("")
      setRemainingMonths("8")
      setCurrentMonthlyAmount(null)
      setAssistanceContextLoading(true)
      void getEnrollmentAssistanceContextAction(registrationId).then((result) => {
        setAssistanceContextLoading(false)
        if (!result.success) return
        if (result.openInstallmentCount > 0) {
          setRemainingMonths(String(result.openInstallmentCount))
        } else {
          const balanceLeft = Math.max(
            0,
            result.totalAmount - result.amountPaid
          )
          const inferredMonths =
            result.currentInstallmentAmount &&
            result.currentInstallmentAmount > 0.009
              ? Math.max(
                  1,
                  Math.round(balanceLeft / result.currentInstallmentAmount)
                )
              : 8
          setRemainingMonths(String(inferredMonths))
        }
        if (
          result.currentInstallmentAmount != null &&
          result.currentInstallmentAmount > 0.009
        ) {
          setCurrentMonthlyAmount(result.currentInstallmentAmount)
          setMonthlyAmount(result.currentInstallmentAmount.toFixed(2))
        }
      })
    }
    if (next === "plan") {
      setInstallmentCount("3")
      setFirstDueDate(todayDateString())
      setPlanNote("")
    }
    if (next === "notes") {
      setNotesDraft(notes || "")
    }
    if (next === "withdraw") {
      setWithdrawReason("")
      setSettlement("write_off")
      setCollectAmount(balance > 0 ? balance.toFixed(2) : "0")
    }
    setDialog(next)
  }

  async function handleReceive() {
    setBusy(true)
    setError(null)
    const result = await receiveEnrollmentPaymentAction({
      enrollmentId: registrationId,
      amount: Number(paymentAmount),
      note: paymentNote,
    })
    setBusy(false)
    if (!result.success) {
      setError(result.error)
      return
    }
    setDialog(null)
    router.refresh()
  }

  async function handleRegistrationEdit() {
    setBusy(true)
    setError(null)
    const result = await updateEnrollmentRegistrationAction({
      enrollmentId: registrationId,
      offeringId: editOfferingId || null,
      feeAmount: Number(feeAmount),
      note: feeNote,
    })
    setBusy(false)
    if (!result.success) {
      setError(result.error)
      return
    }
    setDialog(null)
    router.refresh()
  }

  async function handleAssistance() {
    setBusy(true)
    setError(null)

    if (assistanceMode === "monthly") {
      const monthly = Number(monthlyAmount)
      const months = Math.floor(Number(remainingMonths))
      if (!Number.isFinite(monthly) || monthly < 0) {
        setBusy(false)
        setError("Enter a valid monthly amount (for example 30).")
        return
      }
      if (!Number.isFinite(months) || months < 1 || months > 36) {
        setBusy(false)
        setError("Enter remaining months between 1 and 36.")
        return
      }
      const nextFee =
        Math.round((Number(amountPaid || 0) + monthly * months) * 100) / 100
      if (
        Number(totalAmount || 0) > 0 &&
        nextFee + 0.009 >= Number(totalAmount || 0)
      ) {
        setBusy(false)
        setError(
          `That monthly plan still totals ${money(nextFee)}, which is not less than the current fee (${money(Number(totalAmount || 0))}).`
        )
        return
      }
      const result = await applyEnrollmentFinancialAssistanceAction({
        enrollmentId: registrationId,
        discountedAmount: nextFee,
        monthlyAmount: monthly,
        remainingMonths: months,
        note: assistanceNote,
      })
      setBusy(false)
      if (!result.success) {
        setError(result.error)
        return
      }
      setDialog(null)
      router.refresh()
      return
    }

    const nextFee = Number(discountedAmount)
    if (!Number.isFinite(nextFee) || nextFee < 0) {
      setBusy(false)
      setError("Enter the new fee after assistance (for example 0 for full scholarship).")
      return
    }
    if (Number(totalAmount || 0) > 0 && nextFee + 0.009 >= Number(totalAmount || 0)) {
      setBusy(false)
      setError(
        `Enter a fee lower than the current fee (${money(Number(totalAmount || 0))}).`
      )
      return
    }
    const result = await applyEnrollmentFinancialAssistanceAction({
      enrollmentId: registrationId,
      discountedAmount: nextFee,
      note: assistanceNote,
    })
    setBusy(false)
    if (!result.success) {
      setError(result.error)
      return
    }
    setDialog(null)
    router.refresh()
  }

  async function handlePlan() {
    setBusy(true)
    setError(null)
    const result = await createEnrollmentCustomPaymentPlanAction({
      enrollmentId: registrationId,
      installmentCount: Number(installmentCount),
      firstDueDate,
      note: planNote,
    })
    setBusy(false)
    if (!result.success) {
      setError(result.error)
      return
    }
    setDialog(null)
    router.refresh()
  }

  async function handleNotes() {
    setBusy(true)
    setError(null)
    const result = await updateEnrollmentNotesAction({
      enrollmentId: registrationId,
      notes: notesDraft,
    })
    setBusy(false)
    if (!result.success) {
      setError(result.error)
      return
    }
    setDialog(null)
    router.refresh()
  }

  async function handleWithdraw() {
    setBusy(true)
    setError(null)
    const result = await withdrawAndSettleEnrollmentAction({
      enrollmentId: registrationId,
      reason: withdrawReason,
      settlement,
      collectAmount:
        settlement === "collect" ? Number(collectAmount) : undefined,
    })
    setBusy(false)
    if (!result.success) {
      setError(result.error)
      return
    }
    setDialog(null)
    router.refresh()
  }

  if (!isEnrollment) {
    return (
      <Button
        variant="ghost"
        size="icon"
        disabled
        aria-label="No payment actions for waitlist"
      >
        <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
      </Button>
    )
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Payment actions">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => openDialog("receive")}>
            <Banknote className="mr-2 h-4 w-4" />
            Receive payment
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => openDialog("registration")}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit registration
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => openDialog("assistance")}>
            <Percent className="mr-2 h-4 w-4" />
            Mark financial assistance
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => openDialog("plan")}>
            <HandCoins className="mr-2 h-4 w-4" />
            Custom payment plan
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => openDialog("notes")}>
            <NotebookPen className="mr-2 h-4 w-4" />
            Add notes
          </DropdownMenuItem>
          {canWithdraw ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={() => openDialog("withdraw")}
              >
                <UserMinus className="mr-2 h-4 w-4" />
                Withdraw &amp; settle
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      {dialog === "registration" ? (
        <Dialog open onOpenChange={(open) => !open && setDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit registration</DialogTitle>
              <DialogDescription>
                Update the program and/or fee for {participantName}. Received so
                far {money(Number(amountPaid || 0))}. Fee cannot be lower than
                amount received.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-offering">Program</Label>
                {editContextLoading ? (
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading programs…
                  </p>
                ) : (
                  <select
                    id="edit-offering"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={editOfferingId}
                    onChange={(event) => setEditOfferingId(event.target.value)}
                  >
                    <option value="">Select program</option>
                    {editOfferings.map((offering) => (
                      <option key={offering.id} value={offering.id}>
                        {offering.name}
                        {offering.programName
                          ? ` · ${offering.programName}`
                          : ""}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fee-amount">Registration fee</Label>
                <Input
                  id="fee-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={feeAmount}
                  onChange={(event) => setFeeAmount(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="fee-note">Note (optional)</Label>
                <Input
                  id="fee-note"
                  value={feeNote}
                  onChange={(event) => setFeeNote(event.target.value)}
                  placeholder="Moved section, corrected fee, etc."
                />
              </div>
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialog(null)}
                disabled={busy}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => void handleRegistrationEdit()}
                disabled={busy || editContextLoading}
              >
                {busy ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  "Save registration"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}

      {dialog === "receive" ? (
        <Dialog open onOpenChange={(open) => !open && setDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Receive payment</DialogTitle>
              <DialogDescription>
                Record a payment for {participantName}. Balance due{" "}
                {balance.toLocaleString("en-US", {
                  style: "currency",
                  currency: "USD",
                })}
                .
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="receive-amount">Amount</Label>
                <Input
                  id="receive-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={paymentAmount}
                  onChange={(event) => setPaymentAmount(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="receive-note">Note (optional)</Label>
                <Input
                  id="receive-note"
                  value={paymentNote}
                  onChange={(event) => setPaymentNote(event.target.value)}
                  placeholder="Cash, check #, etc."
                />
              </div>
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialog(null)}
                disabled={busy}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => void handleReceive()}
                disabled={busy}
              >
                {busy ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  "Receive payment"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}

      {dialog === "assistance" ? (
        <Dialog open onOpenChange={(open) => !open && setDialog(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Mark financial assistance</DialogTitle>
              <DialogDescription>
                Lower the fee for {participantName}. Current fee{" "}
                {money(Number(totalAmount || 0))}.
                {currentMonthlyAmount != null
                  ? ` Current installment about ${money(currentMonthlyAmount)}.`
                  : ""}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 rounded-md border p-1">
                <Button
                  type="button"
                  size="sm"
                  variant={assistanceMode === "total" ? "default" : "ghost"}
                  onClick={() => setAssistanceMode("total")}
                >
                  Total fee
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={assistanceMode === "monthly" ? "default" : "ghost"}
                  onClick={() => setAssistanceMode("monthly")}
                >
                  Custom monthly
                </Button>
              </div>

              {assistanceMode === "total" ? (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="fa-amount">New fee after assistance</Label>
                    <Input
                      id="fa-amount"
                      type="number"
                      min="0"
                      step="0.01"
                      value={discountedAmount}
                      onChange={(event) => setDiscountedAmount(event.target.value)}
                      placeholder="e.g. 0 for full scholarship"
                    />
                    {discountedAmount !== "" &&
                    Number.isFinite(Number(discountedAmount)) ? (
                      <p className="text-xs text-muted-foreground">
                        Balance after assistance:{" "}
                        {money(
                          Math.max(
                            0,
                            Number(discountedAmount) - Number(amountPaid || 0)
                          )
                        )}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setDiscountedAmount("0")}
                    >
                      Full scholarship ($0)
                    </Button>
                    {Number(totalAmount || 0) > 0
                      ? (
                          [
                            { label: "25% off", factor: 0.75 },
                            { label: "50% off", factor: 0.5 },
                            { label: "75% off", factor: 0.25 },
                          ] as const
                        ).map((preset) => (
                          <Button
                            key={preset.label}
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setDiscountedAmount(
                                (Number(totalAmount || 0) * preset.factor).toFixed(2)
                              )
                            }
                          >
                            {preset.label}
                          </Button>
                        ))
                      : null}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Example: pay {money(30)}/month instead of{" "}
                    {money(currentMonthlyAmount || 50)}. New total fee = amount
                    already paid + monthly × remaining months.
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="fa-monthly">New monthly amount</Label>
                      <Input
                        id="fa-monthly"
                        type="number"
                        min="0"
                        step="0.01"
                        value={monthlyAmount}
                        onChange={(event) => setMonthlyAmount(event.target.value)}
                        placeholder="e.g. 30"
                        disabled={assistanceContextLoading}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="fa-months">Remaining months</Label>
                      <Input
                        id="fa-months"
                        type="number"
                        min="1"
                        max="36"
                        step="1"
                        value={remainingMonths}
                        onChange={(event) => setRemainingMonths(event.target.value)}
                        disabled={assistanceContextLoading}
                      />
                    </div>
                  </div>
                  {Number.isFinite(Number(monthlyAmount)) &&
                  Number.isFinite(Number(remainingMonths)) &&
                  Number(remainingMonths) >= 1 ? (
                    <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
                      <div className="flex justify-between gap-2">
                        <span className="text-muted-foreground">New total fee</span>
                        <span className="font-medium">
                          {money(
                            Number(amountPaid || 0) +
                              Number(monthlyAmount) * Number(remainingMonths)
                          )}
                        </span>
                      </div>
                      <div className="mt-1 flex justify-between gap-2">
                        <span className="text-muted-foreground">
                          Balance after assistance
                        </span>
                        <span className="font-medium">
                          {money(
                            Number(monthlyAmount) * Number(remainingMonths)
                          )}
                        </span>
                      </div>
                    </div>
                  ) : null}
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="fa-note">Note (optional)</Label>
                <Input
                  id="fa-note"
                  value={assistanceNote}
                  onChange={(event) => setAssistanceNote(event.target.value)}
                />
              </div>
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialog(null)}
                disabled={busy}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => void handleAssistance()}
                disabled={busy || assistanceContextLoading}
              >
                {busy ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  "Apply discount"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}

      {dialog === "plan" ? (
        <Dialog open onOpenChange={(open) => !open && setDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Custom payment plan</DialogTitle>
              <DialogDescription>
                Split the outstanding balance for {participantName} into equal
                installments (
                {balance.toLocaleString("en-US", {
                  style: "currency",
                  currency: "USD",
                })}{" "}
                remaining).
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="plan-count">Number of installments</Label>
                <Input
                  id="plan-count"
                  type="number"
                  min="2"
                  max="24"
                  value={installmentCount}
                  onChange={(event) => setInstallmentCount(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="plan-first-due">First due date</Label>
                <Input
                  id="plan-first-due"
                  type="date"
                  value={firstDueDate}
                  onChange={(event) => setFirstDueDate(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="plan-note">Note (optional)</Label>
                <Input
                  id="plan-note"
                  value={planNote}
                  onChange={(event) => setPlanNote(event.target.value)}
                />
              </div>
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialog(null)}
                disabled={busy}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => void handlePlan()}
                disabled={busy}
              >
                {busy ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  "Create plan"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}

      {dialog === "notes" ? (
        <Dialog open onOpenChange={(open) => !open && setDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Payment notes</DialogTitle>
              <DialogDescription>
                Notes for {participantName}. These appear on the registration
                record.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <Textarea
                value={notesDraft}
                onChange={(event) => setNotesDraft(event.target.value)}
                rows={5}
                placeholder="Add payment or billing notes…"
              />
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialog(null)}
                disabled={busy}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => void handleNotes()}
                disabled={busy}
              >
                {busy ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  "Save notes"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}

      {dialog === "withdraw" ? (
        <Dialog open onOpenChange={(open) => !open && setDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Withdraw &amp; settle</DialogTitle>
              <DialogDescription>
                Mark {participantName} as withdrawn and settle their account.
                Balance due{" "}
                {balance.toLocaleString("en-US", {
                  style: "currency",
                  currency: "USD",
                })}
                .
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="withdraw-reason">Reason</Label>
                <Textarea
                  id="withdraw-reason"
                  value={withdrawReason}
                  onChange={(event) => setWithdrawReason(event.target.value)}
                  rows={3}
                  placeholder="Why is this student withdrawing?"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="withdraw-settlement">Settle account</Label>
                <select
                  id="withdraw-settlement"
                  value={settlement}
                  onChange={(event) =>
                    setSettlement(event.target.value as WithdrawSettlementMode)
                  }
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                >
                  <option value="write_off">
                    Write off remaining balance (keep amount paid)
                  </option>
                  <option value="collect">
                    Collect remaining / final payment, then close
                  </option>
                  <option value="leave_balance">
                    Leave balance open (withdraw only)
                  </option>
                </select>
              </div>
              {settlement === "collect" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="withdraw-collect">Amount to collect</Label>
                  <Input
                    id="withdraw-collect"
                    type="number"
                    min="0"
                    step="0.01"
                    value={collectAmount}
                    onChange={(event) => setCollectAmount(event.target.value)}
                  />
                </div>
              ) : null}
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialog(null)}
                disabled={busy}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={() => void handleWithdraw()}
                disabled={busy || !withdrawReason.trim()}
              >
                {busy ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  "Withdraw student"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  )
}
