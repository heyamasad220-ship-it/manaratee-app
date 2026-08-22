"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { AlertCircle, FileText, Mail, Send } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
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
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import {
  DonationMetricCard,
  DonationMetricCardGrid,
} from "@/components/donations/donation-metric-card"
import { GivingStatementActions } from "@/components/donations/giving-statement-actions"
import { PaymentReceiptActions } from "@/components/donations/payment-receipt-actions"
import {
  getReceiptReportingSummaryAction,
  listMissingPaymentReceiptsAction,
  listPaymentReceiptsAction,
  sendBulkAnnualStatementsAction,
  type PaymentReceiptListRow,
} from "@/lib/donations/receipt-actions"
import {
  getAnnualStatementKpisAction,
  getDonationTaxYearTotalsAction,
} from "@/lib/donations/donation-reports-actions"
import { donationReceiptsHref } from "@/lib/donations/donation-payment-paths"
import { formatDonationCurrency } from "@/lib/donations/campaign-analytics"
import { clearSelectedOrganizationIdCache } from "@/lib/current-organization"
import { cn } from "@/lib/utils"

type ReceiptsTab = "receipts" | "statements"

function formatDate(value: string | null) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
}

function receiptStatusLabel(status: string) {
  if (status === "sent") return "Sent"
  if (status === "resent") return "Resent"
  if (status === "missing") return "Missing"
  if (status === "failed") return "Failed"
  return "Not sent"
}

