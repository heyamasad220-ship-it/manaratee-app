"use client"

import * as React from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { fetchProgramFaAwardsReportAction, removeEnrollmentFaAwardAction } from "@/lib/programs/fa-awards"
import {
  formatFaAwardPlanLabel,
  type ProgramFaAwardRow,
} from "@/lib/programs/fa-awards-format"
import { contactProfileHref } from "@/lib/contacts/contact-profile-path"
import {
  PROGRAM_LABEL,
  YEAR_SEASON_LABEL,
} from "@/lib/programs/program-display-labels"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"

function formatCurrency(value: number | null | undefined) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(value || 0))
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return new Date(`${String(value).slice(0, 10)}T00:00:00`).toLocaleDateString(
      "en-US",
      { month: "short", day: "numeric", year: "numeric" }
    )
  }
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function MetricCard({
  label,
  value,
  valueClassName,
}: {
  label: string
  value: React.ReactNode
  valueClassName?: string
}) {
  return (
    <Card className="min-w-0">
      <CardHeader className="space-y-2 p-5">
        <CardDescription className="text-sm">{label}</CardDescription>
        <CardTitle className={cn("text-3xl font-bold tracking-tight", valueClassName)}>
          {value}
        </CardTitle>
      </CardHeader>
    </Card>
  )
}

function SimpleTable({
  loading,
  empty,
  headers,
  rows,
}: {
  loading: boolean
  empty: string
  headers: string[]
  rows: React.ReactNode[][]
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <Table>
          <TableHeader>
            <TableRow>
              {headers.map((header) => (
                <TableHead key={header}>{header}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={headers.length}
                  className="py-10 text-center text-muted-foreground"
                >
                  Loading...
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={headers.length}
                  className="py-10 text-center text-muted-foreground"
                >
                  {empty}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row, index) => (
                <TableRow key={index}>
                  {row.map((cell, cellIndex) => (
                    <TableCell key={cellIndex}>{cell}</TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

/** Staff-applied FA awards (Mark financial assistance) — who, offering, original vs assisted fee. */
export function FinancialAssistanceReportPanel() {
  const [loading, setLoading] = React.useState(true)
  const [items, setItems] = React.useState<ProgramFaAwardRow[]>([])
  const [loadError, setLoadError] = React.useState<string | null>(null)
  const [removingId, setRemovingId] = React.useState<string | null>(null)
  const [actionError, setActionError] = React.useState<string | null>(null)

  const load = React.useCallback(async (opts?: { backfill?: boolean }) => {
    setLoading(true)
    setLoadError(null)
    const result = await fetchProgramFaAwardsReportAction({
      activeOnly: true,
      backfill: opts?.backfill,
    })
    if (!result.success) {
      setLoadError(result.error)
      setItems([])
    } else {
      setItems(result.rows)
    }
    setLoading(false)
  }, [])

  React.useEffect(() => {
    void load()
  }, [load])

  async function handleRemove(award: ProgramFaAwardRow) {
    const confirmed = window.confirm(
      `Remove financial assistance for ${award.participantName}?\n\nFee will be restored to ${formatCurrency(award.originalAmount)} (currently ${formatCurrency(award.assistedAmount)}).`
    )
    if (!confirmed) return

    setRemovingId(award.id)
    setActionError(null)
    const result = await removeEnrollmentFaAwardAction({
      awardId: award.id,
      note: "Removed from Reports (applied in error)",
    })
    setRemovingId(null)
    if (!result.success) {
      setActionError(result.error)
      return
    }
    // Skip backfill on reload — notes still mention FA and used to re-import.
    await load({ backfill: false })
  }

  const totalDiscount = items.reduce(
    (sum, item) => sum + Number(item.discountAmount || 0),
    0
  )
  const totalAssisted = items.reduce(
    (sum, item) => sum + Number(item.assistedAmount || 0),
    0
  )

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold">Financial assistance awards</h3>
        <p className="text-sm text-muted-foreground">
          Participants who received a staff fee reduction (Mark financial assistance),
          with original fee, assisted fee, and plan. Past awards are imported from
          enrollment notes and charge lines when you open this tab. New awards appear
          automatically. Application submissions stay under Submissions.
        </p>
        {loadError ? (
          <p className="mt-2 text-sm text-amber-700">
            {loadError.includes("program_enrollment_fa_awards") ||
            loadError.toLowerCase().includes("does not exist")
              ? "Run scripts/185_program_enrollment_fa_awards.sql in Supabase to enable this report."
              : loadError}
          </p>
        ) : null}
        {actionError ? (
          <p className="mt-2 text-sm text-destructive">{actionError}</p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Active awards" value={items.length} />
        <MetricCard
          label="Total assistance"
          value={formatCurrency(totalDiscount)}
          valueClassName="text-emerald-600"
        />
        <MetricCard label="Assisted fees" value={formatCurrency(totalAssisted)} />
      </div>

      <SimpleTable
        loading={loading}
        empty="No financial assistance awards found. If you already marked FA on Payments, open this tab again after running scripts/185_program_enrollment_fa_awards.sql — past awards are imported automatically."
        headers={[
          "Participant",
          YEAR_SEASON_LABEL,
          PROGRAM_LABEL,
          "Original fee",
          "Assisted fee",
          "Plan",
          "Applied",
          "Actions",
        ]}
        rows={items.map((item) => [
          item.participantContactId ? (
            <Link
              href={contactProfileHref(item.participantContactId)}
              className="font-medium text-primary hover:underline"
            >
              {item.participantName}
            </Link>
          ) : (
            item.participantName
          ),
          item.programName,
          item.offeringName || "—",
          formatCurrency(item.originalAmount),
          formatCurrency(item.assistedAmount),
          <div key={`${item.id}-plan`}>
            <div>{formatFaAwardPlanLabel(item)}</div>
            {item.note ? (
              <div className="text-xs text-muted-foreground">{item.note}</div>
            ) : null}
          </div>,
          <Link
            key={`${item.id}-date`}
            href={`/programs/registrations/${item.enrollmentId}`}
            className="text-primary hover:underline"
          >
            {formatDate(item.appliedAt)}
          </Link>,
          <Button
            key={`${item.id}-remove`}
            type="button"
            size="sm"
            variant="outline"
            className="text-destructive hover:text-destructive"
            disabled={removingId === item.id}
            onClick={() => void handleRemove(item)}
          >
            {removingId === item.id ? (
              <>
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                Removing…
              </>
            ) : (
              "Remove"
            )}
          </Button>,
        ])}
      />
    </div>
  )
}
