"use client"

import { createClient } from "@/lib/supabase/client"
import { getCurrentOrganizationId } from "@/lib/current-organization"
import { useEffect, useState } from "react"
import { Header } from "@/components/layout/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  DollarSign,
  Link2,
  Search,
  User,
  XCircle,
  Zap,
} from "lucide-react"
import { cn } from "@/lib/utils"

type QueueStatus = "pending_review" | "unallocated" | "unresolved"

interface QueuePayment {
  id: string
  source: string
  senderName: string
  amount: number
  date: string | null
  memo: string
  status: QueueStatus
  donorId: string | null
  contactId: string | null
}

interface DonorMatch {
  id: string
  contactId: string | null
  name: string
  email: string
  phone: string
  totalDonations: number
  lastDonation: string
  confidenceScore: number
  matchReason: string
}

interface Pledge {
  id: string
  donorId: string | null
  donorName: string
  campaign: string
  totalAmount: number
  paidAmount: number
  remainingAmount: number
  dueDate: string | null
}

const supabase = createClient()

const sourceColors: Record<string, string> = {
  zelle: "bg-purple-100 text-purple-700",
  venmo: "bg-blue-100 text-blue-700",
  paypal: "bg-amber-100 text-amber-700",
  cash: "bg-slate-100 text-slate-700",
  check: "bg-slate-100 text-slate-700",
  stripe: "bg-indigo-100 text-indigo-700",
  import: "bg-gray-100 text-gray-700",
  manual: "bg-gray-100 text-gray-700",
}

const statusConfig: Record<
  QueueStatus,
  { label: string; color: string; icon: typeof CheckCircle2 }
