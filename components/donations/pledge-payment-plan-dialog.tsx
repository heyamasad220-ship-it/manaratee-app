"use client"

import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  calculateInstallmentAmount,
  defaultFirstPaymentDate,
  pledgeHasPaymentPlan,
  type PledgePlanFrequency,
} from "@/lib/donations/pledge-payment-plan"

export type PledgePaymentPlanDialogPledge = {
  id: string
  totalAmount: number
  balance: number
  campaignName: string
  installmentAmount?: number | null
  totalPayments?: number | null
  frequency?: string | null
  firstPaymentDate?: string | null
}

type PledgePaymentPlanDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  pledge: PledgePaymentPlanDialogPledge | null
  saving?: boolean
  error?: string | null
  onSave: (input: {
    installmentAmount: number
    numberOfPayments: number
    frequency: PledgePlanFrequency
    firstPaymentDate: string
  }) => void | Promise<void>
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function PledgePaymentPlanDialog({
  open,
  onOpenChange,
  pledge,
  saving = false,
  error = null,
  onSave,
}: PledgePaymentPlanDialogProps) {
  const [form, setForm] = useState({
    installmentAmount: "",
    numberOfPayments: "10",
    frequency: "monthly",
    firstPaymentDate: defaultFirstPaymentDate(),
  })

  useEffect(() => {
    if (!open || !pledge) return

    const hasPlan = pledgeHasPaymentPlan({
      frequency: pledge.frequency,
      totalPayments: pledge.totalPayments,
      installmentAmount: pledge.installmentAmount,
    })

    const numberOfPayments = hasPlan ? String(pledge.totalPayments ?? 10) : "10"
    const installmentAmount = hasPlan
      ? String(pledge.installmentAmount ?? "")
      : pledge.totalAmount > 0 && Number(numberOfPayments) > 0
        ? String(calculateInstallmentAmount(pledge.totalAmount, Number(numberOfPayments)))
        : ""

    setForm({
      installmentAmount,
      numberOfPayments,
      frequency: hasPlan ? String(pledge.frequency || "monthly") : "monthly",
      firstPaymentDate: pledge.firstPaymentDate || defaultFirstPaymentDate(),
    })
  }, [open, pledge])

  const hasPlan = pledge
    ? pledgeHasPaymentPlan({
        frequency: pledge.frequency,
        totalPayments: pledge.totalPayments,
        installmentAmount: pledge.installmentAmount,
      })
    : false

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{hasPlan ? "Edit Payment Plan" : "Set Up Payment Plan"}</DialogTitle>
          <DialogDescription>
            {pledge
              ? `Schedule how to pay the ${formatCurrency(pledge.totalAmount)} pledge to ${pledge.campaignName}.`
              : "Choose an installment schedule."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-4">
          <div className="flex flex-col gap-2">
            <Label>Payment frequency</Label>
            <Select
              value={form.frequency}
              onValueChange={(value) => setForm({ ...form, frequency: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="quarterly">Quarterly</SelectItem>
                <SelectItem value="annually">Annually</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Number of payments</Label>
            <Input
              type="number"
              min={2}
              value={form.numberOfPayments}
              onChange={(event) => {
                const numberOfPayments = event.target.value
                const totalAmount = pledge?.totalAmount ?? 0
                const installmentAmount =
                  totalAmount > 0 && Number(numberOfPayments) > 0
                    ? String(calculateInstallmentAmount(totalAmount, Number(numberOfPayments)))
                    : form.installmentAmount
                setForm({
                  ...form,
                  numberOfPayments,
                  installmentAmount,
                })
              }}
              placeholder="10"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Amount per payment</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                $
              </span>
              <Input
                type="number"
                value={form.installmentAmount}
                onChange={(event) =>
                  setForm({
                    ...form,
                    installmentAmount: event.target.value,
                  })
                }
                className="pl-7"
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label>First payment date</Label>
            <Input
              type="date"
              value={form.firstPaymentDate}
              onChange={(event) =>
                setForm({
                  ...form,
                  firstPaymentDate: event.target.value,
                })
              }
            />
          </div>

          {pledge ? (
            <div className="rounded-lg bg-muted/50 p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total pledge</span>
                <span className="font-medium">{formatCurrency(pledge.totalAmount)}</span>
              </div>
              <div className="mt-1 flex justify-between">
                <span className="text-muted-foreground">Remaining balance</span>
                <span className="font-medium">{formatCurrency(pledge.balance)}</span>
              </div>
            </div>
          ) : null}

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={() =>
              void onSave({
                installmentAmount: Number(form.installmentAmount || 0),
                numberOfPayments: Number(form.numberOfPayments || 0),
                frequency: form.frequency as PledgePlanFrequency,
                firstPaymentDate: form.firstPaymentDate,
              })
            }
            disabled={
              saving ||
              !pledge ||
              !form.installmentAmount ||
              !form.numberOfPayments ||
              !form.firstPaymentDate
            }
          >
            {saving ? "Saving..." : "Save Payment Plan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
