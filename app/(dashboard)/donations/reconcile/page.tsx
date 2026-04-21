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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  DollarSign,
  Link2,
  Plus,
  Search,
  User,
  UserPlus,
  XCircle,
  Zap,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface UnmatchedPayment {
  id: string
  importDate: string | null
  source: string
  senderName: string
  amount: number
  date: string | null
  memo: string
  status: "pending" | "matched" | "unresolved" | "new_donor"
}

interface DonorMatch {
  id: string
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
  stripe: "bg-indigo-100 text-indigo-700",
  import: "bg-gray-100 text-gray-700",
}

const statusConfig: Record<
  UnmatchedPayment["status"],
  { label: string; color: string; icon: typeof CheckCircle2 }
> = {
  pending: { label: "Pending", color: "bg-amber-100 text-amber-700", icon: Clock },
  matched: { label: "Matched", color: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
  unresolved: { label: "Unresolved", color: "bg-red-100 text-red-700", icon: XCircle },
  new_donor: { label: "New Donor", color: "bg-blue-100 text-blue-700", icon: UserPlus },
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

  if (sharedCount === 0) {
    return { score: 0, reason: "No name match" }
  }

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
  const [payments, setPayments] = useState<UnmatchedPayment[]>([])
  const [selectedPayment, setSelectedPayment] = useState<UnmatchedPayment | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("pending")
  const [showNewDonorDialog, setShowNewDonorDialog] = useState(false)
  const [showPledgeDialog, setShowPledgeDialog] = useState(false)
  const [selectedDonor, setSelectedDonor] = useState<DonorMatch | null>(null)
  const [donorPledges, setDonorPledges] = useState<Pledge[]>([])
  const [selectedPledgeId, setSelectedPledgeId] = useState("")
  const [allocating, setAllocating] = useState(false)

  const [newDonorFullName, setNewDonorFullName] = useState("")
  const [newDonorEmail, setNewDonorEmail] = useState("")
  const [newDonorPhone, setNewDonorPhone] = useState("")
  const [newDonorNotes, setNewDonorNotes] = useState("")
  const [creatingDonor, setCreatingDonor] = useState(false)

  const filteredPayments = payments.filter((payment) => {
    const matchesSearch =
      payment.senderName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (payment.memo || "").toLowerCase().includes(searchQuery.toLowerCase())

    const matchesStatus = statusFilter === "all" || payment.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const pendingCount = payments.filter((p) => p.status === "pending").length
  const matchedCount = payments.filter((p) => p.status === "matched").length
  const unresolvedCount = payments.filter((p) => p.status === "unresolved").length

  const currentIndex = selectedPayment
    ? filteredPayments.findIndex((p) => p.id === selectedPayment.id)
    : -1

  const pledgeOptionsToShow = donorPledges.length > 0 ? donorPledges : allPledges

  const showingFallbackPledges =
    selectedDonor !== null && donorPledges.length === 0 && allPledges.length > 0

  const moveToNextPendingPayment = (currentPaymentId: string) => {
    const nextPending = payments.find((p) => p.status === "pending" && p.id !== currentPaymentId)
    setSelectedPayment(nextPending || null)
  }

  const goToPrevious = () => {
    if (currentIndex > 0) {
      setSelectedPayment(filteredPayments[currentIndex - 1])
    }
  }

  const goToNext = () => {
    if (currentIndex < filteredPayments.length - 1) {
      setSelectedPayment(filteredPayments[currentIndex + 1])
    }
  }

 const handleMatchToDonor = async (donor: DonorMatch) => {
  if (!selectedPayment) return

  const paymentId = selectedPayment.id

  const { error } = await supabase
    .from("payments")
    .update({
      donor_id: donor.id,
      status: "unallocated",
    })
    .eq("id", paymentId)

  if (error) {
    console.error(error)
    alert(error.message || "Could not match payment to donor")
    return
  }

  setSelectedDonor(donor)

  await loadPayments()

  const nextPending = payments.find((p) => p.id !== paymentId)
  setSelectedPayment(nextPending || null)

  alert("Payment matched to donor")
}

  const handleCreateNewDonor = () => {
    if (!selectedPayment) return

    setNewDonorFullName(selectedPayment.senderName || "")
    setNewDonorEmail("")
    setNewDonorPhone("")
    setNewDonorNotes(selectedPayment.memo || "")
    setShowNewDonorDialog(true)
  }

  const handleMarkUnresolved = () => {
    if (!selectedPayment) return

    setPayments((prev) =>
      prev.map((p) => (p.id === selectedPayment.id ? { ...p, status: "unresolved" } : p))
    )

    moveToNextPendingPayment(selectedPayment.id)
  }

  async function fetchDonorPledges(donorId: string): Promise<Pledge[]> {
    const orgId = await getCurrentOrganizationId()

    if (!orgId) return []

    const { data, error } = await supabase
      .from("pledge_status_view")
      .select(`
        id,
        donor_name,
        campaign_name,
        amount_pledged,
        amount_paid,
        balance_remaining,
        pledge_date,
        donor_id
      `)
      .eq("organization_id", orgId)
      .eq("donor_id", donorId)
      .order("balance_remaining", { ascending: false })

    if (error) {
      console.error(error)
      return []
    }

    return (data || []).map((p: any) => ({
      id: p.id,
      donorName: p.donor_name || "Unknown",
      campaign: p.campaign_name || "No Campaign",
      totalAmount: Number(p.amount_pledged || 0),
      paidAmount: Number(p.amount_paid || 0),
      remainingAmount: Number(p.balance_remaining || 0),
      dueDate: p.pledge_date || null,
    }))
  }

  async function loadDonorPledges(donorId: string) {
    const pledges = await fetchDonorPledges(donorId)
    setDonorPledges(pledges)
  }

  const handleApplyToPledge = async (donor: DonorMatch) => {
    setSelectedDonor(donor)
    setSelectedPledgeId("")
    await loadDonorPledges(donor.id)
    setShowPledgeDialog(true)
  }

  async function handleQuickApply(donor: DonorMatch) {
    if (!selectedPayment) return

    setAllocating(true)

    const pledges = await fetchDonorPledges(donor.id)

    if (pledges.length === 0) {
      setAllocating(false)
      setSelectedDonor(donor)
      setSelectedPledgeId("")
      setDonorPledges([])
      setShowPledgeDialog(true)
      return
    }

    const bestPledge = pledges
      .filter((p) => p.remainingAmount > 0)
      .sort((a, b) => b.remainingAmount - a.remainingAmount)[0]

    if (!bestPledge) {
      setAllocating(false)
      setSelectedDonor(donor)
      setSelectedPledgeId("")
      setDonorPledges(pledges)
      setShowPledgeDialog(true)
      return
    }

    const { error } = await supabase
      .from("payments")
      .update({
        donor_id: donor.id,
        pledge_id: bestPledge.id,
        status: "allocated",
      })
      .eq("id", selectedPayment.id)

    setAllocating(false)

    if (error) {
      console.error(error)
      alert(error.message || "Could not apply payment")
      return
    }

    await loadPayments()
    setDonorMatches([])
  }

  const handleSaveNewDonor = async () => {
    if (!selectedPayment) return

    const orgId = await getCurrentOrganizationId()

    if (!orgId) {
      alert("No organization selected")
      return
    }

    if (!newDonorFullName.trim()) {
      alert("Full name is required")
      return
    }

    setCreatingDonor(true)

    const { data: donor, error: donorError } = await supabase
      .from("donors")
      .insert({
        organization_id: orgId,
        full_name: newDonorFullName.trim(),
        email: newDonorEmail.trim() || null,
        phone: newDonorPhone.trim() || null,
        notes: newDonorNotes.trim() || null,
      })
      .select("id")
      .single()

    if (donorError || !donor) {
      console.error(donorError)
      alert(donorError?.message || "Could not create donor")
      setCreatingDonor(false)
      return
    }

    const { error: paymentError } = await supabase
      .from("payments")
      .update({
        donor_id: donor.id,
        status: "unallocated",
      })
      .eq("id", selectedPayment.id)

    setCreatingDonor(false)

    if (paymentError) {
      console.error(paymentError)
      alert(paymentError.message || "Donor created, but payment could not be linked")
      return
    }

    setShowNewDonorDialog(false)
    setNewDonorFullName("")
    setNewDonorEmail("")
    setNewDonorPhone("")
    setNewDonorNotes("")

    await loadPayments()
  }

  const handleApplyPledgePayment = async () => {
    if (!selectedPayment) return

    if (!selectedPledgeId) {
      alert("Please select a pledge")
      return
    }

    setAllocating(true)

    const { error } = await supabase
      .from("payments")
      .update({
        pledge_id: selectedPledgeId,
        status: "allocated",
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
        donor_name,
        campaign_name,
        amount_pledged,
        amount_paid,
        balance_remaining,
        pledge_date
      `)
      .eq("organization_id", orgId)
      .order("donor_name", { ascending: true })

    if (error) {
      console.error(error)
      setAllPledges([])
      return
    }

    const formatted: Pledge[] = (data || []).map((p: any) => ({
      id: p.id,
      donorName: p.donor_name || "Unknown",
      campaign: p.campaign_name || "No Campaign",
      totalAmount: Number(p.amount_pledged || 0),
      paidAmount: Number(p.amount_paid || 0),
      remainingAmount: Number(p.balance_remaining || 0),
      dueDate: p.pledge_date || null,
    }))

    setAllPledges(formatted)
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
        sender_name,
        donors ( full_name )
      `)
      .eq("organization_id", orgId)
      .in("status", ["unallocated", "pending_review"])
      .order("payment_date", { ascending: false })

    if (error) {
      console.error(error)
      setPayments([])
      return
    }

    const formatted: UnmatchedPayment[] = (data || []).map((p: any) => ({
      id: p.id,
      importDate: p.payment_date || null,
      source: (p.source || "cash").toLowerCase(),
      senderName: p.sender_name || p.donors?.full_name || "Unknown",
      amount: Number(p.amount || 0),
      date: p.payment_date || null,
      memo: p.memo || "",
      status: "pending",
    }))

    setPayments(formatted)

    if (formatted.length > 0) {
      setSelectedPayment((current) => {
        if (!current) return formatted[0]
        return formatted.find((p) => p.id === current.id) || formatted[0]
      })
    } else {
      setSelectedPayment(null)
    }
  }

  async function loadDonorMatches(payment: UnmatchedPayment) {
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

    const searchTerm = paymentParts[0]

    const { data, error } = await supabase
      .from("donors")
      .select(`
        id,
        full_name,
        email,
        phone
      `)
      .eq("organization_id", orgId)
      .ilike("full_name", `%${searchTerm}%`)
      .limit(20)

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
          name: d.full_name,
          email: d.email || "",
          phone: d.phone || "",
          totalDonations: 0,
          lastDonation: "",
          confidenceScore: match.score,
          matchReason: match.reason,
        }
      })
      .filter((d) => d.confidenceScore > 0)
      .sort((a, b) => b.confidenceScore - a.confidenceScore)
      .slice(0, 5)

    setDonorMatches(formatted)
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
                  <p className="text-xs text-muted-foreground">Matched</p>
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
                    $
                    {payments
                      .filter((p) => p.status === "pending")
                      .reduce((sum, p) => sum + p.amount, 0)
                      .toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">Pending Amount</p>
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

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="matched">Matched</SelectItem>
                    <SelectItem value="unresolved">Unresolved</SelectItem>
                    <SelectItem value="new_donor">New Donor</SelectItem>
                  </SelectContent>
                </Select>
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
                            {payment.source
                              ? payment.source.charAt(0).toUpperCase() + payment.source.slice(1)
                              : "—"}
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
                                  {donor.email} | {donor.phone}
                                </p>

                                <p className="mt-1 text-xs text-muted-foreground">
                                  {donor.matchReason}
                                </p>

                                <div className="mt-2 flex items-center gap-4 text-xs">
                                  <span>
                                    Total: <strong>${donor.totalDonations.toLocaleString()}</strong>
                                  </span>
                                  <span>
                                    Last: <strong>{donor.lastDonation}</strong>
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
                                Match
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
                            ? "This payment has no donor name to match against"
                            : "No matching donors found"}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="border-t pt-4">
                    <h4 className="mb-3 text-sm font-medium">Quick Actions</h4>
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="outline" onClick={handleCreateNewDonor}>
                        <UserPlus className="mr-1.5 h-4 w-4" />
                        Create New Donor
                      </Button>

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

      <Dialog open={showNewDonorDialog} onOpenChange={setShowNewDonorDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Donor</DialogTitle>
            <DialogDescription>
              Create a new donor record from this payment
            </DialogDescription>
          </DialogHeader>

          {selectedPayment && (
            <div className="flex flex-col gap-4 py-4">
              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground">Payment Info</p>
                <p className="font-medium">{selectedPayment.senderName}</p>
                <p className="text-sm text-emerald-600">
                  ${selectedPayment.amount.toLocaleString()}
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>Full Name</Label>
                <Input
                  value={newDonorFullName}
                  onChange={(e) => setNewDonorFullName(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    placeholder="email@example.com"
                    value={newDonorEmail}
                    onChange={(e) => setNewDonorEmail(e.target.value)}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label>Phone</Label>
                  <Input
                    type="tel"
                    placeholder="(555) 123-4567"
                    value={newDonorPhone}
                    onChange={(e) => setNewDonorPhone(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label>Notes</Label>
                <Textarea
                  placeholder="Add any notes about this donor..."
                  value={newDonorNotes}
                  onChange={(e) => setNewDonorNotes(e.target.value)}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewDonorDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveNewDonor} disabled={creatingDonor}>
              <Plus className="mr-1.5 h-4 w-4" />
              {creatingDonor ? "Creating..." : "Create & Match"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                      No pledges were found for this donor. Showing all organization pledges instead.
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
                      <div className="flex justify-between">
                        <div>
                          <p className="font-medium">{pledge.campaign}</p>
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
                    No pledges found in this organization
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