export function DonationReceiptsWorkspace() {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const tab: ReceiptsTab = searchParams.get("tab") === "statements" ? "statements" : "receipts"
  const receiptView = searchParams.get("status") === "missing" ? "missing" : "generated"

  const [summaryLoading, setSummaryLoading] = useState(true)
  const [receiptsLoading, setReceiptsLoading] = useState(true)
  const [donorsLoading, setDonorsLoading] = useState(true)
  const [receiptSummary, setReceiptSummary] = useState<{
    receiptsGenerated: number
    receiptsSent: number
    receiptsNotSent: number
    missingReceipts: number
    totalPayments: number
  } | null>(null)
  const [receiptRows, setReceiptRows] = useState<PaymentReceiptListRow[]>([])
  const [statementYear, setStatementYear] = useState(String(new Date().getFullYear()))
  const [yearEndDonorTotals, setYearEndDonorTotals] = useState<
    Array<{ id: string; name: string; email: string; total: number; count: number }>
  >([])
  const [statementKpis, setStatementKpis] = useState<{
    eligibleDonors: number
    statementsGenerated: number
    statementsSent: number
    needAttention: number
  } | null>(null)
  const [selectedDonors, setSelectedDonors] = useState<string[]>([])
  const [bulkSending, setBulkSending] = useState(false)

  useEffect(() => {
    async function loadSummary() {
      clearSelectedOrganizationIdCache()
      setSummaryLoading(true)
      const result = await getReceiptReportingSummaryAction()
      if (result.success) {
        setReceiptSummary(result.summary)
      }
      setSummaryLoading(false)
    }

    void loadSummary()
  }, [pathname])

  useEffect(() => {
    async function loadReceipts() {
      setReceiptsLoading(true)
      const result =
        receiptView === "missing"
          ? await listMissingPaymentReceiptsAction()
          : await listPaymentReceiptsAction()
      if (result.success) {
        setReceiptRows(result.rows)
      }
      setReceiptsLoading(false)
    }

    if (tab === "receipts") {
      void loadReceipts()
    }
  }, [tab, pathname, receiptView])

  useEffect(() => {
    async function loadDonors() {
      clearSelectedOrganizationIdCache()
      setDonorsLoading(true)
      const [totalsResult, kpiResult] = await Promise.all([
        getDonationTaxYearTotalsAction(Number(statementYear)),
        getAnnualStatementKpisAction(Number(statementYear)),
      ])
      if (totalsResult.success) {
        setYearEndDonorTotals(
          totalsResult.donors.map((donor) => ({
            id: donor.donorId,
            name: donor.donorName,
            email: donor.donorEmail,
            total: donor.totalAmount,
            count: donor.paymentCount,
          }))
        )
        setSelectedDonors([])
      }
      if (kpiResult.success) {
        setStatementKpis(kpiResult.kpis)
      }
      setDonorsLoading(false)
    }

    if (tab === "statements") {
      void loadDonors()
    }
  }, [tab, pathname, statementYear])

  const handleSelectAll = () => {
    if (selectedDonors.length === yearEndDonorTotals.length) {
      setSelectedDonors([])
    } else {
      setSelectedDonors(yearEndDonorTotals.map((d) => d.id))
    }
  }

  const handleSelectDonor = (id: string) => {
    if (selectedDonors.includes(id)) {
      setSelectedDonors(selectedDonors.filter((donorId) => donorId !== id))
    } else {
      setSelectedDonors([...selectedDonors, id])
    }
  }

  async function handleBulkSendStatements() {
    if (!selectedDonors.length) {
      alert("Select at least one donor.")
      return
    }

    if (
      !confirm(`Send ${selectedDonors.length} year-end statement email(s) for ${statementYear}?`)
    ) {
      return
    }

    setBulkSending(true)
    const result = await sendBulkAnnualStatementsAction(selectedDonors, Number(statementYear))
    setBulkSending(false)

    if (!result.success) {
      alert(result.error || "Bulk send failed")
      return
    }

    const kpiResult = await getAnnualStatementKpisAction(Number(statementYear))
    if (kpiResult.success) setStatementKpis(kpiResult.kpis)
    alert(`Statements sent: ${result.sentCount}. Failed: ${result.failedCount}.`)
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Receipts & Statements</h2>
        <p className="text-sm text-muted-foreground">
          Transaction receipts and annual donor giving statements based on qualifying received
          payments.
        </p>
      </div>

      <div className="flex gap-1 rounded-lg border bg-muted/40 p-1 w-fit">
        {(
          [
            { id: "receipts" as const, label: "Receipts" },
            { id: "statements" as const, label: "Year-End Statements" },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => router.push(donationReceiptsHref({ tab: item.id }))}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium",
              tab === item.id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "receipts" ? (
        <>
          {summaryLoading ? (
            <p className="text-sm text-muted-foreground">Loading receipt summary...</p>
          ) : (
            <DonationMetricCardGrid colorful columns={4}>
              <DonationMetricCard
                title="Receipts Generated"
                value={receiptSummary?.receiptsGenerated ?? 0}
                icon={FileText}
                accent="blue"
              />
              <DonationMetricCard
                title="Receipts Sent"
                value={receiptSummary?.receiptsSent ?? 0}
                icon={Send}
                accent="emerald"
              />
              <DonationMetricCard
                title="Not Sent"
                value={receiptSummary?.receiptsNotSent ?? 0}
                icon={Mail}
                accent="amber"
              />
              <DonationMetricCard
                title="Missing Receipts"
                value={receiptSummary?.missingReceipts ?? 0}
                icon={AlertCircle}
                accent="rose"
                description={`of ${receiptSummary?.totalPayments ?? 0} payments`}
                onClick={() => router.push(donationReceiptsHref({ status: "missing" }))}
              />
            </DonationMetricCardGrid>
          )}

          <Card>
            <CardHeader>
              <CardTitle>
                {receiptView === "missing" ? "Missing Receipts" : "Transaction Receipts"}
              </CardTitle>
              <CardDescription>
                {receiptView === "missing"
                  ? "Payments that do not yet have a generated receipt. Generate from the row menu."
                  : "Per-payment receipts. Generate or send from the row menu."}
              </CardDescription>
              <div className="flex flex-wrap items-center gap-2 pt-2">
                <Select
                  value={receiptView}
                  onValueChange={(value) =>
                    router.push(
                      donationReceiptsHref({
                        status: value === "missing" ? "missing" : undefined,
                      })
                    )
                  }
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="generated">Generated</SelectItem>
                    <SelectItem value="missing">Missing</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Donor</TableHead>
                    <TableHead>Donation Amount</TableHead>
                    <TableHead>Payment Method</TableHead>
                    <TableHead>Receipt Number</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Sent Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {receiptsLoading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                        Loading receipts...
                      </TableCell>
                    </TableRow>
                  ) : receiptRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                        No {receiptView === "missing" ? "missing receipts" : "transaction receipts generated yet"}.
                      </TableCell>
                    </TableRow>
                  ) : (
                    receiptRows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>{formatDate(row.paymentDate || row.createdAt)}</TableCell>
                        <TableCell className="font-medium">{row.donorName}</TableCell>
                        <TableCell>{formatDonationCurrency(row.amount)}</TableCell>
                        <TableCell className="capitalize text-muted-foreground">
                          {row.paymentSource || "—"}
                        </TableCell>
                        <TableCell>{row.receiptNumber || "—"}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{receiptStatusLabel(row.status)}</Badge>
                        </TableCell>
                        <TableCell>{formatDate(row.sentAt)}</TableCell>
                        <TableCell className="text-right">
                          {row.paymentId ? (
                            <PaymentReceiptActions
                              paymentId={row.paymentId}
                              receiptNumber={row.receiptNumber}
                              receiptStatus={row.status}
                              compact
                              onUpdated={() => {
                                void (async () => {
                                  const result =
                                    receiptView === "missing"
                                      ? await listMissingPaymentReceiptsAction()
                                      : await listPaymentReceiptsAction()
                                  if (result.success) setReceiptRows(result.rows)
                                  const summary = await getReceiptReportingSummaryAction()
                                  if (summary.success) setReceiptSummary(summary.summary)
                                })()
                              }}
                            />
                          ) : (
                            "—"
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      ) : (
        <>
          <div>
            <h3 className="text-lg font-semibold">Year-End Giving Statements</h3>
            <p className="text-sm text-muted-foreground">
              Annual donor giving summaries based on qualifying received payments. Unpaid pledge
              balances are not included.
            </p>
          </div>

          {donorsLoading && !statementKpis ? (
            <p className="text-sm text-muted-foreground">Loading statement summary...</p>
          ) : (
            <DonationMetricCardGrid colorful columns={4}>
              <DonationMetricCard
                title="Eligible Donors"
                value={statementKpis?.eligibleDonors ?? yearEndDonorTotals.length}
                icon={FileText}
                accent="blue"
              />
              <DonationMetricCard
                title="Statements Generated"
                value={statementKpis?.statementsGenerated ?? 0}
                icon={Mail}
                accent="purple"
                description="Annual statement records"
              />
              <DonationMetricCard
                title="Statements Sent"
                value={statementKpis?.statementsSent ?? 0}
                icon={Send}
                accent="emerald"
              />
              <DonationMetricCard
                title="Need Attention"
                value={statementKpis?.needAttention ?? 0}
                icon={AlertCircle}
                accent="amber"
                description="Eligible donors without a statement"
              />
            </DonationMetricCardGrid>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Year-End Giving Statements</CardTitle>
              <CardDescription>
                Totals come from actual received payments for the selected tax year.
              </CardDescription>
              <div className="flex flex-wrap items-center gap-2 pt-2">
                <Select value={statementYear} onValueChange={setStatementYear}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[0, 1, 2].map((offset) => {
                      const year = new Date().getFullYear() - offset
                      return (
                        <SelectItem key={year} value={String(year)}>
                          {year}
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
                <Button
                  variant="default"
                  size="sm"
                  disabled={bulkSending || selectedDonors.length === 0}
                  onClick={() => void handleBulkSendStatements()}
                >
                  <Send className="mr-2 h-4 w-4" />
                  {bulkSending ? "Sending..." : `Send Selected (${selectedDonors.length})`}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">
                      <Checkbox
                        checked={
                          selectedDonors.length === yearEndDonorTotals.length &&
                          yearEndDonorTotals.length > 0
                        }
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Donor</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Number of Gifts</TableHead>
                    <TableHead>Total Eligible Giving</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {donorsLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                        Loading year-end totals...
                      </TableCell>
                    </TableRow>
                  ) : yearEndDonorTotals.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                        No qualifying payments for {statementYear}.
                      </TableCell>
                    </TableRow>
                  ) : (
                    yearEndDonorTotals.map((donor) => (
                      <TableRow key={donor.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedDonors.includes(donor.id)}
                            onCheckedChange={() => handleSelectDonor(donor.id)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{donor.name}</TableCell>
                        <TableCell>{donor.email || "N/A"}</TableCell>
                        <TableCell>{donor.count}</TableCell>
                        <TableCell>{formatDonationCurrency(donor.total)}</TableCell>
                        <TableCell className="text-right">
                          <GivingStatementActions
                            donorId={donor.id}
                            donorName={donor.name}
                            year={Number(statementYear)}
                            defaultYear={Number(statementYear)}
                            menuOnly
                          />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
