"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"

import {
  DonationMetricCard,
  DonationMetricCardGrid,
} from "@/components/donations/donation-metric-card"
import { ListPagination } from "@/components/ui/list-pagination"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
import { formatDonationCurrency } from "@/lib/donations/campaign-analytics"
import {
  fetchPledgeLastPaymentDatesAction,
  fetchPledgesPageAction,
  fetchPledgeSummaryMetricsAction,
} from "@/lib/donations/donation-list-actions"
import { getPledgeCollectionReportAction } from "@/lib/donations/pledge-reminder-actions"
import { DONATIONS_PAGE_SIZE } from "@/lib/donations/donation-pagination"
import { donationPledgesHref } from "@/lib/donations/donation-pledge-paths"
import { getDonorProfilePath } from "@/lib/donations/donor-profile-path"
import { AlertCircle, CheckCircle2, DollarSign, Percent } from "lucide-react"

const ALL = "all"

function formatDate(value: string | null) {
  if (!value) return "—"
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

export function PledgePerformanceReportPanel() {
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState(ALL)
  const [pledges, setPledges] = useState<
    Array<{
      id: string
      donor_id: string | null
      donor_name: string | null
      campaign_name: string | null
      amount_pledged: number | null
      amount_paid: number | null
      balance_remaining: number | null
      calculated_status: string | null
      pledge_date: string | null
      next_payment_date: string | null
      last_payment_date?: string | null
    }>
  >([])
  const [total, setTotal] = useState(0)
  const [metrics, setMetrics] = useState({
    totalPledged: 0,
    totalCollected: 0,
    outstandingBalance: 0,
    activePledgeCount: 0,
    pledgeCount: 0,
  })
  const [overdueCount, setOverdueCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setErrorMessage(null)
    const status = statusFilter === ALL ? undefined : statusFilter
    const [listResult, summaryResult, collectionResult] = await Promise.all([
      fetchPledgesPageAction({
        page,
        pageSize: DONATIONS_PAGE_SIZE,
        status,
      }),
      fetchPledgeSummaryMetricsAction({ status }),
      getPledgeCollectionReportAction(),
    ])

    if (!listResult.success) {
      setErrorMessage(listResult.error)
      setPledges([])
      setLoading(false)
      return
    }

    const lastPaymentResult = await fetchPledgeLastPaymentDatesAction(
      listResult.pledges.map((pledge) => pledge.id)
    )
    const lastPaymentByPledgeId = lastPaymentResult.success
      ? lastPaymentResult.lastPaymentByPledgeId
      : {}

    setPledges(
      listResult.pledges.map((pledge) => ({
        ...pledge,
        last_payment_date: lastPaymentByPledgeId[pledge.id] ?? null,
      }))
    )
    setTotal(listResult.total)
    if (summaryResult.success) {
      setMetrics(summaryResult.metrics)
    }
    if (collectionResult.success) {
      setOverdueCount(collectionResult.report.overdueCount)
    }
    setLoading(false)
  }, [page, statusFilter])

  useEffect(() => {
    void load()
  }, [load])

  const collectionRate = useMemo(() => {
    if (metrics.totalPledged <= 0) return null
    return Math.round((metrics.totalCollected / metrics.totalPledged) * 100)
  }, [metrics.totalCollected, metrics.totalPledged])

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h2 className="text-xl font-semibold">Pledge Performance</h2>
        <p className="text-sm text-muted-foreground">
          Reporting only. Outstanding = pledged minus allocated payments. Manage pledges and
          collections under Fund Development → Pledges.
        </p>
      </div>

      <DonationMetricCardGrid colorful className="lg:grid-cols-4">
        <DonationMetricCard
          title="Total Pledged"
          value={formatDonationCurrency(metrics.totalPledged)}
          icon={DollarSign}
          accent="blue"
        />
        <DonationMetricCard
          title="Collected Against Pledges"
          value={formatDonationCurrency(metrics.totalCollected)}
          icon={CheckCircle2}
          accent="emerald"
        />
        <DonationMetricCard
          title="Outstanding"
          value={formatDonationCurrency(metrics.outstandingBalance)}
          icon={AlertCircle}
          accent="amber"
          description={`${overdueCount} overdue`}
        />
        <DonationMetricCard
          title="Collection Rate"
          value={collectionRate == null ? "—" : `${collectionRate}%`}
          icon={Percent}
          accent="purple"
          description={`${metrics.activePledgeCount} open pledges`}
        />
      </DonationMetricCardGrid>

      <Card>
        <CardHeader>
          <CardTitle>Pledges</CardTitle>
          <CardDescription>
            Read-only ledger. Open a donor or use Pledges to collect, remind, or edit.
          </CardDescription>
          <div className="pt-2">
            <Select
              value={statusFilter}
              onValueChange={(value) => {
                setPage(1)
                setStatusFilter(value)
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All statuses</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="partial">Partial</SelectItem>
                <SelectItem value="fulfilled">Fulfilled</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Donor</TableHead>
                <TableHead>Campaign</TableHead>
                <TableHead>Pledge Amount</TableHead>
                <TableHead>Amount Paid</TableHead>
                <TableHead>Balance</TableHead>
                <TableHead>Pledge Date</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Last Payment</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                    <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                    Loading pledges...
                  </TableCell>
                </TableRow>
              ) : errorMessage ? (
                <TableRow>
                    <TableCell colSpan={9} className="py-8 text-center text-destructive">
                    {errorMessage}
                  </TableCell>
                </TableRow>
              ) : pledges.length === 0 ? (
                <TableRow>
                    <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                    No pledges match the current filters.
                  </TableCell>
                </TableRow>
              ) : (
                pledges.map((pledge) => {
                  const donorHref = pledge.donor_id
                    ? getDonorProfilePath(pledge.donor_id)
                    : donationPledgesHref({ pledgeId: pledge.id, action: "view" })
                  return (
                    <TableRow key={pledge.id}>
                      <TableCell className="font-medium">
                        {pledge.donor_id ? (
                          <Link href={donorHref} className="text-primary hover:underline">
                            {pledge.donor_name || "Unknown"}
                          </Link>
                        ) : (
                          pledge.donor_name || "Unknown"
                        )}
                      </TableCell>
                      <TableCell>{pledge.campaign_name || "—"}</TableCell>
                      <TableCell>
                        {formatDonationCurrency(Number(pledge.amount_pledged || 0))}
                      </TableCell>
                      <TableCell>
                        {formatDonationCurrency(Number(pledge.amount_paid || 0))}
                      </TableCell>
                      <TableCell>
                        {formatDonationCurrency(Number(pledge.balance_remaining || 0))}
                      </TableCell>
                      <TableCell>{formatDate(pledge.pledge_date)}</TableCell>
                      <TableCell>{formatDate(pledge.next_payment_date)}</TableCell>
                      <TableCell>{formatDate(pledge.last_payment_date ?? null)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {pledge.calculated_status || "—"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {Math.ceil(total / DONATIONS_PAGE_SIZE) > 1 ? (
        <ListPagination
          page={page}
          pageSize={DONATIONS_PAGE_SIZE}
          total={total}
          onPageChange={setPage}
          hidePageSize
        />
      ) : null}
    </div>
  )
}
