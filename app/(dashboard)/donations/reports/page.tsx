"use client"

import { useEffect, useMemo, useState } from "react"
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { Download, Heart, DollarSign, Users, TrendingUp, FileText, Send, Printer, Target } from "lucide-react"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { CampaignProgressBar } from "@/components/donations/campaign-progress-bar"
import { GivingStatementActions } from "@/components/donations/giving-statement-actions"
import { sendBulkAnnualStatementsAction } from "@/lib/donations/receipt-actions"
import { getPledgeCollectionReportAction } from "@/lib/donations/pledge-reminder-actions"
import { DONATIONS_PAGE_SIZE } from "@/lib/donations/donation-pagination"
import {
  getDonationReportsOverviewAction,
  getDonationReportsCampaignsAction,
  getDonationReportsDonorsAction,
  getDonationReportsPaymentsAction,
  getDonationTaxYearTotalsAction,
  getRecurringReportSummaryAction,
} from "@/lib/donations/donation-reports-actions"
import { getReceiptReportingSummaryAction } from "@/lib/donations/receipt-actions"
import {
  formatDonationCurrency,
  type CampaignAnalyticsEntry,
} from "@/lib/donations/campaign-analytics"

const reportsTabs = ["Overview", "Donations", "Donors", "Campaigns", "Receipts", "Collection", "Recurring", "Tax Receipts"] as const

type ReportsTab = (typeof reportsTabs)[number]

interface Payment {
  id: string
  donor_id?: string | null
  sender_name?: string | null
  amount?: number | null
  payment_date?: string | null
  source?: string | null
  status?: string | null
}

interface DonorSummary {
  id: string
  full_name: string | null
  email: string | null
  donation_count: number | null
  total_donations: number | null
}

