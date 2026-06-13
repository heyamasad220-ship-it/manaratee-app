"use client"

import { useEffect, useMemo, useState } from "react"
import { Header } from "@/components/layout/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Search, DollarSign, Clock, AlertTriangle, Users } from "lucide-react"
import { PledgeReminderActions } from "@/components/donations/pledge-reminder-actions"
import {
  getOutstandingPledgesAction,
} from "@/lib/donations/pledge-reminder-actions"
import type { OutstandingPledgeRow } from "@/lib/donations/pledge-reminder-types"
import { formatPledgeReminderStatusLabel } from "@/lib/donations/pledge-reminder-types"
import { formatPledgeStatusLabel } from "@/lib/donations/donation-status"

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

export default function PledgeCollectionPage() {
  const [pledges, setPledges] = useState<OutstandingPledgeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

  async function loadPledges() {
    setLoading(true)
    const result = await getOutstandingPledgesAction()
    if (result.success) setPledges(result.pledges)
    setLoading(false)
  }

  useEffect(() => {
    loadPledges()
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return pledges
    return pledges.filter(
      (p) =>
        p.donorName.toLowerCase().includes(q) ||
        (p.campaignName || "").toLowerCase().includes(q)
    )
  }, [pledges, search])

  const totals = useMemo(() => {
    const outstandingTotal = pledges.reduce((sum, p) => sum + p.balanceRemaining, 0)
    const noPayment = pledges.filter((p) => p.amountPaid <= 0.009).length
    const partial = pledges.filter((p) => p.amountPaid > 0.009).length
    const today = new Date()
    const overdue = pledges.filter((p) => {
      if (!p.pledgeDate) return false
      return new Date(p.pledgeDate) < today
    }).length
    return { outstandingTotal, noPayment, partial, overdue, count: pledges.length }
  }, [pledges])

  return (
    <>
      <Header title="Pledge Collection" />
      <div className="space-y-6 p-6">
        <div>
          <h2 className="text-lg font-semibold">Outstanding Pledges</h2>
          <p className="text-sm text-muted-foreground">
            Track open and partial pledges from canonical payment balances. Fulfilled pledges are
            excluded.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Outstanding</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totals.count}</div>
              <p className="text-xs text-muted-foreground">Open + partial pledges</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Balance Due</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totals.outstandingTotal)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">No Payment Yet</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totals.noPayment}</div>
              <p className="text-xs text-muted-foreground">{totals.partial} partially paid</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Past Pledge Date</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totals.overdue}</div>
              <p className="text-xs text-muted-foreground">Based on pledge date</p>
            </CardContent>
          </Card>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search donor or campaign..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Donor</TableHead>
                  <TableHead>Campaign</TableHead>
                  <TableHead className="text-right">Pledged</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead>Last Payment</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reminder</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                      Loading outstanding pledges...
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                      No outstanding pledges found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((pledge) => (
                    <TableRow key={pledge.id}>
                      <TableCell className="font-medium">{pledge.donorName}</TableCell>
                      <TableCell>{pledge.campaignName || "—"}</TableCell>
                      <TableCell className="text-right">{formatCurrency(pledge.amountPledged)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(pledge.amountPaid)}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(pledge.balanceRemaining)}
                      </TableCell>
                      <TableCell>{formatDate(pledge.lastPaymentDate)}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {formatPledgeStatusLabel(pledge.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {pledge.lastReminderAt ? (
                          <div>
                            <div>{formatPledgeReminderStatusLabel(pledge.lastReminderStatus)}</div>
                            <div className="text-xs">{formatDate(pledge.lastReminderAt)}</div>
                          </div>
                        ) : (
                          "None"
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <PledgeReminderActions
                          pledgeId={pledge.id}
                          donorName={pledge.donorName}
                          onUpdated={loadPledges}
                          compact
                        />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
