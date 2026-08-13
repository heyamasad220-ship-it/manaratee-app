"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Pencil, Plus, Trash2 } from "lucide-react"

import {
  addChargeLineAction,
  adjustChargeLineAction,
  ensureEnrollmentChargeAction,
  voidChargeLineAction,
} from "@/lib/programs/program-charge-actions"
import type { EnrollmentChargeBundle } from "@/lib/programs/program-charge-queries"
import type { ProgramChargeLine } from "@/lib/programs/program-charge-types"
import type { ProgramRegistrationQuote } from "@/lib/programs/program-quote-types"
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

const FEE_PRESETS = [
  { id: "lunch", lineType: "lunch", label: "Lunch" },
  { id: "before_care", lineType: "extended_care", label: "Before Care" },
  { id: "after_care", lineType: "extended_care", label: "After Care" },
  { id: "materials", lineType: "materials", label: "Materials Fee" },
  { id: "tuition", lineType: "tuition", label: "Program Fee" },
  { id: "custom", lineType: "custom", label: "Custom Fee" },
] as const

function formatCurrency(value: number | null | undefined) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value || 0)
}

function lineIsVoided(line: ProgramChargeLine) {
  return (line.metadata?.status as string | undefined) === "voided"
}

function QuoteFallbackTable({ quote }: { quote: ProgramRegistrationQuote }) {
  return (
    <>
      {quote.line_items?.length ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Unit</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {quote.line_items.map((item, index) => (
              <TableRow key={`${item.component_type}-${index}`}>
                <TableCell>{item.label}</TableCell>
                <TableCell className="text-right">{item.quantity}</TableCell>
                <TableCell className="text-right">
                  {formatCurrency(item.unit_amount)}
                </TableCell>
                <TableCell className="text-right">
                  {formatCurrency(item.amount)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : null}
      <div className="space-y-1 border-t pt-3 text-sm">
        <div className="flex justify-between font-semibold">
          <span>Total</span>
          <span>{formatCurrency(quote.total)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Due today</span>
          <span>{formatCurrency(quote.due_today)}</span>
        </div>
      </div>
    </>
  )
}

export function RegistrationChargeEditor({
  enrollmentId,
  programId,
  chargeBundle,
  quoteSnapshot,
  readOnly = false,
}: {
  enrollmentId: string
  programId: string | null
  chargeBundle: EnrollmentChargeBundle
  quoteSnapshot: unknown
  readOnly?: boolean
}) {
  const router = useRouter()
  const [pending, setPending] = React.useState(false)
  const [message, setMessage] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const [editingLineId, setEditingLineId] = React.useState<string | null>(null)
  const [editUnit, setEditUnit] = React.useState("")
  const [editQty, setEditQty] = React.useState("1")
  const [editReason, setEditReason] = React.useState("")

  const [addPreset, setAddPreset] = React.useState("custom")
  const [addLabel, setAddLabel] = React.useState("")
  const [addUnit, setAddUnit] = React.useState("")
  const [addQty, setAddQty] = React.useState("1")
  const [addReason, setAddReason] = React.useState("")

  const quote = quoteSnapshot as ProgramRegistrationQuote | null
  const hasCharge = Boolean(chargeBundle.chargeId)
  const activeLines = chargeBundle.lines.filter((line) => !lineIsVoided(line))
  const voidedLines = chargeBundle.lines.filter(lineIsVoided)

  async function runAction(action: () => Promise<{ ok: boolean; error?: string }>) {
    setPending(true)
    setMessage(null)
    setError(null)

    const result = await action()
    setPending(false)

    if (!result.ok) {
      setError(result.error || "Action failed")
      return
    }

    setMessage("Saved")
    setEditingLineId(null)
    router.refresh()
  }

  async function handleEnsureCharge() {
    await runAction(async () => {
      const formData = new FormData()
      formData.set("enrollment_id", enrollmentId)
      if (programId) formData.set("program_id", programId)
      return ensureEnrollmentChargeAction(formData)
    })
  }

  async function handleVoid(lineId: string) {
    const reason = window.prompt("Reason for removing this fee?") || ""

    await runAction(async () => {
      const formData = new FormData()
      formData.set("line_id", lineId)
      formData.set("enrollment_id", enrollmentId)
      if (programId) formData.set("program_id", programId)
      formData.set("reason", reason)
      return voidChargeLineAction(formData)
    })
  }

  async function handleAdjustSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!editingLineId) return

    await runAction(async () => {
      const formData = new FormData()
      formData.set("line_id", editingLineId)
      formData.set("enrollment_id", enrollmentId)
      if (programId) formData.set("program_id", programId)
      formData.set("unit_amount", editUnit)
      formData.set("quantity", editQty)
      formData.set("reason", editReason)
      return adjustChargeLineAction(formData)
    })
  }

  async function handleAddSubmit(event: React.FormEvent) {
    event.preventDefault()

    if (!chargeBundle.chargeId) return

    const preset = FEE_PRESETS.find((item) => item.id === addPreset)

    await runAction(async () => {
      const formData = new FormData()
      formData.set("charge_id", chargeBundle.chargeId as string)
      formData.set("enrollment_id", enrollmentId)
      if (programId) formData.set("program_id", programId)
      formData.set("line_type", preset?.lineType || "custom")
      formData.set(
        "label",
        addLabel || preset?.label || "Custom Fee"
      )
      formData.set("unit_amount", addUnit)
      formData.set("quantity", addQty)
      formData.set("reason", addReason)
      return addChargeLineAction(formData)
    })
  }

  function startEdit(line: ProgramChargeLine) {
    setEditingLineId(line.id)
    setEditUnit(String(line.unit_amount))
    setEditQty(String(line.quantity))
    setEditReason(String(line.metadata?.adjustment_reason || ""))
  }

  function handlePresetChange(value: string) {
    setAddPreset(value)
    const preset = FEE_PRESETS.find((item) => item.id === value)
    if (preset) {
      setAddLabel(preset.label)
    }
  }

  if (!chargeBundle.schemaReady) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Registration Fees</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Run scripts/020 and scripts/022 in Supabase to enable fee editing.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Registration Fees</CardTitle>
        <CardDescription>
          {readOnly
            ? "Fees are read-only because this registration is cancelled or closed."
            : hasCharge
              ? "Adjust, remove, or add fees for this registration. Changes update the charge ledger and enrollment total."
              : "This registration has no charge ledger yet (created before auto-charge wiring). Click below to create one from the saved quote, or register anew after migration 023."}
          {chargeBundle.planType
            ? ` (${chargeBundle.planType.replace("_", " ")})`
            : quote?.plan_type
              ? ` (${quote.plan_type.replace("_", " ")})`
              : null}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {message ? (
          <p className="text-sm text-green-700">{message}</p>
        ) : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {!hasCharge ? (
          <div className="space-y-4">
            {quote?.ok ? <QuoteFallbackTable quote={quote} /> : null}
            {!readOnly ? (
              <Button type="button" onClick={handleEnsureCharge} disabled={pending}>
                Create Charge Ledger from Quote
              </Button>
            ) : null}
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Unit</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  {!readOnly ? <TableHead className="w-[140px]" /> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeLines.map((line) => (
                  <TableRow key={line.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span>{line.label}</span>
                        {(line.metadata?.status as string) === "adjusted" ? (
                          <Badge variant="outline" className="text-xs">
                            Adjusted
                          </Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{line.quantity}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(line.unit_amount)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(line.amount)}
                    </TableCell>
                    {!readOnly ? (
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={pending}
                            aria-label={`Edit ${line.label}`}
                            onClick={() => startEdit(line)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={pending}
                            aria-label={`Remove ${line.label}`}
                            onClick={() => handleVoid(line.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {voidedLines.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">
                  Removed fees
                </p>
                {voidedLines.map((line) => (
                  <div
                    key={line.id}
                    className="flex justify-between text-sm text-muted-foreground line-through"
                  >
                    <span>{line.label}</span>
                    <span>
                      {formatCurrency(
                        Number(line.metadata?.original_amount || 0)
                      )}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="space-y-1 border-t pt-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatCurrency(chargeBundle.subtotal)}</span>
              </div>
              {chargeBundle.discountTotal > 0 ? (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Discounts</span>
                  <span>−{formatCurrency(chargeBundle.discountTotal)}</span>
                </div>
              ) : null}
              <div className="flex justify-between font-semibold">
                <span>Total</span>
                <span>{formatCurrency(chargeBundle.total)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Due today</span>
                <span>{formatCurrency(chargeBundle.dueToday)}</span>
              </div>
            </div>

            {!readOnly && editingLineId ? (
              <form
                onSubmit={handleAdjustSubmit}
                className="rounded-lg border bg-muted/20 p-4 space-y-3"
              >
                <p className="text-sm font-medium">Adjust line item</p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1">
                    <Label>Unit amount</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editUnit}
                      onChange={(e) => setEditUnit(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Quantity</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editQty}
                      onChange={(e) => setEditQty(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Reason</Label>
                    <Input
                      value={editReason}
                      onChange={(e) => setEditReason(e.target.value)}
                      placeholder="Optional"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button type="submit" size="sm" disabled={pending}>
                    Save Adjustment
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingLineId(null)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            ) : null}

            {!readOnly ? (
              <form
                onSubmit={handleAddSubmit}
                className="rounded-lg border p-4 space-y-3"
              >
              <div className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                <p className="text-sm font-medium">Add fee</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-1">
                  <Label>Fee type</Label>
                  <Select value={addPreset} onValueChange={handlePresetChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FEE_PRESETS.map((preset) => (
                        <SelectItem key={preset.id} value={preset.id}>
                          {preset.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Label</Label>
                  <Input
                    value={addLabel}
                    onChange={(e) => setAddLabel(e.target.value)}
                    placeholder="Lunch"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Unit amount</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={addUnit}
                    onChange={(e) => setAddUnit(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label>Quantity</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={addQty}
                    onChange={(e) => setAddQty(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Reason (optional)</Label>
                <Textarea
                  value={addReason}
                  onChange={(e) => setAddReason(e.target.value)}
                  rows={2}
                />
              </div>
              <Button type="submit" disabled={pending}>
                Add Fee
              </Button>
            </form>
            ) : null}
          </>
        )}

        {quote?.ok ? (
          <details className="text-sm text-muted-foreground">
            <summary className="cursor-pointer font-medium text-foreground">
              Original quote snapshot
            </summary>
            <div className="mt-3">
              <QuoteFallbackTable quote={quote} />
            </div>
          </details>
        ) : null}
      </CardContent>
    </Card>
  )
}