export default function DonationsReportsPage() {
  const [activeTab, setActiveTab] = useState<ReportsTab>("Overview")
  const [dateRange, setDateRange] = useState("30d")
  const [selectedDonors, setSelectedDonors] = useState<string[]>([])
  const [showPreviewDialog, setShowPreviewDialog] = useState(false)
  const [previewDonor, setPreviewDonor] = useState<DonorSummary | null>(null)

  const [overview, setOverview] = useState({
    totalDonations: 0,
    paymentCount: 0,
    averageDonation: 0,
    donorCount: 0,
  })
  const [topDonors, setTopDonors] = useState<DonorSummary[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [paymentsPage, setPaymentsPage] = useState(1)
  const [paymentsTotal, setPaymentsTotal] = useState(0)
  const [donors, setDonors] = useState<DonorSummary[]>([])
  const [donorsPage, setDonorsPage] = useState(1)
  const [donorsTotal, setDonorsTotal] = useState(0)
  const [campaignEntries, setCampaignEntries] = useState<CampaignAnalyticsEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [tabLoading, setTabLoading] = useState(false)
  const [receiptSummary, setReceiptSummary] = useState<{
    receiptsGenerated: number
    receiptsSent: number
    receiptsNotSent: number
    missingReceipts: number
    totalPayments: number
  } | null>(null)
  const [collectionReport, setCollectionReport] = useState<{
    outstandingCount: number
    outstandingTotal: number
    overdueCount: number
    noPaymentCount: number
    partialCount: number
    reminderCount: number
    pledges: Array<{
      id: string
      donorName: string
      campaignName: string | null
      balanceRemaining: number
      lastReminderAt: string | null
      lastContactedAt: string | null
    }>
  } | null>(null)
  const [recurringReport, setRecurringReport] = useState<{
    recurringDonorCount: number
    totalRecurringRevenue: number
    byCampaign: Array<{ campaignId: string | null; campaignName: string; total: number; donorCount: number }>
    byDonor: Array<{ donorId: string; donorName: string; total: number; planCount: number }>
  } | null>(null)
  const [statementYear, setStatementYear] = useState(String(new Date().getFullYear()))
  const [yearEndDonorTotals, setYearEndDonorTotals] = useState<
    Array<{ id: string; name: string; email: string; total: number; count: number }>
  >([])
  const [bulkSending, setBulkSending] = useState(false)

  useEffect(() => {
    async function loadOverview() {
      setLoading(true)

      const [overviewResult, topDonorsResult, receiptResult, collectionResult, recurringResult] =
        await Promise.all([
          getDonationReportsOverviewAction(),
          getDonationReportsDonorsAction({ page: 1, pageSize: 5 }),
          getReceiptReportingSummaryAction(),
          getPledgeCollectionReportAction(),
          getRecurringReportSummaryAction(),
        ])

      if (overviewResult.success) {
        setOverview(overviewResult.overview)
      }

      if (topDonorsResult.success) {
        setTopDonors(
          (topDonorsResult.donors || []).map((donor: any) => ({
            id: donor.id,
            full_name: donor.full_name,
            email: donor.email,
            donation_count: donor.donation_count,
            total_donations: donor.total_donations,
          }))
        )
      }

      if (receiptResult.success) {
        setReceiptSummary(receiptResult.summary)
      }

      if (collectionResult.success) {
        setCollectionReport(collectionResult.report)
      }

      if (recurringResult.success) {
        setRecurringReport(recurringResult.summary)
      }

      setLoading(false)
    }

    loadOverview()
  }, [])

  useEffect(() => {
    if (activeTab === "Donations") {
      setTabLoading(true)
      getDonationReportsPaymentsAction({ page: paymentsPage }).then((result) => {
        if (result.success) {
          setPayments(result.payments as Payment[])
          setPaymentsTotal(result.total)
        }
        setTabLoading(false)
      })
    }
  }, [activeTab, paymentsPage])

  useEffect(() => {
    if (activeTab === "Donors") {
      setTabLoading(true)
      getDonationReportsDonorsAction({ page: donorsPage }).then((result) => {
        if (result.success) {
          setDonors(
            (result.donors || []).map((donor: any) => ({
              id: donor.id,
              full_name: donor.full_name,
              email: donor.email,
              donation_count: donor.donation_count,
              total_donations: donor.total_donations,
            }))
          )
          setDonorsTotal(result.total)
        }
        setTabLoading(false)
      })
    }
  }, [activeTab, donorsPage])

  useEffect(() => {
    if (activeTab === "Campaigns" && campaignEntries.length === 0) {
      setTabLoading(true)
      getDonationReportsCampaignsAction().then((result) => {
        if (result.success) {
          setCampaignEntries(result.entries)
        }
        setTabLoading(false)
      })
    }
  }, [activeTab, campaignEntries.length])

  useEffect(() => {
    if (activeTab === "Tax Receipts") {
      setTabLoading(true)
      getDonationTaxYearTotalsAction(Number(statementYear)).then((result) => {
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
        }
        setTabLoading(false)
      })
    }
  }, [activeTab, statementYear])

  const donorTotals = useMemo(() => {
    return donors.map((donor) => ({
      id: donor.id,
      name: donor.full_name || "Unknown Donor",
      email: donor.email || "",
      donationCount: Number(donor.donation_count || 0),
      total: Number(donor.total_donations || 0),
    }))
  }, [donors])

  const totalDonations = overview.totalDonations
  const averageDonation = overview.averageDonation
  const uniqueDonors = overview.donorCount

  const topDonorRows = useMemo(
    () =>
      topDonors.map((donor) => ({
        id: donor.id,
        name: donor.full_name || "Unknown Donor",
        total: Number(donor.total_donations || 0),
      })),
    [topDonors]
  )

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

    alert(
      `Statements sent: ${result.sentCount}. Failed: ${result.failedCount}.`
    )
  }

  if (loading) {
    return (
      <>
        <Header title="Donations Reports" />
        <div className="p-6">Loading...</div>
      </>
    )
  }

  return (
    <>
      <Header title="Donations Reports" />

      <div className="p-6">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex gap-0 border-b border-border">
            {reportsTabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "relative px-4 py-2.5 text-sm font-medium transition-colors",
                  activeTab === tab
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab}
                {activeTab === tab && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary" />
                )}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
                <SelectItem value="1y">Last year</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          </div>
        </div>

        {activeTab === "Overview" && (
          <div className="flex flex-col gap-6">
            <div className="flex flex-wrap gap-4 [&>*]:w-fit">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Total Donations
                  </CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>

                <CardContent>
                  <div className="text-2xl font-bold">
                    ${totalDonations.toLocaleString()}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Active Donors
                  </CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>

                <CardContent>
                  <div className="text-2xl font-bold">
                    {uniqueDonors}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Avg. Donation
                  </CardTitle>
                  <Heart className="h-4 w-4 text-muted-foreground" />
                </CardHeader>

                <CardContent>
                  <div className="text-2xl font-bold">
                    ${averageDonation.toFixed(0)}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Total Payments
                  </CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>

                <CardContent>
                  <div className="text-2xl font-bold">
                    {overview.paymentCount}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Top Donors</CardTitle>
                <CardDescription>
                  Highest contributors
                </CardDescription>
              </CardHeader>

              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Donor</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {topDonorRows.map((donor) => (
                      <TableRow key={donor.id}>
                        <TableCell className="font-medium">
                          {donor.name}
                        </TableCell>

                        <TableCell className="text-right">
                          ${donor.total.toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "Donations" && (
          <Card>
            <CardHeader>
              <CardTitle>Donation Transactions</CardTitle>
              <CardDescription>
                Real payment ledger
              </CardDescription>
            </CardHeader>

            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Sender</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {tabLoading && (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                        Loading payments...
                      </TableCell>
                    </TableRow>
                  )}
                  {!tabLoading && payments.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                        No payments found.
                      </TableCell>
                    </TableRow>
                  )}
                  {payments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell>
                        {payment.payment_date
                          ? payment.payment_date.slice(0, 10)
                          : "N/A"}
                      </TableCell>

                      <TableCell className="font-medium">
                        {payment.sender_name || "Unknown"}
                      </TableCell>

                      <TableCell>
                        {payment.source || "Manual"}
                      </TableCell>

                      <TableCell>
                        {payment.status || "pending_review"}
                      </TableCell>

                      <TableCell className="text-right">
                        ${Number(payment.amount || 0).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {Math.ceil(paymentsTotal / DONATIONS_PAGE_SIZE) > 1 ? (
                <div className="flex items-center justify-between border-t px-4 py-3">
                  <p className="text-sm text-muted-foreground">
                    {(paymentsPage - 1) * DONATIONS_PAGE_SIZE + 1}–
                    {Math.min(paymentsPage * DONATIONS_PAGE_SIZE, paymentsTotal)} of {paymentsTotal}
                  </p>
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          onClick={() => setPaymentsPage((current) => Math.max(1, current - 1))}
                          className={paymentsPage <= 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                      <PaginationItem>
                        <PaginationNext
                          onClick={() =>
                            setPaymentsPage((current) =>
                              Math.min(Math.ceil(paymentsTotal / DONATIONS_PAGE_SIZE), current + 1)
                            )
                          }
                          className={
                            paymentsPage >= Math.ceil(paymentsTotal / DONATIONS_PAGE_SIZE)
                              ? "pointer-events-none opacity-50"
                              : "cursor-pointer"
                          }
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              ) : null}
            </CardContent>
          </Card>
        )}

        {activeTab === "Donors" && (
          <Card>
            <CardHeader>
              <CardTitle>Donor Analysis</CardTitle>
              <CardDescription>
                Real donor contribution totals
              </CardDescription>
            </CardHeader>

            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Donor</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Donations</TableHead>
                    <TableHead className="text-right">Lifetime Value</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {tabLoading && (
                    <TableRow>
                      <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                        Loading donors...
                      </TableCell>
                    </TableRow>
                  )}
                  {donorTotals.map((donor) => (
                    <TableRow key={donor.id}>
                      <TableCell className="font-medium">
                        {donor.name}
                      </TableCell>

                      <TableCell>
                        {donor.email || "N/A"}
                      </TableCell>

                      <TableCell>
                        {donor.donationCount}
                      </TableCell>

                      <TableCell className="text-right">
                        ${donor.total.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {Math.ceil(donorsTotal / DONATIONS_PAGE_SIZE) > 1 ? (
                <div className="flex items-center justify-between border-t px-4 py-3">
                  <p className="text-sm text-muted-foreground">
                    {(donorsPage - 1) * DONATIONS_PAGE_SIZE + 1}–
                    {Math.min(donorsPage * DONATIONS_PAGE_SIZE, donorsTotal)} of {donorsTotal}
                  </p>
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          onClick={() => setDonorsPage((current) => Math.max(1, current - 1))}
                          className={donorsPage <= 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                      <PaginationItem>
                        <PaginationNext
                          onClick={() =>
                            setDonorsPage((current) =>
                              Math.min(Math.ceil(donorsTotal / DONATIONS_PAGE_SIZE), current + 1)
                            )
                          }
                          className={
                            donorsPage >= Math.ceil(donorsTotal / DONATIONS_PAGE_SIZE)
                              ? "pointer-events-none opacity-50"
                              : "cursor-pointer"
                          }
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              ) : null}
            </CardContent>
          </Card>
        )}

        {activeTab === "Campaigns" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Campaign Performance
              </CardTitle>
              <CardDescription>
                Donations, pledges, outstanding balances, and donor counts by campaign
              </CardDescription>
            </CardHeader>

            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campaign</TableHead>
                    <TableHead className="text-right">Donations</TableHead>
                    <TableHead className="text-right">Pledges</TableHead>
                    <TableHead className="text-right">Outstanding</TableHead>
                    <TableHead className="text-right">Donors</TableHead>
                    <TableHead>Progress</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading || tabLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                        Loading campaign reports...
                      </TableCell>
                    </TableRow>
                  ) : null}
                  {!loading && !tabLoading && campaignEntries.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                        No campaigns to report on yet.
                      </TableCell>
                    </TableRow>
                  )}
                  {campaignEntries.map(({ campaign, metrics }) => (
                    <TableRow key={campaign.id}>
                      <TableCell>
                        <Link
                          href={`/donations/campaigns/${campaign.id}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {campaign.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatDonationCurrency(metrics.raised)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatDonationCurrency(metrics.pledged)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatDonationCurrency(metrics.outstanding)}
                      </TableCell>
                      <TableCell className="text-right">{metrics.donorCount}</TableCell>
                      <TableCell className="min-w-[140px]">
                        <CampaignProgressBar progressPercent={metrics.progressPercent} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {activeTab === "Receipts" && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Receipts Generated
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {receiptSummary?.receiptsGenerated ?? 0}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Receipts Sent
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{receiptSummary?.receiptsSent ?? 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Not Sent
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{receiptSummary?.receiptsNotSent ?? 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Missing Receipts
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-amber-600">
                  {receiptSummary?.missingReceipts ?? 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  of {receiptSummary?.totalPayments ?? 0} payments
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "Collection" && (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Outstanding Pledges
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {collectionReport?.outstandingCount ?? 0}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Outstanding Balance
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    ${(collectionReport?.outstandingTotal ?? 0).toLocaleString()}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    No Payment Yet
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {collectionReport?.noPaymentCount ?? 0}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Partially Paid
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {collectionReport?.partialCount ?? 0}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Reminders Logged
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {collectionReport?.reminderCount ?? 0}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Pledge Collection Queue</CardTitle>
                <CardDescription>
                  Open and partial pledges with reminder and last-contacted dates
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Donor</TableHead>
                      <TableHead>Campaign</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                      <TableHead>Last Reminder</TableHead>
                      <TableHead>Last Contacted</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(collectionReport?.pledges || []).map((pledge) => (
                      <TableRow key={pledge.id}>
                        <TableCell className="font-medium">{pledge.donorName}</TableCell>
                        <TableCell>{pledge.campaignName || "—"}</TableCell>
                        <TableCell className="text-right">
                          ${pledge.balanceRemaining.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          {pledge.lastReminderAt
                            ? new Date(pledge.lastReminderAt).toLocaleDateString()
                            : "—"}
                        </TableCell>
                        <TableCell>
                          {pledge.lastContactedAt
                            ? new Date(pledge.lastContactedAt).toLocaleDateString()
                            : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "Recurring" && (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Recurring Donors
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {recurringReport?.recurringDonorCount ?? 0}
                  </div>
                  <p className="text-xs text-muted-foreground">Donors with recurring payments</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Recurring Revenue (Actual)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    ${(recurringReport?.totalRecurringRevenue ?? 0).toLocaleString()}
                  </div>
                  <p className="text-xs text-muted-foreground">From canonical payments linked to plans</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Recurring Revenue by Campaign</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Campaign</TableHead>
                      <TableHead className="text-right">Donors</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(recurringReport?.byCampaign || []).map((row) => (
                      <TableRow key={row.campaignId || "none"}>
                        <TableCell>{row.campaignName}</TableCell>
                        <TableCell className="text-right">{row.donorCount}</TableCell>
                        <TableCell className="text-right">${row.total.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recurring Revenue by Donor</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Donor</TableHead>
                      <TableHead className="text-right">Plans</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(recurringReport?.byDonor || []).map((row) => (
                      <TableRow key={row.donorId}>
                        <TableCell className="font-medium">{row.donorName}</TableCell>
                        <TableCell className="text-right">{row.planCount}</TableCell>
                        <TableCell className="text-right">${row.total.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "Tax Receipts" && (
          <Card>
            <CardHeader>
              <CardTitle>Tax Receipts</CardTitle>
              <CardDescription>
                Year-end donor giving statements from actual payments only
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
                  {tabLoading && (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                        Loading tax year totals...
                      </TableCell>
                    </TableRow>
                  )}
                  {yearEndDonorTotals.map((donor) => (
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
                          defaultYear={Number(statementYear)}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Tax Receipt Preview</DialogTitle>

            <DialogDescription>
              Year-end donation receipt for {previewDonor?.full_name}
            </DialogDescription>
          </DialogHeader>

          {previewDonor && (
            <div className="rounded-lg border bg-white p-6">
              <div className="mb-6 text-center">
                <h2 className="text-xl font-bold">
                  Organization Name
                </h2>

                <p className="text-sm text-muted-foreground">
                  Donation Receipt
                </p>
              </div>

              <div className="mb-6 rounded-md bg-muted/50 p-4">
                <p className="mb-2 font-medium">
                  Donor Information
                </p>

                <p>{previewDonor.full_name}</p>

                <p className="text-sm text-muted-foreground">
                  {previewDonor.email}
                </p>
              </div>

              <div className="rounded-md border">
                <div className="flex justify-between border-b p-3">
                  <span>Total Donations</span>

                  <span className="font-bold">
                    ${Number(previewDonor.total_donations || 0).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowPreviewDialog(false)}
            >
              Close
            </Button>

            <Button variant="outline">
              <Printer className="mr-2 h-4 w-4" />
              Print
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
