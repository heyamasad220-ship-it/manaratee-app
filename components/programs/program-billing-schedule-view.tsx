"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import {
  adjustChargeScheduleAction,
  addEnrollmentFeeAction,
  createBillingOverrideAction,
  waiveChargeScheduleAction,
} from "@/lib/programs/program-billing-actions"
import type {
  OfferingBillingScheduleBundle,
  ProgramChargeScheduleItemExtended,
} from "@/lib/programs/program-billing-types"
import {
  BILLING_OVERRIDE_TYPE_LABELS,
  CHARGE_SCHEDULE_STATUS_LABELS,
} from "@/lib/programs/program-billing-types"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value || 0)
}

function formatDate(value: string | null) {
  if (!value) return "—"
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function scheduleStatusVariant(status: string) {
  if (status === "paid") return "default"
  if (status === "waived" || status === "void") return "secondary"
  if (status === "due" || status === "past_due") return "destructive"
  if (status === "adjusted") return "outline"
  return "secondary"
}

function findScheduleForPeriod(
  items: ProgramChargeScheduleItemExtended[],
  billingPeriodId: string
) {
  return items.find((item) => item.billing_period_id === billingPeriodId)
}

export function ProgramBillingScheduleView({
  programId,
  bundle,
  readOnly = false,
}: {
  programId: string
  bundle: OfferingBillingScheduleBundle
  readOnly?: boolean
}) {
  const router = useRouter()
  const [pending, setPending] = React.useState(false)
  const [message, setMessage] = React.useState<string | null>(null)

  const [overrideType, setOverrideType] = React.useState("waive")
  const [overridePeriodId, setOverridePeriodId] = React.useState("")
  const [overrideEnrollmentId, setOverrideEnrollmentId] = React.useState("")
  const [overrideLabel, setOverrideLabel] = React.useState("")
  const [overrideAmount, setOverrideAmount] = React.useState("")
  const [overrideReason, setOverrideReason] = React.useState("")
  const [applyToAll, setApplyToAll] = React.useState(false)

  const [feeEnrollmentId, setFeeEnrollmentId] = React.useState("")
  const [feeLabel, setFeeLabel] = React.useState("")
  const [feeAmount, setFeeAmount] = React.useState("")
  const [feePeriodId, setFeePeriodId] = React.useState("")

  async function runAction(action: () => Promise<{ ok: boolean; error?: string }>) {
    setPending(true)
    setMessage(null)

    const result = await action()

    setPending(false)

    if (!result.ok) {
      setMessage(result.error || "Action failed")
      return
    }

    setMessage("Saved")
    router.refresh()
  }

  async function handleWaive(scheduleId: string) {
    const reason = window.prompt("Reason for waiving this charge?") || ""

    await runAction(async () => {
      const formData = new FormData()
      formData.set("schedule_id", scheduleId)
      formData.set("program_id", programId)
      formData.set("reason", reason)
      return waiveChargeScheduleAction(formData)
    })
  }

  async function handleAdjust(scheduleId: string, currentAmount: number) {
    const nextAmount = window.prompt(
      "New amount for this charge?",
      String(currentAmount)
    )

    if (nextAmount === null) return

    const reason = window.prompt("Reason for adjustment?") || ""

    await runAction(async () => {
      const formData = new FormData()
      formData.set("schedule_id", scheduleId)
      formData.set("program_id", programId)
      formData.set("new_amount", nextAmount)
      formData.set("reason", reason)
      return adjustChargeScheduleAction(formData)
    })
  }

  async function handleOverrideSubmit(event: React.FormEvent) {
    event.preventDefault()

    await runAction(async () => {
      const formData = new FormData()
      formData.set("offering_id", bundle.offering.id)
      formData.set("program_id", programId)
      formData.set("override_type", overrideType)
      formData.set("label", overrideLabel)
      if (overridePeriodId) formData.set("billing_period_id", overridePeriodId)
      if (overrideEnrollmentId) {
        formData.set("enrollment_id", overrideEnrollmentId)
      }
      if (overrideAmount) formData.set("amount", overrideAmount)
      formData.set("reason", overrideReason)
      formData.set("apply_to_all", applyToAll ? "true" : "false")
      return createBillingOverrideAction(formData)
    })
  }

  async function handleAddFeeSubmit(event: React.FormEvent) {
    event.preventDefault()

    await runAction(async () => {
      const formData = new FormData()
      formData.set("enrollment_id", feeEnrollmentId)
      formData.set("program_id", programId)
      formData.set("label", feeLabel)
      formData.set("amount", feeAmount)
      if (feePeriodId) formData.set("billing_period_id", feePeriodId)
      return addEnrollmentFeeAction(formData)
    })
  }

  return (
    <div className="flex flex-col gap-6">
      {message ? (
        <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm">
          {message}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Billing Periods</CardTitle>
          <CardDescription>
            Canonical monthly calendar for {bundle.offering.name}. Late
            enrollments only receive charges from their join month through the
            offering end date.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {bundle.billing_periods.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {readOnly
                ? "Billing periods will appear after migration 021 is applied and the offering has start/end dates."
                : "No billing periods yet. Set offering start and end dates, then refresh this page."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Default Tuition</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bundle.billing_periods.map((period) => (
                  <TableRow key={period.id}>
                    <TableCell className="font-medium">
                      {period.period_label}
                    </TableCell>
                    <TableCell>{formatDate(period.due_date)}</TableCell>
                    <TableCell>
                      {period.default_tuition_amount !== null
                        ? formatCurrency(period.default_tuition_amount)
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{period.period_status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Participant Balances</CardTitle>
          <CardDescription>
            Scheduled charges per participant. Payment collection is not enabled
            in Phase 2B — this is charge management only.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {bundle.participants.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No active enrollments with charges for this offering.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Participant</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Balance Due</TableHead>
                  <TableHead>Paid</TableHead>
                  <TableHead>Scheduled Items</TableHead>
                  <TableHead className="w-[120px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bundle.participants.map((participant) => (
                  <TableRow key={participant.enrollment_id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{participant.participant_name}</p>
                        <Link
                          href={`/programs/registrations/${participant.enrollment_id}`}
                          className="text-xs text-primary hover:underline"
                        >
                          View registration
                        </Link>
                      </div>
                    </TableCell>
                    <TableCell>{participant.status || "—"}</TableCell>
                    <TableCell>{formatCurrency(participant.balance_due)}</TableCell>
                    <TableCell>{formatCurrency(participant.balance_paid)}</TableCell>
                    <TableCell>
                      {participant.schedule_items.length === 0 ? (
                        <span className="text-muted-foreground">No schedule</span>
                      ) : (
                        <div className="space-y-1">
                          {participant.schedule_items.map((item) => (
                            <div
                              key={item.id}
                              className="flex flex-wrap items-center gap-2 text-xs"
                            >
                              <span>{item.label}</span>
                              <span className="text-muted-foreground">
                                {formatDate(item.due_date)} ·{" "}
                                {formatCurrency(item.amount)}
                              </span>
                              <Badge variant={scheduleStatusVariant(item.status)}>
                                {CHARGE_SCHEDULE_STATUS_LABELS[item.status] ||
                                  item.status}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {participant.charge_id && !readOnly ? (
                        <div className="flex flex-col gap-1">
                          {participant.schedule_items
                            .filter((item) =>
                              ["scheduled", "due", "adjusted"].includes(item.status)
                            )
                            .slice(0, 2)
                            .map((item) => (
                              <div key={item.id} className="flex gap-1">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  disabled={pending}
                                  onClick={() => handleWaive(item.id)}
                                >
                                  Waive
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  disabled={pending}
                                  onClick={() =>
                                    handleAdjust(item.id, item.amount)
                                  }
                                >
                                  Adjust
                                </Button>
                              </div>
                            ))}
                        </div>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {bundle.billing_periods.length > 0 && bundle.participants.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Period Matrix</CardTitle>
            <CardDescription>
              Monthly tuition rows by participant and billing period.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Participant</TableHead>
                  {bundle.billing_periods.map((period) => (
                    <TableHead key={period.id} className="min-w-[110px]">
                      {period.period_key}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {bundle.participants.map((participant) => (
                  <TableRow key={participant.enrollment_id}>
                    <TableCell className="font-medium">
                      {participant.participant_name}
                    </TableCell>
                    {bundle.billing_periods.map((period) => {
                      const item = findScheduleForPeriod(
                        participant.schedule_items,
                        period.id
                      )

                      return (
                        <TableCell key={period.id} className="text-xs">
                          {item ? (
                            <div className="space-y-1">
                              <div>{formatCurrency(item.amount)}</div>
                              <Badge
                                variant={scheduleStatusVariant(item.status)}
                                className="text-[10px]"
                              >
                                {item.status}
                              </Badge>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      )
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      {!readOnly ? (
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Billing Override</CardTitle>
            <CardDescription>
              Waive, adjust, skip, or add fees for one participant or all
              participants in this offering.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleOverrideSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Override type</Label>
                <Select value={overrideType} onValueChange={setOverrideType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(BILLING_OVERRIDE_TYPE_LABELS).map(
                      ([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Billing period</Label>
                <Select
                  value={overridePeriodId}
                  onValueChange={setOverridePeriodId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select period (optional for some fees)" />
                  </SelectTrigger>
                  <SelectContent>
                    {bundle.billing_periods.map((period) => (
                      <SelectItem key={period.id} value={period.id}>
                        {period.period_label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Participant (leave blank for offering-wide)</Label>
                <Select
                  value={overrideEnrollmentId}
                  onValueChange={setOverrideEnrollmentId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="One participant" />
                  </SelectTrigger>
                  <SelectContent>
                    {bundle.participants.map((participant) => (
                      <SelectItem
                        key={participant.enrollment_id}
                        value={participant.enrollment_id}
                      >
                        {participant.participant_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Label</Label>
                <Input
                  value={overrideLabel}
                  onChange={(event) => setOverrideLabel(event.target.value)}
                  placeholder="Book fee, materials fee, etc."
                  required
                />
              </div>

              {overrideType === "adjust_amount" || overrideType === "add_fee" ? (
                <div className="space-y-2">
                  <Label>Amount</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={overrideAmount}
                    onChange={(event) => setOverrideAmount(event.target.value)}
                  />
                </div>
              ) : null}

              <div className="space-y-2">
                <Label>Reason</Label>
                <Textarea
                  value={overrideReason}
                  onChange={(event) => setOverrideReason(event.target.value)}
                  rows={2}
                />
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={applyToAll}
                  onChange={(event) => setApplyToAll(event.target.checked)}
                />
                Apply to all participants in this offering
              </label>

              <Button type="submit" disabled={pending}>
                Apply Override
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Add One-Time Fee</CardTitle>
            <CardDescription>
              Add a book fee, childcare fee, materials fee, or other charge to a
              specific participant&apos;s schedule.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddFeeSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Participant</Label>
                <Select
                  value={feeEnrollmentId}
                  onValueChange={setFeeEnrollmentId}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select participant" />
                  </SelectTrigger>
                  <SelectContent>
                    {bundle.participants.map((participant) => (
                      <SelectItem
                        key={participant.enrollment_id}
                        value={participant.enrollment_id}
                      >
                        {participant.participant_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Fee label</Label>
                <Input
                  value={feeLabel}
                  onChange={(event) => setFeeLabel(event.target.value)}
                  placeholder="Book fee"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Amount</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={feeAmount}
                  onChange={(event) => setFeeAmount(event.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Billing period (optional)</Label>
                <Select value={feePeriodId} onValueChange={setFeePeriodId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Attach to a month" />
                  </SelectTrigger>
                  <SelectContent>
                    {bundle.billing_periods.map((period) => (
                      <SelectItem key={period.id} value={period.id}>
                        {period.period_label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button type="submit" disabled={pending}>
                Add Fee
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
      ) : null}

      {bundle.overrides.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Recent Overrides</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Label</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bundle.overrides.map((override) => (
                  <TableRow key={override.id}>
                    <TableCell>
                      {BILLING_OVERRIDE_TYPE_LABELS[override.override_type]}
                    </TableCell>
                    <TableCell>{override.label}</TableCell>
                    <TableCell>
                      {override.amount !== null
                        ? formatCurrency(override.amount)
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {override.apply_to_all
                        ? "All participants"
                        : override.enrollment_id
                          ? "One participant"
                          : "Offering"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {override.reason || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
