"use client"

import { useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
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
import { Download, Heart, DollarSign, Users, TrendingUp, FileText, Send, Printer } from "lucide-react"
import { cn } from "@/lib/utils"

const reportsTabs = ["Overview", "Donations", "Donors", "Campaigns", "Tax Receipts"] as const

type ReportsTab = (typeof reportsTabs)[number]

interface Payment {
  id: string
  donor_id?: string | null
  sender_name?: string | null
  amount?: number | null
  payment_date?: string | null
  source?: string | null
  category_id?: string | null
  pledge_id?: string | null
  status?: string | null
}

interface DonorSummary {
  id: string
  full_name: string | null
  email: string | null
  donor_type: string | null
  donation_count: number | null
  total_donations: number | null
  last_donation_date: string | null
  has_open_pledge: boolean | null
}

export default function DonationsReportsPage() {
  const supabase = createClient()

  const [activeTab, setActiveTab] = useState<ReportsTab>("Overview")
  const [dateRange, setDateRange] = useState("30d")
  const [taxSearch, setTaxSearch] = useState("")
  const [selectedDonors, setSelectedDonors] = useState<string[]>([])
  const [showPreviewDialog, setShowPreviewDialog] = useState(false)
  const [previewDonor, setPreviewDonor] = useState<DonorSummary | null>(null)

  const [payments, setPayments] = useState<Payment[]>([])
  const [donors, setDonors] = useState<DonorSummary[]>([])
  const [loading, setLoading] = useState(true)

  async function getOrganizationId() {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) return null

    const { data } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .single()

    return data?.organization_id || null
  }

  useEffect(() => {
    async function loadData() {
      setLoading(true)

      const orgId = await getOrganizationId()

      if (!orgId) {
        setLoading(false)
        return
      }

      const { data: paymentData } = await supabase
        .from("payments")
        .select(
          "id, donor_id, sender_name, amount, payment_date, source, category_id, pledge_id, status"
        )
        .eq("organization_id", orgId)
        .order("payment_date", { ascending: false })

      const { data: donorData } = await supabase
        .from("donor_summary_view")
        .select("*")
        .eq("organization_id", orgId)

      setPayments((paymentData || []) as Payment[])
      setDonors((donorData || []) as DonorSummary[])

      setLoading(false)
    }

    loadData()
  }, [])

  const donorTotals = useMemo(() => {
    return donors.map((donor) => ({
      id: donor.id,
      name: donor.full_name || "Unknown Donor",
      email: donor.email || "",
      donationCount: Number(donor.donation_count || 0),
      total: Number(donor.total_donations || 0),
      lastDonation: donor.last_donation_date || "",
      hasPledge: donor.has_open_pledge || false,
    }))
  }, [donors])

  const filteredTaxDonors = donorTotals.filter((donor) => {
    return (
      donor.name.toLowerCase().includes(taxSearch.toLowerCase()) ||
      donor.email.toLowerCase().includes(taxSearch.toLowerCase())
    )
  })

  const totalDonations = payments.reduce((sum, payment) => {
    return sum + Number(payment.amount || 0)
  }, 0)

  const averageDonation =
    payments.length > 0
      ? totalDonations / payments.length
      : 0

  const uniqueDonors = donorTotals.length

  const topDonors = [...donorTotals]
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)

  const handleSelectAll = () => {
    if (selectedDonors.length === filteredTaxDonors.length) {
      setSelectedDonors([])
    } else {
      setSelectedDonors(filteredTaxDonors.map((d) => d.id))
    }
  }

  const handleSelectDonor = (id: string) => {
    if (selectedDonors.includes(id)) {
      setSelectedDonors(selectedDonors.filter((d) => d !== id))
    } else {
      setSelectedDonors([...selectedDonors, id])
    }
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
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
                    {payments.length}
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
                    {topDonors.map((donor) => (
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
            </CardContent>
          </Card>
        )}

        {activeTab === "Campaigns" && (
          <Card>
            <CardHeader>
              <CardTitle>Campaign Performance</CardTitle>
              <CardDescription>
                Connect campaigns later
              </CardDescription>
            </CardHeader>

            <CardContent>
              <div className="rounded-md border border-dashed p-8 text-center text-muted-foreground">
                Campaign reporting can be added after campaign allocation is finalized.
              </div>
            </CardContent>
          </Card>
        )}

        {activeTab === "Tax Receipts" && (
          <Card>
            <CardHeader>
              <CardTitle>Tax Receipts</CardTitle>
              <CardDescription>
                Year-end donor summaries
              </CardDescription>
            </CardHeader>

            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">
                      <Checkbox
                        checked={
                          selectedDonors.length === filteredTaxDonors.length &&
                          filteredTaxDonors.length > 0
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
                  {filteredTaxDonors.map((donor) => (
                    <TableRow key={donor.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedDonors.includes(donor.id)}
                          onCheckedChange={() => handleSelectDonor(donor.id)}
                        />
                      </TableCell>

                      <TableCell className="font-medium">
                        {donor.name}
                      </TableCell>

                      <TableCell>
                        {donor.email || "N/A"}
                      </TableCell>

                      <TableCell>
                        {donor.donationCount}
                      </TableCell>

                      <TableCell>
                        ${donor.total.toLocaleString()}
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setPreviewDonor(donor as any)
                              setShowPreviewDialog(true)
                            }}
                          >
                            <FileText className="h-4 w-4" />
                          </Button>

                          <Button variant="ghost" size="sm">
                            <Printer className="h-4 w-4" />
                          </Button>

                          <Button variant="ghost" size="sm">
                            <Send className="h-4 w-4" />
                          </Button>
                        </div>
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
