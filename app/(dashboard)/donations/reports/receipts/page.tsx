"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { AlertCircle, FileText, Mail, Send } from "lucide-react"

import { Header } from "@/components/layout/header"
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
import {
  DonationMetricCard,
  DonationMetricCardGrid,
} from "@/components/donations/donation-metric-card"
import { GivingStatementActions } from "@/components/donations/giving-statement-actions"
import {
  getReceiptReportingSummaryAction,
  sendBulkAnnualStatementsAction,
} from "@/lib/donations/receipt-actions"
import { getDonationTaxYearTotalsAction } from "@/lib/donations/donation-reports-actions"
import { clearSelectedOrganizationIdCache } from "@/lib/current-organization"

export default function DonationsReceiptsReportPage() {
  const pathname = usePathname()
  const [summaryLoading, setSummaryLoading] = useState(true)
  const [donorsLoading, setDonorsLoading] = useState(true)
  const [receiptSummary, setReceiptSummary] = useState<{
    receiptsGenerated: number
    receiptsSent: number
    receiptsNotSent: number
    missingReceipts: number
    totalPayments: number
  } | null>(null)
  const [statementYear, setStatementYear] = useState(String(new Date().getFullYear()))
  const [yearEndDonorTotals, setYearEndDonorTotals] = useState<
    Array<{ id: string; name: string; email: string; total: number; count: number }>
  >([])
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

    loadSummary()
  }, [pathname])

  useEffect(() => {
    async function loadDonors() {
      clearSelectedOrganizationIdCache()
      setDonorsLoading(true)
      const result = await getDonationTaxYearTotalsAction(Number(statementYear))
      if (result.success) {
        setYearEndDonorTotals(
          result.donors.map((donor) => ({
            id: donor.donorId,
            name: donor.donorName,
            email: donor.donorEmail,
            total: donor.totalAmount,
            count: donor.paymentCount,
          }))
        )
        setSelectedDonors([])
      }
      setDonorsLoading(false)
    }

    loadDonors()
  }, [pathname, statementYear])

  const handleSelectAll = () => {
    if (selectedDonors.length === yearEndDonorTotals.length) {
      setSelectedDonors([])
    } else {
      setSelectedDonors(yearEndDonorTotals.map((d) => d.id))
    }
  }

  const handleSelectDonor = (id: string) => {
    if (selectedDonors.includes(id)) {
      setSelectedDonors(selectedDonors.filter((d) => d !== id))
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
      !confirm(
        `Send ${selectedDonors.length} year-end statement email(s) for ${statementYear}?`
      )
    ) {
      return
    }

    setBulkSending(true)
    const result = await sendBulkAnnualStatementsAction(
      selectedDonors,
      Number(statementYear)
    )
    setBulkSending(false)

    if (!result.success) {
      alert(result.error || "Bulk send failed")
      return
    }

    alert(`Statements sent: ${result.sentCount}. Failed: ${result.failedCount}.`)
  }

  return (
    <>
      <Header title="Receipts" />
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h3 className="mb-3 text-base font-semibold">Receipt Summary</h3>
          {summaryLoading ? (
            <p className="text-muted-foreground">Loading...</p>
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
              />
            </DonationMetricCardGrid>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            Per-payment receipts are available on the Payments list. Year-end giving statements
            for donors are below.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Year-End Giving Statements</CardTitle>
            <CardDescription>
              Annual tax-year summaries from actual payments (one statement per donor per year)
            </CardDescription>
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <Select value={statementYear} onValueChange={setStatementYear}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[0, 1, 2].map((offset) => {
                    const y = new Date().getFullYear() - offset
                    return (
                      <SelectItem key={y} value={String(y)}>
                        {y}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
              <Button
                variant="default"
                size="sm"
                disabled={bulkSending || selectedDonors.length === 0}
                onClick={handleBulkSendStatements}
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
                  <TableHead>Donations</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {donorsLoading && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                      Loading year-end totals...
                    </TableCell>
                  </TableRow>
                )}
                {!donorsLoading && yearEndDonorTotals.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                      No qualifying payments for {statementYear}.
                    </TableCell>
                  </TableRow>
                )}
                {!donorsLoading &&
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
                      <TableCell>${donor.total.toLocaleString()}</TableCell>
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
                  ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
