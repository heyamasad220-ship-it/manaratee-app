"use client"

import Papa from "papaparse"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  DollarSign,
  Link2,
  Search,
  Upload,
  UserPlus,
  XCircle,
  Zap,
} from "lucide-react"

import {
  QuickAddContactDialog,
  type QuickAddContactResult,
} from "@/components/contacts/quick-add-contact-dialog"
import {
  DonationAttributionFields,
  EMPTY_DONATION_ATTRIBUTION_VALUE,
  toAttributionIds,
  type DonationAttributionValue,
} from "@/components/donations/donation-attribution-fields"
import {
  DonationMetricCard,
  DonationMetricCardGrid,
} from "@/components/donations/donation-metric-card"
import { formatDonationCurrency } from "@/lib/donations/campaign-analytics"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { getCurrentOrganizationId } from "@/lib/current-organization"
import type { ContactMatchResult } from "@/lib/donations/payment-contact-matching"
import { filterStrongContactMatches } from "@/lib/donations/payment-contact-matching"
import type { PaymentMatchQueueItem } from "@/lib/donations/payment-import-match-types"
import {
  allocatePaymentToPledgeAction,
  beginPaymentCsvImportAction,
  bulkAutoMatchImportPaymentsAction,
  fetchAllOpenPledgesAction,
  fetchOpenPledgesForDonorAction,
  fetchPaymentImportHistoryAction,
  fetchPaymentMatchQueueAction,
  findContactMatchesForPaymentAction,
  importPaymentCsvChunkAction,
  markPaymentUnresolvedAction,
  matchPaymentToContactAction,
  searchContactsForPaymentMatchAction,
} from "@/lib/donations/payment-import-match-actions"
import {
  dedupeValidPaymentCsvRows,
  PAYMENT_CSV_IMPORT_CHUNK_SIZE,
  parsePaymentCsvRows,
  validatePaymentCsvRow,
  type ParsedPaymentCsvRow,
} from "@/lib/donations/payment-import-csv"
import { cn } from "@/lib/utils"

type ImportHistoryBatch = {
  id: string
  fileName: string
  rowCount: number
  status: string
  createdAt: string
  importedPayments: number
}

type PledgeOption = {
  id: string
  donorId: string | null
  donorName: string
  campaign: string
  totalAmount: number
  paidAmount: number
  remainingAmount: number
  dueDate: string | null
}

const sourceColors: Record<string, string> = {
  zelle: "bg-purple-100 text-purple-700",
  venmo: "bg-blue-100 text-blue-700",
  paypal: "bg-amber-100 text-amber-700",
  cash: "bg-slate-100 text-slate-700",
  check: "bg-slate-100 text-slate-700",
  stripe: "bg-indigo-100 text-indigo-700",
  import: "bg-gray-100 text-gray-700",
  manual: "bg-gray-100 text-slate-700",
}

const statusConfig = {
  pending_review: { label: "Needs match", color: "bg-amber-100 text-amber-700", icon: Clock },
  unallocated: { label: "Recorded", color: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
  unresolved: { label: "Unresolved", color: "bg-red-100 text-red-700", icon: XCircle },
} as const

type MatchQueueFilter =
  | "all"
  | "pending_review"
  | "unallocated"
  | "linkable_pledge"
  | "unresolved"

function getConfidenceColor(score: number) {
  if (score >= 85) return "bg-emerald-100 text-emerald-700 border-emerald-200"
  if (score >= 60) return "bg-amber-100 text-amber-700 border-amber-200"
  return "bg-red-100 text-red-700 border-red-200"
}

function formatDate(value: string | null) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleDateString()
}