> = {
  pending_review: { label: "Pending Review", color: "bg-amber-100 text-amber-700", icon: Clock },
  unallocated: { label: "Matched", color: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
  unresolved: { label: "Unresolved", color: "bg-red-100 text-red-700", icon: XCircle },
}

function getConfidenceColor(score: number): string {
  if (score >= 85) return "bg-emerald-100 text-emerald-700 border-emerald-200"
  if (score >= 60) return "bg-amber-100 text-amber-700 border-amber-200"
  return "bg-red-100 text-red-700 border-red-200"
}

function normalizeName(value: string) {
  return (value || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function getNameParts(value: string) {
  return normalizeName(value)
    .split(" ")
    .filter(Boolean)
}

function calculateMatchScore(paymentName: string, donorName: string) {
  const paymentNormalized = normalizeName(paymentName)
  const donorNormalized = normalizeName(donorName)

  if (!paymentNormalized || !donorNormalized) {
    return { score: 0, reason: "No usable name" }
  }

  if (paymentNormalized === donorNormalized) {
    return { score: 95, reason: "Exact name match" }
  }

  const paymentParts = getNameParts(paymentName)
  const donorParts = getNameParts(donorName)

  const sharedParts = paymentParts.filter((part) => donorParts.includes(part))
  const sharedCount = sharedParts.length

  if (sharedCount === 0) return { score: 0, reason: "No name match" }

  if (sharedCount === paymentParts.length || sharedCount === donorParts.length) {
    return { score: 85, reason: "Strong partial name match" }
  }

  if (sharedCount >= 2) {
    return { score: 72, reason: "Multi-word partial name match" }
  }

  return { score: 58, reason: `Single-word match (${sharedParts[0]})` }
}

function formatDate(value: string | null) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleDateString()
}

export default function ReconcilePage() {
  const [allPledges, setAllPledges] = useState<Pledge[]>([])
  const [donorMatches, setDonorMatches] = useState<DonorMatch[]>([])
  const [payments, setPayments] = useState<QueuePayment[]>([])
  const [selectedPayment, setSelectedPayment] = useState<QueuePayment | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("pending_review")
  const [showPledgeDialog, setShowPledgeDialog] = useState(false)
  const [selectedDonor, setSelectedDonor] = useState<DonorMatch | null>(null)
  const [donorPledges, setDonorPledges] = useState<Pledge[]>([])
  const [selectedPledgeId, setSelectedPledgeId] = useState("")
  const [allocating, setAllocating] = useState(false)

  const filteredPayments = payments.filter((payment) => {
    const matchesSearch =
      payment.senderName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      payment.memo.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesStatus = statusFilter === "all" || payment.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const pendingCount = payments.filter((p) => p.status === "pending_review").length
  const matchedCount = payments.filter((p) => p.status === "unallocated").length
  const unresolvedCount = payments.filter((p) => p.status === "unresolved").length

  const currentIndex = selectedPayment
    ? filteredPayments.findIndex((p) => p.id === selectedPayment.id)
    : -1

  const pledgeOptionsToShow = donorPledges.length > 0 ? donorPledges : allPledges

  const showingFallbackPledges =
    selectedDonor !== null && donorPledges.length === 0 && allPledges.length > 0

  const goToPrevious = () => {
    if (currentIndex > 0) setSelectedPayment(filteredPayments[currentIndex - 1])
  }

  const goToNext = () => {
    if (currentIndex < filteredPayments.length - 1) {
      setSelectedPayment(filteredPayments[currentIndex + 1])
    }
  }

  const moveToNextPayment = (currentPaymentId: string) => {
    const next = payments.find((p) => p.id !== currentPaymentId && p.status === "pending_review")
    setSelectedPayment(next || null)
  }

  async function loadPayments() {
    const orgId = await getCurrentOrganizationId()
    if (!orgId) return

    const { data, error } = await supabase
      .from("payments")
      .select(`
        id,
        amount,
        payment_date,
        source,
        memo,
        status,
        donor_id,
        contact_id,
        sender_name,
        donors ( full_name )
      `)
      .eq("organization_id", orgId)
      .in("status", ["pending_review", "unallocated", "unresolved"])
      .is("pledge_id", null)
      .order("payment_date", { ascending: false })

    if (error) {
      console.error(error)
      setPayments([])
      return
    }

    const formatted: QueuePayment[] = (data || []).map((p: any) => ({
      id: p.id,
      source: (p.source || "manual").toLowerCase(),
      senderName: p.sender_name || p.donors?.full_name || "Unknown",
      amount: Number(p.amount || 0),
      date: p.payment_date || null,
      memo: p.memo || "",
      status: (p.status || "pending_review") as QueueStatus,
      donorId: p.donor_id || null,
      contactId: p.contact_id || null,
    }))

    setPayments(formatted)

    setSelectedPayment((current) => {
      if (formatted.length === 0) return null
      if (!current) return formatted[0]
      return formatted.find((p) => p.id === current.id) || formatted[0]
    })
  }

  async function loadAllPledges() {
    const orgId = await getCurrentOrganizationId()

    if (!orgId) {
      setAllPledges([])
      return
    }

    const { data, error } = await supabase
      .from("pledge_status_view")
      .select(`
        id,
        donor_id,
        donor_name,
        campaign_name,
        amount_pledged,
        amount_paid,
        balance_remaining,
        pledge_date
      `)
      .eq("organization_id", orgId)
      .gt("balance_remaining", 0)
      .order("donor_name", { ascending: true })

    if (error) {
      console.error(error)
      setAllPledges([])
      return
    }

    setAllPledges(
      (data || []).map((p: any) => ({
        id: p.id,
        donorId: p.donor_id || null,
        donorName: p.donor_name || "Unknown",
        campaign: p.campaign_name || "No Campaign",
        totalAmount: Number(p.amount_pledged || 0),
        paidAmount: Number(p.amount_paid || 0),
        remainingAmount: Number(p.balance_remaining || 0),
        dueDate: p.pledge_date || null,
      }))
    )
  }

  async function fetchDonorPledges(donorId: string): Promise<Pledge[]> {
    const orgId = await getCurrentOrganizationId()
    if (!orgId) return []

    const { data, error } = await supabase
      .from("pledge_status_view")
      .select(`
        id,
        donor_id,
        donor_name,
        campaign_name,
        amount_pledged,
        amount_paid,
        balance_remaining,
        pledge_date
      `)
      .eq("organization_id", orgId)
      .eq("donor_id", donorId)
      .gt("balance_remaining", 0)
      .order("balance_remaining", { ascending: false })

    if (error) {
      console.error(error)
      return []
    }

    return (data || []).map((p: any) => ({
      id: p.id,
      donorId: p.donor_id || null,
      donorName: p.donor_name || "Unknown",
      campaign: p.campaign_name || "No Campaign",
      totalAmount: Number(p.amount_pledged || 0),
      paidAmount: Number(p.amount_paid || 0),
      remainingAmount: Number(p.balance_remaining || 0),
      dueDate: p.pledge_date || null,
    }))
  }

  async function loadDonorMatches(payment: QueuePayment) {
    if (!payment.senderName || payment.senderName === "Unknown") {
      setDonorMatches([])
      return
    }

    const orgId = await getCurrentOrganizationId()
    if (!orgId) {
      setDonorMatches([])
      return
    }

    const paymentParts = getNameParts(payment.senderName)
    if (paymentParts.length === 0) {
      setDonorMatches([])
      return
    }

    const searchTerms = paymentParts.slice(0, 2)
    const orFilter = searchTerms
      .map((part) => `full_name.ilike.%${part}%,email.ilike.%${part}%`)
      .join(",")

    const { data, error } = await supabase
      .from("donor_summary_view")
      .select(`
        id,
        contact_id,
        full_name,
        email,
        phone,
        total_donations,
        last_donation_date
      `)
      .eq("organization_id", orgId)
      .or(orFilter)
      .limit(30)

    if (error) {
      console.error(error)
      setDonorMatches([])
      return
    }

    const formatted: DonorMatch[] = (data || [])
      .map((d: any) => {
        const match = calculateMatchScore(payment.senderName, d.full_name || "")

        return {
          id: d.id,
          contactId: d.contact_id || null,
          name: d.full_name || "Unnamed donor",
          email: d.email || "",
          phone: d.phone || "",
          totalDonations: Number(d.total_donations || 0),
          lastDonation: d.last_donation_date || "",
          confidenceScore: match.score,
          matchReason: match.reason,
        }
      })
      .filter((d) => d.confidenceScore > 0)
      .sort((a, b) => b.confidenceScore - a.confidenceScore)
      .slice(0, 5)

    setDonorMatches(formatted)
  }

  async function handleMatchToDonor(donor: DonorMatch) {
    if (!selectedPayment) return

    const paymentId = selectedPayment.id

    const { error } = await supabase
      .from("payments")
      .update({
        donor_id: donor.id,
        contact_id: donor.contactId,
        status: "unallocated",
        reconciled_at: new Date().toISOString(),
      })
      .eq("id", paymentId)

    if (error) {
      console.error(error)
      alert(error.message || "Could not match payment to donor")
      return
    }

    await loadPayments()
    moveToNextPayment(paymentId)
  }

  async function handleQuickApply(donor: DonorMatch) {
    if (!selectedPayment) return

    setAllocating(true)

    const pledges = await fetchDonorPledges(donor.id)
    const bestPledge = pledges
      .filter((p) => p.remainingAmount > 0)
      .sort((a, b) => b.remainingAmount - a.remainingAmount)[0]

    if (!bestPledge) {
      setAllocating(false)
      setSelectedDonor(donor)
      setSelectedPledgeId("")
      setDonorPledges([])
      setShowPledgeDialog(true)
      return
    }

    const { error } = await supabase
      .from("payments")
      .update({
        donor_id: donor.id,
        contact_id: donor.contactId,
        pledge_id: bestPledge.id,
        status: "allocated",
        reconciled_at: new Date().toISOString(),
      })
      .eq("id", selectedPayment.id)

    setAllocating(false)

    if (error) {
      console.error(error)
      alert(error.message || "Could not apply payment")
      return
    }

    await loadPayments()
    await loadAllPledges()
    setDonorMatches([])
  }

  async function handleApplyToPledge(donor: DonorMatch) {
    setSelectedDonor(donor)
    setSelectedPledgeId("")
    const pledges = await fetchDonorPledges(donor.id)
    setDonorPledges(pledges)
    setShowPledgeDialog(true)
  }

  async function handleApplyPledgePayment() {
    if (!selectedPayment || !selectedPledgeId) {
      alert("Please select a pledge")
      return
    }

    const pledge = pledgeOptionsToShow.find((item) => item.id === selectedPledgeId)

    setAllocating(true)

    const { error } = await supabase
      .from("payments")
      .update({
        donor_id: selectedDonor?.id || pledge?.donorId || selectedPayment.donorId || null,
        contact_id: selectedDonor?.contactId || selectedPayment.contactId || null,
        pledge_id: selectedPledgeId,
        status: "allocated",
        reconciled_at: new Date().toISOString(),
      })
      .eq("id", selectedPayment.id)

    setAllocating(false)

    if (error) {
      alert(error.message)
      return
    }

    setShowPledgeDialog(false)
    setSelectedDonor(null)
    setSelectedPledgeId("")
    setDonorPledges([])

    await loadPayments()
    await loadAllPledges()
  }

  async function handleMarkUnresolved() {
    if (!selectedPayment) return

    const paymentId = selectedPayment.id

    const { error } = await supabase
      .from("payments")
      .update({
        status: "unresolved",
      })
      .eq("id", paymentId)

    if (error) {
      alert(error.message)
      return
    }

    await loadPayments()
    moveToNextPayment(paymentId)
  }

  useEffect(() => {
    loadPayments()
    loadAllPledges()
  }, [])

  useEffect(() => {
    if (selectedPayment) {
      loadDonorMatches(selectedPayment)
    } else {
      setDonorMatches([])
    }
  }, [selectedPayment])

  return (
    <>
      <Header title="Reconcile Payments" />

      <div className="flex flex-col gap-6 p-6">
        <div className="grid gap-4 sm:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
                  <Clock className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{pendingCount}</p>
                  <p className="text-xs text-muted-foreground">Pending Review</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{matchedCount}</p>
                  <p className="text-xs text-muted-foreground">Matched, Not Allocated</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100">
                  <XCircle className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{unresolvedCount}</p>
                  <p className="text-xs text-muted-foreground">Unresolved</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <DollarSign className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    ${payments.reduce((sum, p) => sum + p.amount, 0).toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">Queue Amount</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="flex flex-col">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Payment Queue</CardTitle>
                  <CardDescription>Select a payment to reconcile</CardDescription>
                </div>

                <select
                  className="h-9 rounded-md border bg-background px-3 text-sm"
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                >
                  <option value="all">All Status</option>
                  <option value="pending_review">Pending Review</option>
                  <option value="unallocated">Matched</option>
                  <option value="unresolved">Unresolved</option>
                </select>
              </div>

              <div className="relative mt-2">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by name or memo..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </CardHeader>

            <CardContent className="flex-1 overflow-auto p-0">
              <div className="flex flex-col">
                {filteredPayments.map((payment) => {
                  const StatusIcon = statusConfig[payment.status].icon

                  return (
                    <button
                      key={payment.id}
                      onClick={() => setSelectedPayment(payment)}
                      className={cn(
                        "flex items-start gap-3 border-b p-4 text-left transition-colors hover:bg-muted/50",
                        selectedPayment?.id === payment.id && "bg-muted"
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-medium">{payment.senderName}</span>

                          <Badge
                            variant="secondary"
                            className={cn(
                              "shrink-0",
                              sourceColors[payment.source] || "bg-slate-100 text-slate-700"
                            )}
                          >
                            {payment.source}
                          </Badge>
                        </div>

                        <p className="truncate text-sm text-muted-foreground">
                          {payment.memo || "No memo"}
                        </p>

                        <p className="text-sm text-muted-foreground">{formatDate(payment.date)}</p>
                      </div>

                      <div className="shrink-0 flex flex-col items-end gap-1">
                        <span className="font-semibold text-emerald-600">
                          ${payment.amount.toLocaleString()}
                        </span>

                        <Badge
                          variant="secondary"
                          className={cn("text-xs", statusConfig[payment.status].color)}
                        >
                          <StatusIcon className="mr-1 h-3 w-3" />
                          {statusConfig[payment.status].label}
                        </Badge>
                      </div>
                    </button>
                  )
                })}

                {filteredPayments.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <CheckCircle2 className="h-12 w-12 text-muted-foreground/30" />
                    <p className="mt-2 text-sm text-muted-foreground">No payments to display</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="flex flex-col">
            {selectedPayment ? (
              <>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">Match Payment</CardTitle>
                      <CardDescription>
                        {currentIndex + 1} of {filteredPayments.length} payments
                      </CardDescription>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={goToPrevious}
                        disabled={currentIndex <= 0}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>

                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={goToNext}
                        disabled={currentIndex >= filteredPayments.length - 1}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="flex-1 overflow-auto">
                  <div className="mb-4 rounded-lg border bg-muted/30 p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{selectedPayment.senderName}</h3>

                          <Badge
                            variant="secondary"
                            className={
                              sourceColors[selectedPayment.source] || "bg-slate-100 text-slate-700"
                            }
                          >
                            {selectedPayment.source}
                          </Badge>
                        </div>

                        <p className="mt-1 text-2xl font-bold text-emerald-600">
                          ${selectedPayment.amount.toLocaleString()}
                        </p>
                      </div>

                      <div className="text-right text-sm">{formatDate(selectedPayment.date)}</div>
                    </div>

                    {selectedPayment.memo && (
                      <div className="mt-3 rounded bg-background p-2">
                        <p className="text-xs text-muted-foreground">Memo</p>
                        <p className="text-sm">{selectedPayment.memo}</p>
                      </div>
                    )}
                  </div>

                  <div className="mb-4">
                    <h4 className="mb-3 flex items-center gap-2 text-sm font-medium">
                      <Zap className="h-4 w-4 text-amber-500" />
                      Suggested Matches
                    </h4>

                    {donorMatches.length > 0 ? (
                      <div className="flex flex-col gap-3">
                        {donorMatches.map((donor, index) => (
                          <div
                            key={donor.id}
                            className="rounded-lg border p-3 transition-colors hover:border-primary/50"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{donor.name}</span>

                                  {index === 0 && donor.confidenceScore >= 85 && (
                                    <span className="text-xs text-muted-foreground">Top match</span>
                                  )}

                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      "text-xs font-semibold",
                                      getConfidenceColor(donor.confidenceScore)
                                    )}
                                  >
                                    {donor.confidenceScore}% match
                                  </Badge>
                                </div>

                                <p className="mt-0.5 text-xs text-muted-foreground">
                                  {donor.email || "No email"} | {donor.phone || "No phone"}
                                </p>

                                <p className="mt-1 text-xs text-muted-foreground">
                                  {donor.matchReason}
                                </p>

                                <div className="mt-2 flex items-center gap-4 text-xs">
                                  <span>
                                    Total: <strong>${donor.totalDonations.toLocaleString()}</strong>
                                  </span>
                                  <span>
                                    Last: <strong>{formatDate(donor.lastDonation)}</strong>
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="mt-3 flex gap-2">
                              <Button
                                size="sm"
                                className="flex-1"
                                onClick={() => handleQuickApply(donor)}
                                disabled={allocating}
                              >
                                <Zap className="mr-1.5 h-3.5 w-3.5" />
                                {allocating ? "Applying..." : "Quick Apply"}
                              </Button>

                              <Button
                                size="sm"
                                variant="outline"
                                className="flex-1"
                                onClick={() => handleMatchToDonor(donor)}
                              >
                                <Link2 className="mr-1.5 h-3.5 w-3.5" />
                                Match Only
                              </Button>

                              <Button
                                size="sm"
                                variant="outline"
                                className="flex-1"
                                onClick={() => handleApplyToPledge(donor)}
                              >
                                <DollarSign className="mr-1.5 h-3.5 w-3.5" />
                                Choose Pledge
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed p-4 text-center">
                        <AlertCircle className="mx-auto h-8 w-8 text-muted-foreground/50" />

                        <p className="mt-2 text-sm text-muted-foreground">
                          {selectedPayment.senderName === "Unknown"
                            ? "This payment has no sender name to match against"
                            : "No matching donors found"}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="border-t pt-4">
                    <h4 className="mb-3 text-sm font-medium">Quick Actions</h4>

                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        className="text-red-600 hover:text-red-700"
                        onClick={handleMarkUnresolved}
                      >
                        <XCircle className="mr-1.5 h-4 w-4" />
                        Mark Unresolved
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </>
            ) : (
              <CardContent className="flex flex-1 flex-col items-center justify-center py-12">
                <User className="h-12 w-12 text-muted-foreground/30" />

                <p className="mt-2 text-sm text-muted-foreground">
                  Select a payment from the queue to begin matching
                </p>
              </CardContent>
            )}
          </Card>
        </div>
      </div>

      <Dialog open={showPledgeDialog} onOpenChange={setShowPledgeDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Apply to Pledge</DialogTitle>

            <DialogDescription>
              Select a pledge to apply this payment to
            </DialogDescription>
          </DialogHeader>

          {selectedPayment && selectedDonor && (
            <div className="flex flex-col gap-4 py-4">
              <div className="rounded-lg bg-muted/50 p-3">
                <div className="flex justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Payment</p>
                    <p className="font-medium">{selectedPayment.senderName}</p>
                  </div>

                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Amount</p>
                    <p className="font-semibold text-emerald-600">
                      ${selectedPayment.amount.toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              {pledgeOptionsToShow.length > 0 ? (
                <div className="flex flex-col gap-3">
                  <Label>Select Pledge</Label>

                  {showingFallbackPledges && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                      No pledges were found for this donor. Showing all open organization pledges instead.
                    </div>
                  )}

                  {pledgeOptionsToShow.map((pledge) => (
                    <button
                      key={pledge.id}
                      type="button"
                      onClick={() => setSelectedPledgeId(pledge.id)}
                      className={cn(
                        "rounded-lg border p-3 text-left transition-colors hover:border-primary/50",
                        selectedPledgeId === pledge.id && "border-primary bg-primary/5"
                      )}
                    >
                      <div className="flex justify-between gap-4">
                        <div>
                          <p className="font-medium">{pledge.donorName}</p>
                          <p className="text-xs text-muted-foreground">{pledge.campaign}</p>
                          <p className="text-xs text-muted-foreground">
                            Due: {pledge.dueDate ? new Date(pledge.dueDate).toLocaleDateString() : "—"}
                          </p>
                        </div>

                        <div className="text-right">
                          <p className="text-sm">
                            <span className="text-muted-foreground">Remaining:</span>{" "}
                            <span className="font-semibold">
                              ${pledge.remainingAmount.toLocaleString()}
                            </span>
                          </p>

                          <p className="text-xs text-muted-foreground">
                            ${pledge.paidAmount.toLocaleString()} / ${pledge.totalAmount.toLocaleString()} paid
                          </p>
                        </div>
                      </div>

                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full bg-primary"
                          style={{
                            width:
                              pledge.totalAmount > 0
                                ? `${(pledge.paidAmount / pledge.totalAmount) * 100}%`
                                : "0%",
                          }}
                        />
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed p-4 text-center">
                  <p className="text-sm text-muted-foreground">
                    No open pledges found in this organization
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPledgeDialog(false)}>
              Cancel
            </Button>

            <Button
              onClick={handleApplyPledgePayment}
              disabled={pledgeOptionsToShow.length === 0 || !selectedPledgeId || allocating}
            >
              {allocating ? "Applying..." : "Apply Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