export function PaymentImportMatchWorkspace({ mode }: { mode: "import" | "match" }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [importSubTab, setImportSubTab] = useState<"upload" | "history">("upload")

  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [fileName, setFileName] = useState("")
  const [loadingFile, setLoadingFile] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importProgress, setImportProgress] = useState<string | null>(null)
  const [parsedRows, setParsedRows] = useState<ParsedPaymentCsvRow[]>([])
  const [defaultAttribution, setDefaultAttribution] = useState<DonationAttributionValue>(
    EMPTY_DONATION_ATTRIBUTION_VALUE
  )

  const [payments, setPayments] = useState<PaymentMatchQueueItem[]>([])
  const [selectedPayment, setSelectedPayment] = useState<PaymentMatchQueueItem | null>(null)
  const [matches, setMatches] = useState<ContactMatchResult[]>([])
  const [loadingQueue, setLoadingQueue] = useState(false)
  const [loadingMatches, setLoadingMatches] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<MatchQueueFilter>(
    mode === "match" ? "pending_review" : "pending_review"
  )
  const hasSetInitialMatchFilter = useRef(false)
  const [manualSearch, setManualSearch] = useState("")
  const [manualMatches, setManualMatches] = useState<ContactMatchResult[]>([])
  const [searchingManual, setSearchingManual] = useState(false)
  const [bulkMatching, setBulkMatching] = useState(false)
  const [allocating, setAllocating] = useState(false)
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [showPledgeDialog, setShowPledgeDialog] = useState(false)
  const [selectedMatch, setSelectedMatch] = useState<ContactMatchResult | null>(null)
  const [donorPledges, setDonorPledges] = useState<PledgeOption[]>([])
  const [allPledges, setAllPledges] = useState<PledgeOption[]>([])
  const [selectedPledgeId, setSelectedPledgeId] = useState("")

  const [history, setHistory] = useState<ImportHistoryBatch[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [autoMatchAfterImport, setAutoMatchAfterImport] = useState(true)
  const [autoAllocatePledge, setAutoAllocatePledge] = useState(true)

  const validRows = useMemo(
    () => parsedRows.filter((row) => validatePaymentCsvRow(row).valid),
    [parsedRows]
  )
  const invalidRows = useMemo(
    () => parsedRows.filter((row) => !validatePaymentCsvRow(row).valid),
    [parsedRows]
  )

  const donorIdsWithOpenPledges = useMemo(
    () =>
      new Set(
        allPledges
          .map((pledge) => pledge.donorId)
          .filter((donorId): donorId is string => Boolean(donorId))
      ),
    [allPledges]
  )

  const paymentMayLinkToPledge = useCallback(
    (payment: PaymentMatchQueueItem) =>
      payment.status === "unallocated" &&
      Boolean(payment.donorId) &&
      donorIdsWithOpenPledges.has(payment.donorId as string),
    [donorIdsWithOpenPledges]
  )

  const filteredPayments = useMemo(
    () =>
      payments.filter((payment) => {
        const matchesSearch =
          payment.senderName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          payment.memo.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (payment.importEmail || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
          (payment.importPhone || "").includes(searchQuery)

        const matchesStatus =
          statusFilter === "all" ||
          (statusFilter === "linkable_pledge"
            ? paymentMayLinkToPledge(payment)
            : payment.status === statusFilter)

        return matchesSearch && matchesStatus
      }),
    [payments, paymentMayLinkToPledge, searchQuery, statusFilter]
  )

  const pendingCount = payments.filter((payment) => payment.status === "pending_review").length
  const standaloneGiftCount = payments.filter((payment) => payment.status === "unallocated").length
  const linkablePledgeCount = payments.filter((payment) => paymentMayLinkToPledge(payment)).length
  const unresolvedCount = payments.filter((payment) => payment.status === "unresolved").length
  const actionableQueueAmount = useMemo(
    () =>
      payments
        .filter(
          (payment) =>
            payment.status === "pending_review" ||
            payment.status === "unresolved" ||
            paymentMayLinkToPledge(payment)
        )
        .reduce((sum, payment) => sum + payment.amount, 0),
    [paymentMayLinkToPledge, payments]
  )

  const strongSuggestedMatches = useMemo(
    () => filterStrongContactMatches(matches, 85),
    [matches]
  )

  const currentIndex = selectedPayment
    ? filteredPayments.findIndex((payment) => payment.id === selectedPayment.id)
    : -1

  const pledgeOptionsToShow = donorPledges.length > 0 ? donorPledges : allPledges
  const showingFallbackPledges =
    selectedMatch !== null && donorPledges.length === 0 && allPledges.length > 0

  useEffect(() => {
    if (mode !== "import") return
    setImportSubTab(searchParams.get("tab") === "history" ? "history" : "upload")
  }, [mode, searchParams])

  const setImportTab = useCallback(
    (tab: "upload" | "history") => {
      setImportSubTab(tab)
      const params = new URLSearchParams(searchParams.toString())
      if (tab === "upload") params.delete("tab")
      else params.set("tab", "history")
      const query = params.toString()
      router.replace(query ? `?${query}` : "?", { scroll: false })
    },
    [router, searchParams]
  )

  const loadQueue = useCallback(async () => {
    setLoadingQueue(true)
    const result = await fetchPaymentMatchQueueAction()
    setLoadingQueue(false)

    if (!result.success) {
      alert(result.error)
      setPayments([])
      return
    }

    setPayments(result.payments)
    setSelectedPayment((current) => {
      if (result.payments.length === 0) return null
      if (current && result.payments.some((payment) => payment.id === current.id)) return current
      return result.payments[0]
    })
  }, [])

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true)
    const result = await fetchPaymentImportHistoryAction()
    setLoadingHistory(false)
    if (!result.success) {
      alert(result.error)
      return
    }
    setHistory(result.batches)
  }, [])

  const loadAllPledges = useCallback(async () => {
    const result = await fetchAllOpenPledgesAction()
    if (result.success) setAllPledges(result.pledges)
  }, [])

  const loadMatches = useCallback(async (payment: PaymentMatchQueueItem) => {
    setLoadingMatches(true)
    const result = await findContactMatchesForPaymentAction({
      senderName: payment.senderName,
      importEmail: payment.importEmail,
      importPhone: payment.importPhone,
    })
    setLoadingMatches(false)

    if (!result.success) {
      console.error(result.error)
      setMatches([])
      return
    }

    setMatches(result.matches)
  }, [])

  useEffect(() => {
    getCurrentOrganizationId().then(setOrganizationId)
    if (mode === "match") {
      loadQueue()
      loadAllPledges()
      return
    }
    loadHistory()
  }, [mode, loadQueue, loadAllPledges, loadHistory])

  useEffect(() => {
    if (mode !== "match" || loadingQueue || hasSetInitialMatchFilter.current) return

    hasSetInitialMatchFilter.current = true
    if (pendingCount > 0) {
      setStatusFilter("pending_review")
      return
    }
    if (linkablePledgeCount > 0) {
      setStatusFilter("linkable_pledge")
      return
    }
    setStatusFilter("pending_review")
  }, [linkablePledgeCount, loadingQueue, mode, pendingCount])

  useEffect(() => {
    if (mode !== "match") return

    setSelectedPayment((current) => {
      if (filteredPayments.length === 0) return null
      if (current && filteredPayments.some((payment) => payment.id === current.id)) return current
      return filteredPayments[0]
    })
  }, [filteredPayments, mode])

  useEffect(() => {
    if (selectedPayment) {
      if (selectedPayment.status === "pending_review") {
        void loadMatches(selectedPayment)
      } else {
        setMatches([])
      }
      setManualSearch("")
      setManualMatches([])
    } else {
      setMatches([])
    }
  }, [selectedPayment, loadMatches])

  function handleFileChange(file: File | null) {
    if (!file) return

    setFileName(file.name)
    setLoadingFile(true)

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setParsedRows(parsePaymentCsvRows(results.data as Record<string, string>[]))
        setLoadingFile(false)
      },
      error: () => {
        alert("Could not read CSV file")
        setLoadingFile(false)
      },
    })
  }

  async function runBulkAutoMatch(options?: {
    importBatchId?: string | null
    showAlert?: boolean
  }) {
    let totalMatched = 0
    let totalAllocated = 0
    let totalMatchedUnallocated = 0
    let totalSkipped = 0
    let totalContactsCreated = 0
    let remaining = 1
    let rounds = 0

    while (remaining > 0 && rounds < 50) {
      rounds += 1
      setImportProgress(
        options?.importBatchId
          ? `Auto-matching payments (${totalMatched} matched so far)...`
          : `Auto-matching batch ${rounds}...`
      )

      const result = await bulkAutoMatchImportPaymentsAction({
        minScore: 85,
        importBatchId: options?.importBatchId ?? null,
        autoAllocatePledge,
      })

      if (!result.success) {
        if (options?.showAlert) alert(result.error)
        return {
          success: false as const,
          error: result.error,
          totalMatched,
          totalAllocated,
          totalMatchedUnallocated,
          totalSkipped,
        }
      }

      totalMatched += result.matched
      totalAllocated += result.allocated
      totalMatchedUnallocated += result.matchedUnallocated
      totalSkipped += result.skipped
      totalContactsCreated += result.contactsCreated
      remaining = result.remaining

      if (result.matched === 0 && result.contactsCreated === 0) break
    }

    if (options?.showAlert) {
      alert(
        `Processed ${totalMatched} payment(s).` +
          (totalContactsCreated > 0 ? ` Created ${totalContactsCreated} new contact(s).` : "") +
          (totalAllocated > 0 ? ` ${totalAllocated} allocated to pledges.` : "") +
          (totalMatchedUnallocated > 0
            ? ` ${totalMatchedUnallocated} matched but need pledge selection.`
            : "") +
          (totalSkipped > 0 ? ` ${totalSkipped} need manual review in the last batch.` : "") +
          (remaining > 0 ? ` ${remaining} still need manual matching.` : "")
      )
    }

    await loadQueue()
    return {
      success: true as const,
      totalMatched,
      totalAllocated,
      totalMatchedUnallocated,
      totalSkipped,
      totalContactsCreated,
      remaining,
    }
  }

  async function handleImportCsv() {
    if (validRows.length === 0) {
      alert("No valid payment rows to import")
      return
    }

    const { unique, duplicates: fileDuplicates } = dedupeValidPaymentCsvRows(parsedRows)
    if (unique.length === 0) {
      alert("All valid rows are duplicates within this file")
      return
    }

    setImporting(true)
    setImportProgress("Starting import...")

    const begin = await beginPaymentCsvImportAction({
      fileName: fileName || "payment-import.csv",
      totalRows: parsedRows.length,
    })

    if (!begin.success) {
      setImporting(false)
      setImportProgress(null)
      alert(begin.error)
      return
    }

    const attribution = toAttributionIds(defaultAttribution)
    let imported = 0
    let dbDuplicates = 0
    const totalChunks = Math.ceil(unique.length / PAYMENT_CSV_IMPORT_CHUNK_SIZE)

    for (let index = 0; index < unique.length; index += PAYMENT_CSV_IMPORT_CHUNK_SIZE) {
      const chunkNumber = Math.floor(index / PAYMENT_CSV_IMPORT_CHUNK_SIZE) + 1
      setImportProgress(`Importing chunk ${chunkNumber} of ${totalChunks}...`)

      const chunk = unique.slice(index, index + PAYMENT_CSV_IMPORT_CHUNK_SIZE)
      const isLastChunk = index + PAYMENT_CSV_IMPORT_CHUNK_SIZE >= unique.length

      const chunkResult = await importPaymentCsvChunkAction({
        batchId: begin.batchId,
        rows: chunk,
        defaultAttribution: attribution,
        isLastChunk,
        totalRows: parsedRows.length,
      })

      if (!chunkResult.success) {
        setImporting(false)
        setImportProgress(null)
        alert(chunkResult.error)
        return
      }

      imported += chunkResult.imported
      dbDuplicates += chunkResult.duplicates
    }

    const duplicates = fileDuplicates + dbDuplicates

    if (autoMatchAfterImport && imported > 0) {
      setImportProgress("Auto-matching and creating contacts...")
      const autoMatch = await runBulkAutoMatch({ importBatchId: begin.batchId })

      setImporting(false)
      setImportProgress(null)

      if (!autoMatch.success) {
        alert(
          `Imported ${imported} payment(s), but auto-match failed: ${autoMatch.error}` +
            (duplicates > 0 ? ` Skipped ${duplicates} duplicate(s).` : "")
        )
      } else {
        alert(
          `Imported ${imported} payment(s).` +
            (duplicates > 0 ? ` Skipped ${duplicates} duplicate(s).` : "") +
            (invalidRows.length > 0 ? ` ${invalidRows.length} row(s) were invalid.` : "") +
            ` Processed ${autoMatch.totalMatched} payment(s).` +
            (autoMatch.totalContactsCreated > 0
              ? ` Created ${autoMatch.totalContactsCreated} new contact(s).`
              : "") +
            (autoMatch.totalAllocated > 0
              ? ` ${autoMatch.totalAllocated} allocated to pledges.`
              : "") +
            (autoMatch.totalMatchedUnallocated > 0
              ? ` ${autoMatch.totalMatchedUnallocated} matched but need pledge selection.`
              : "") +
            (autoMatch.remaining > 0
              ? ` ${autoMatch.remaining} still need manual review.`
              : " Queue fully processed.")
        )
      }
    } else {
      setImporting(false)
      setImportProgress(null)

      alert(
        `Imported ${imported} payment(s) into the match queue.` +
          (duplicates > 0 ? ` Skipped ${duplicates} duplicate(s).` : "") +
          (invalidRows.length > 0 ? ` ${invalidRows.length} row(s) were invalid.` : "")
      )
    }

    setParsedRows([])
    setFileName("")
    await loadHistory()
    router.push("/donations/reports/match")
  }

  async function handleBulkAutoMatch() {
    const confirmed = window.confirm(
      "Process all pending payments?\n\n" +
        "• Link to an existing contact when match confidence is ≥85% (email, phone, or name).\n" +
        "• Otherwise create a new contact from the payment name when there is no email or phone on the import." +
        (autoAllocatePledge
          ? "\n\nClear lump-sum pledges are preferred over installment schedules."
          : "\n\nPledges will not be auto-allocated.")
    )
    if (!confirmed) return

    setBulkMatching(true)
    setImportProgress("Auto-matching...")
    const result = await runBulkAutoMatch({ showAlert: true })
    setBulkMatching(false)
    setImportProgress(null)

    if (!result.success) {
      alert(result.error)
    }
  }

  async function handleManualSearch() {
    if (!manualSearch.trim()) {
      setManualMatches([])
      return
    }

    setSearchingManual(true)
    const result = await searchContactsForPaymentMatchAction(manualSearch.trim(), 10)
    setSearchingManual(false)

    if (!result.success) {
      alert(result.error)
      return
    }

    setManualMatches(result.matches)
  }

  async function handleMatch(contactId: string, mode: "match_only" | "allocate_best_pledge") {
    if (!selectedPayment) return

    setAllocating(true)
    const result = await matchPaymentToContactAction({
      paymentId: selectedPayment.id,
      contactId,
      mode,
    })
    setAllocating(false)

    if (!result.success) {
      alert(result.error)
      return
    }

    const next = payments.find(
      (payment) => payment.id !== selectedPayment.id && payment.status === "pending_review"
    )
    await loadQueue()
    setSelectedPayment(next || null)
  }

  async function handleApplyToPledge(match: ContactMatchResult) {
    setSelectedMatch(match)
    setSelectedPledgeId("")

    if (match.donorId) {
      const result = await fetchOpenPledgesForDonorAction(match.donorId)
      setDonorPledges(result.success ? result.pledges : [])
    } else {
      setDonorPledges([])
    }

    setShowPledgeDialog(true)
  }

  async function handleLinkExistingPaymentToPledge() {
    if (!selectedPayment?.donorId) return

    const contactId = selectedPayment.contactId
    if (!contactId) {
      alert("This payment is linked to a donor but has no contact profile.")
      return
    }

    setSelectedMatch({
      contactId,
      donorId: selectedPayment.donorId,
      name: selectedPayment.senderName,
      email: selectedPayment.importEmail || "",
      phone: selectedPayment.importPhone || "",
      totalDonations: 0,
      lastDonation: "",
      confidenceScore: 100,
      matchReason: "Already linked to this donor",
    })
    setSelectedPledgeId("")

    const result = await fetchOpenPledgesForDonorAction(selectedPayment.donorId)
    setDonorPledges(result.success ? result.pledges : [])
    setShowPledgeDialog(true)
  }

  function getDetailPanelTitle(payment: PaymentMatchQueueItem) {
    if (payment.status === "pending_review") return "Match payment"
    if (payment.status === "unresolved") return "Resolve payment"
    if (paymentMayLinkToPledge(payment)) return "Link to pledge (optional)"
    return "Recorded gift"
  }

  function getDetailPanelDescription(payment: PaymentMatchQueueItem) {
    if (payment.status === "pending_review") {
      return "Link this payment to the correct donor contact."
    }
    if (payment.status === "unresolved") {
      return "Review this payment and match it or leave it unresolved."
    }
    if (paymentMayLinkToPledge(payment)) {
      return "This gift is already recorded. Link it only if it should count toward an open pledge."
    }
    return "This gift is already matched to a donor and counts as a standalone donation. No action required."
  }

  async function handleApplyPledgePayment() {
    if (!selectedPayment || !selectedMatch || !selectedPledgeId) {
      alert("Please select a pledge")
      return
    }

    setAllocating(true)
    const result = await allocatePaymentToPledgeAction({
      paymentId: selectedPayment.id,
      contactId: selectedMatch.contactId,
      pledgeId: selectedPledgeId,
    })
    setAllocating(false)

    if (!result.success) {
      alert(result.error)
      return
    }

    setShowPledgeDialog(false)
    setSelectedMatch(null)
    setSelectedPledgeId("")
    setDonorPledges([])
    await loadQueue()
    await loadAllPledges()
  }

  async function handleQuickAddCreated(contact: QuickAddContactResult) {
    if (!selectedPayment) return
    await handleMatch(contact.contactId, "match_only")
  }

  async function handleMarkUnresolved() {
    if (!selectedPayment) return

    const result = await markPaymentUnresolvedAction(selectedPayment.id)
    if (!result.success) {
      alert(result.error)
      return
    }

    const next = payments.find(
      (payment) => payment.id !== selectedPayment.id && payment.status === "pending_review"
    )
    await loadQueue()
    setSelectedPayment(next || null)
  }

  function renderMatchCard(match: ContactMatchResult, index: number, prefix: string) {
    return (
      <div
        key={`${prefix}-${match.contactId}`}
        className="rounded-lg border p-3 transition-colors hover:border-primary/50"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-medium">{match.name}</span>
              {index === 0 && match.confidenceScore >= 85 && (
                <span className="text-xs text-muted-foreground">Top match</span>
              )}
              <Badge
                variant="outline"
                className={cn("text-xs font-semibold", getConfidenceColor(match.confidenceScore))}
              >
                {match.confidenceScore}% match
              </Badge>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {match.email || "No email"} | {match.phone || "No phone"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{match.matchReason}</p>
          </div>
        </div>

        <div className="mt-3 flex gap-2">
          <Button
            size="sm"
            className="flex-1"
            disabled={allocating}
            onClick={() => handleMatch(match.contactId, "allocate_best_pledge")}
          >
            <Zap className="mr-1.5 h-3.5 w-3.5" />
            Quick Apply
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1"
            onClick={() => handleMatch(match.contactId, "match_only")}
          >
            <Link2 className="mr-1.5 h-3.5 w-3.5" />
            Match Only
          </Button>
          <Button size="sm" variant="outline" className="flex-1" onClick={() => handleApplyToPledge(match)}>
            <DollarSign className="mr-1.5 h-3.5 w-3.5" />
            Choose Pledge
          </Button>
        </div>
      </div>
    )
  }

  const importView = (
    <Tabs
      value={importSubTab}
      onValueChange={(value) => setImportTab(value as "upload" | "history")}
      className="space-y-6"
    >
      <TabsList>
        <TabsTrigger value="upload">Upload</TabsTrigger>
        <TabsTrigger value="history">History</TabsTrigger>
      </TabsList>

      <TabsContent value="upload" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Upload payment file</CardTitle>
              <CardDescription>
                Upload a CSV and payments go straight into the match queue. No staging step.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="import-csv">CSV file</Label>
                <Input
                  id="import-csv"
                  type="file"
                  accept=".csv"
                  onChange={(event) => handleFileChange(event.target.files?.[0] || null)}
                />
              </div>

              <div className="text-sm text-muted-foreground">
                Columns: <strong>sender_name</strong>, <strong>amount</strong>,{" "}
                <strong>payment_date</strong>, <strong>reference</strong>. Optional:{" "}
                <strong>email</strong>, <strong>phone</strong>, <strong>source</strong> (zelle, paypal,
                venmo, check), <strong>campaign</strong>, <strong>category</strong>, <strong>fund</strong>.
              </div>

              <div className="rounded-md border p-4 space-y-3">
                <div>
                  <p className="text-sm font-medium">Default attribution</p>
                  <p className="text-xs text-muted-foreground">
                    Used when CSV rows omit campaign, category, or fund.
                  </p>
                </div>
                <DonationAttributionFields
                  organizationId={organizationId}
                  value={defaultAttribution}
                  onChange={setDefaultAttribution}
                />
              </div>

              <div className="flex items-start gap-3 rounded-md border p-4">
                <Checkbox
                  id="auto-match-after-import"
                  checked={autoMatchAfterImport}
                  onCheckedChange={(checked) => setAutoMatchAfterImport(checked === true)}
                />
                <div className="space-y-1">
                  <Label htmlFor="auto-match-after-import" className="text-sm font-medium">
                    Auto-match after import (recommended)
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Links to existing contacts at ≥85% confidence, or creates a new contact from the
                    payment name when the import has no email or phone and no strong name match.
                  </p>
                  {autoMatchAfterImport && (
                    <div className="mt-3 flex items-start gap-3 rounded-md border bg-muted/30 p-3">
                      <Checkbox
                        id="auto-allocate-pledge"
                        checked={autoAllocatePledge}
                        onCheckedChange={(checked) => setAutoAllocatePledge(checked === true)}
                      />
                      <div className="space-y-1">
                        <Label htmlFor="auto-allocate-pledge" className="text-sm font-medium">
                          Auto-allocate to best pledge
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Prefers lump-sum (one-time) open pledges over installment schedules,
                          especially when the donor has an active recurring plan. Ambiguous ties
                          stay matched but unallocated.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <Button onClick={handleImportCsv} disabled={importing || validRows.length === 0}>
                <Upload className="mr-2 h-4 w-4" />
                {importing
                  ? importProgress || "Importing..."
                  : `Import ${validRows.length} payment(s)`}
              </Button>
              {importProgress && (
                <p className="text-sm text-muted-foreground">{importProgress}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Preview</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingFile ? (
                <p className="text-sm text-muted-foreground">Reading file...</p>
              ) : parsedRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">No payment rows loaded yet.</p>
              ) : (
                <>
                  <p className="mb-3 text-sm">
                    Total: <strong>{parsedRows.length}</strong> | Valid:{" "}
                    <strong>{validRows.length}</strong> | Invalid: <strong>{invalidRows.length}</strong>
                  </p>
                  <div className="overflow-x-auto rounded-md border">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr className="border-b">
                          <th className="p-3 text-left">Name</th>
                          <th className="p-3 text-left">Email</th>
                          <th className="p-3 text-left">Phone</th>
                          <th className="p-3 text-left">Amount</th>
                          <th className="p-3 text-left">Date</th>
                          <th className="p-3 text-left">Reference</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsedRows.slice(0, 25).map((row, index) => (
                          <tr key={index} className="border-b">
                            <td className="p-3">{row.sender_name || "—"}</td>
                            <td className="p-3">{row.email || "—"}</td>
                            <td className="p-3">{row.phone || "—"}</td>
                            <td className="p-3">{row.amount || "—"}</td>
                            <td className="p-3">{row.payment_date || "—"}</td>
                            <td className="p-3">{row.reference || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

      <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Import history</CardTitle>
              <CardDescription>Audit trail of uploaded payment files.</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingHistory ? (
                <p className="text-sm text-muted-foreground">Loading history...</p>
              ) : history.length === 0 ? (
                <p className="text-sm text-muted-foreground">No imports yet.</p>
              ) : (
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr className="border-b">
                        <th className="p-3 text-left">File</th>
                        <th className="p-3 text-left">Uploaded</th>
                        <th className="p-3 text-left">Rows in file</th>
                        <th className="p-3 text-left">Payments created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((batch) => (
                        <tr key={batch.id} className="border-b">
                          <td className="p-3">{batch.fileName}</td>
                          <td className="p-3">{formatDate(batch.createdAt)}</td>
                          <td className="p-3">{batch.rowCount}</td>
                          <td className="p-3">{batch.importedPayments}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
    </Tabs>
  )

  const matchView = (
    <div className="space-y-6">
          {pendingCount === 0 ? (
            <Card className="border-sky-200 bg-sky-50/60">
              <CardContent className="py-4 text-sm">
                <p className="font-medium text-foreground">No payments need donor matching.</p>
                <p className="mt-1 text-muted-foreground">
                  {standaloneGiftCount > 0
                    ? `${standaloneGiftCount.toLocaleString()} gift(s) are already recorded as standalone donations and do not need to be matched or linked to a pledge.`
                    : "New imported payments that need a donor match will appear here."}
                  {linkablePledgeCount > 0
                    ? ` ${linkablePledgeCount.toLocaleString()} gift(s) may optionally be linked to an open pledge — use the filter below or click the “May link to pledge” card.`
                    : ""}
                </p>
              </CardContent>
            </Card>
          ) : null}

          <div className="mb-4 flex flex-wrap items-center gap-3">
            <Button variant="outline" onClick={handleBulkAutoMatch} disabled={bulkMatching || pendingCount === 0}>
              {bulkMatching ? "Processing..." : "Auto-match & create contacts"}
            </Button>
            <div className="flex items-center gap-2">
              <Checkbox
                id="bulk-auto-allocate-pledge"
                checked={autoAllocatePledge}
                onCheckedChange={(checked) => setAutoAllocatePledge(checked === true)}
              />
              <Label htmlFor="bulk-auto-allocate-pledge" className="text-sm text-muted-foreground">
                Auto-allocate to best pledge
              </Label>
            </div>
            <p className="text-sm text-muted-foreground">
              High-confidence matches link to existing contacts. Name-only imports with no match create
              a new contact automatically when you run Auto-match.
            </p>
          </div>

          <DonationMetricCardGrid colorful className="mb-6 lg:grid-cols-4">
            <DonationMetricCard
              title="Needs match"
              value={pendingCount}
              icon={Clock}
              accent="amber"
              onValueClick={() => setStatusFilter("pending_review")}
            />
            <DonationMetricCard
              title="May link to pledge"
              value={linkablePledgeCount}
              icon={Link2}
              accent="emerald"
              description="Optional — donor has an open pledge"
              onValueClick={() => setStatusFilter("linkable_pledge")}
            />
            <DonationMetricCard
              title="Unresolved"
              value={unresolvedCount}
              icon={AlertCircle}
              accent="rose"
              onValueClick={() => setStatusFilter("unresolved")}
            />
            <DonationMetricCard
              title="Action queue amount"
              value={formatDonationCurrency(actionableQueueAmount)}
              icon={DollarSign}
              accent="purple"
              description={
                standaloneGiftCount > 0
                  ? `${standaloneGiftCount.toLocaleString()} standalone gifts excluded`
                  : "Needs match, pledge link, or review"
              }
              onValueClick={() =>
                setStatusFilter(
                  linkablePledgeCount > 0
                    ? "linkable_pledge"
                    : pendingCount > 0
                      ? "pending_review"
                      : "unresolved"
                )
              }
            />
          </DonationMetricCardGrid>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="flex flex-col">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Payment queue</CardTitle>
                <div className="mt-2 flex gap-2">
                  <select
                    className="h-9 rounded-md border bg-background px-3 text-sm"
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value as MatchQueueFilter)}
                  >
                    <option value="pending_review">Needs match</option>
                    <option value="linkable_pledge">May link to pledge</option>
                    <option value="unresolved">Unresolved</option>
                    <option value="unallocated">All recorded gifts</option>
                    <option value="all">All queue items</option>
                  </select>
                </div>
                <div className="relative mt-2">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search name, email, phone, memo..."
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    className="pl-9"
                  />
                </div>
              </CardHeader>
              <CardContent className="flex-1 overflow-auto p-0">
                {loadingQueue ? (
                  <p className="p-4 text-sm text-muted-foreground">Loading queue...</p>
                ) : (
                  <div className="flex flex-col">
                    {filteredPayments.map((payment) => {
                      const StatusIcon = statusConfig[payment.status].icon
                      return (
                        <button
                          key={payment.id}
                          type="button"
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
                            {(payment.importEmail || payment.importPhone) && (
                              <p className="truncate text-xs text-muted-foreground">
                                {[payment.importEmail, payment.importPhone].filter(Boolean).join(" | ")}
                              </p>
                            )}
                            <p className="truncate text-sm text-muted-foreground">
                              {payment.memo || "No memo"}
                            </p>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1">
                            <span className="font-semibold text-emerald-600">
                              ${payment.amount.toLocaleString()}
                            </span>
                            <Badge variant="secondary" className={cn("text-xs", statusConfig[payment.status].color)}>
                              <StatusIcon className="mr-1 h-3 w-3" />
                              {statusConfig[payment.status].label}
                            </Badge>
                          </div>
                        </button>
                      )
                    })}
                    {filteredPayments.length === 0 && (
                      <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
                        <CheckCircle2 className="h-12 w-12 text-muted-foreground/30" />
                        <p className="mt-2 text-sm font-medium text-foreground">
                          {statusFilter === "pending_review"
                            ? "No payments need donor matching."
                            : statusFilter === "linkable_pledge"
                              ? "No gifts need to be linked to a pledge."
                              : statusFilter === "unresolved"
                                ? "No unresolved payments."
                                : "No payments in this view."}
                        </p>
                        {statusFilter === "pending_review" && standaloneGiftCount > 0 ? (
                          <p className="mt-2 max-w-sm text-xs text-muted-foreground">
                            {standaloneGiftCount.toLocaleString()} standalone gifts are already recorded.
                          </p>
                        ) : null}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="flex flex-col">
              {selectedPayment ? (
                <>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-base">
                          {getDetailPanelTitle(selectedPayment)}
                        </CardTitle>
                        <CardDescription>
                          {filteredPayments.length > 0
                            ? `${currentIndex + 1} of ${filteredPayments.length}`
                            : "—"}
                          {" · "}
                          {getDetailPanelDescription(selectedPayment)}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          disabled={currentIndex <= 0}
                          onClick={() =>
                            currentIndex > 0 && setSelectedPayment(filteredPayments[currentIndex - 1])
                          }
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          disabled={currentIndex >= filteredPayments.length - 1}
                          onClick={() =>
                            currentIndex < filteredPayments.length - 1 &&
                            setSelectedPayment(filteredPayments[currentIndex + 1])
                          }
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
                          <h3 className="font-semibold">{selectedPayment.senderName}</h3>
                          <p className="mt-1 text-2xl font-bold text-emerald-600">
                            ${selectedPayment.amount.toLocaleString()}
                          </p>
                        </div>
                        <div className="text-right text-sm">{formatDate(selectedPayment.date)}</div>
                      </div>
                      {(selectedPayment.importEmail || selectedPayment.importPhone) && (
                        <p className="mt-2 text-sm text-muted-foreground">
                          Import hints: {[selectedPayment.importEmail, selectedPayment.importPhone]
                            .filter(Boolean)
                            .join(" | ")}
                        </p>
                      )}
                      {selectedPayment.memo && (
                        <p className="mt-2 text-sm">
                          <span className="text-muted-foreground">Memo: </span>
                          {selectedPayment.memo}
                        </p>
                      )}
                    </div>

                    {selectedPayment.status === "pending_review" || selectedPayment.status === "unresolved" ? (
                      <>
                    <div className="mb-4">
                      <h4 className="mb-3 flex items-center gap-2 text-sm font-medium">
                        <Zap className="h-4 w-4 text-amber-500" />
                        Suggested matches
                      </h4>
                      {loadingMatches ? (
                        <p className="text-sm text-muted-foreground">Finding matches...</p>
                      ) : strongSuggestedMatches.length > 0 ? (
                        <div className="flex flex-col gap-3">
                          {strongSuggestedMatches.map((match, index) =>
                            renderMatchCard(match, index, "suggested")
                          )}
                        </div>
                      ) : (
                        <div className="rounded-lg border border-dashed p-4 text-center">
                          <AlertCircle className="mx-auto h-8 w-8 text-muted-foreground/50" />
                          <p className="mt-2 text-sm text-muted-foreground">
                            No high-confidence matches (≥85%). Search for the contact, add a new one,
                            or use Auto-match &amp; create contacts to process the queue in bulk.
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="mb-4 border-t pt-4">
                      <h4 className="mb-3 text-sm font-medium">Search contacts</h4>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Name, email, or phone"
                          value={manualSearch}
                          onChange={(event) => setManualSearch(event.target.value)}
                          onKeyDown={(event) => event.key === "Enter" && handleManualSearch()}
                        />
                        <Button variant="outline" onClick={handleManualSearch} disabled={searchingManual}>
                          Search
                        </Button>
                      </div>
                      {manualMatches.length > 0 && (
                        <div className="mt-3 flex flex-col gap-3">
                          {manualMatches.map((match, index) => renderMatchCard(match, index, "manual"))}
                        </div>
                      )}
                    </div>

                    <div className="border-t pt-4">
                      <div className="grid grid-cols-2 gap-2">
                        <Button variant="outline" onClick={() => setShowQuickAdd(true)}>
                          <UserPlus className="mr-1.5 h-4 w-4" />
                          Add new contact
                        </Button>
                        <Button
                          variant="outline"
                          className="text-red-600 hover:text-red-700"
                          onClick={handleMarkUnresolved}
                        >
                          <XCircle className="mr-1.5 h-4 w-4" />
                          Mark unresolved
                        </Button>
                      </div>
                    </div>
                      </>
                    ) : paymentMayLinkToPledge(selectedPayment) ? (
                      <div className="rounded-lg border border-dashed p-6 text-center">
                        <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
                        <p className="mt-3 text-sm font-medium">Gift already recorded</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Link to a pledge only if this payment should count toward an open pledge
                          balance.
                        </p>
                        <Button className="mt-4" onClick={() => void handleLinkExistingPaymentToPledge()}>
                          <DollarSign className="mr-1.5 h-4 w-4" />
                          Choose pledge
                        </Button>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-dashed p-6 text-center">
                        <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
                        <p className="mt-3 text-sm font-medium">No action required</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          This standalone donation is matched to a donor and does not need to be linked
                          to a pledge.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </>
              ) : (
                <CardContent className="flex flex-1 items-center justify-center py-16 text-sm text-muted-foreground">
                  Select a payment from the queue
                </CardContent>
              )}
            </Card>
          </div>
    </div>
  )

  return (
    <>
      {mode === "import" ? importView : matchView}

      {mode === "match" ? (
        <>
      <QuickAddContactDialog
        open={showQuickAdd}
        onOpenChange={setShowQuickAdd}
        searchHint={selectedPayment?.senderName || ""}
        onCreated={handleQuickAddCreated}
      />

      <Dialog open={showPledgeDialog} onOpenChange={setShowPledgeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apply to pledge</DialogTitle>
            <DialogDescription>
              {showingFallbackPledges
                ? "No open pledges for this donor. Showing all open pledges."
                : "Select a pledge for this payment."}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-80 space-y-2 overflow-auto">
            {pledgeOptionsToShow.map((pledge) => (
              <label
                key={pledge.id}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-lg border p-3",
                  selectedPledgeId === pledge.id && "border-primary bg-primary/5"
                )}
              >
                <input
                  type="radio"
                  name="pledge"
                  value={pledge.id}
                  checked={selectedPledgeId === pledge.id}
                  onChange={() => setSelectedPledgeId(pledge.id)}
                  className="mt-1"
                />
                <div>
                  <p className="font-medium">{pledge.donorName}</p>
                  <p className="text-sm text-muted-foreground">{pledge.campaign}</p>
                  <p className="text-sm">
                    Remaining: ${pledge.remainingAmount.toLocaleString()}
                  </p>
                </div>
              </label>
            ))}
            {pledgeOptionsToShow.length === 0 && (
              <p className="text-sm text-muted-foreground">No open pledges available.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPledgeDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleApplyPledgePayment} disabled={!selectedPledgeId || allocating}>
              {allocating ? "Applying..." : "Apply payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
        </>
      ) : null}
    </>
  )
}
