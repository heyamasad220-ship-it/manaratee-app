"use client"

import { useEffect, useState } from "react"
import {
  Heart,
  CreditCard,
  DollarSign,
  Calendar,
  Plus,
  CheckCircle2,
  Clock,
  RefreshCw,
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { loadCustomerDonationPortalData } from "@/lib/customer/customer-portal-data-actions"
import { ensureDonorExtensionForContact } from "@/lib/donations/donor-contact-bridge"
import {
  formatPaymentStatusLabel,
  formatPledgeStatusLabel,
  normalizePaymentStatus,
} from "@/lib/donations/donation-status"
import { normalizePaymentSourceChannel, isStripeCheckoutPaymentMethod } from "@/lib/donations/payment-source-channel"
import {
  createOneTimeDonationCheckoutAction,
  createRecurringDonationCheckoutAction,
  getDonationCheckoutStatusAction,
} from "@/lib/donations/stripe-donation-actions"
import {
  fetchPledgeAttribution,
  toPaymentAttributionColumns,
} from "@/lib/donations/payment-attribution"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

type Contact = {
  id: string
  full_name: string | null
  email: string | null
  organization_id: string
}

type DonationFund = {
  id: string
  name: string
  category_id: string
}

type DonationCategory = {
  id: string
  name: string
  funds: DonationFund[]
}

type DonationPledge = {
  id: string
  campaignId: string | null
  campaign: string
  totalAmount: number
  paidAmount: number
  balance: number
  frequency: string
  nextPaymentDate: string | null
  nextPaymentAmount: number
  startDate: string | null
  endDate: string | null
  status: string
}

type DonationCampaign = {
  id: string
  name: string
}

type DonationPayment = {
  id: string
  date: string
  amount: number
  campaign: string
  method: string
  status: string
}

type SavedPaymentMethod = {
  id: string
  name: string
  fee: string | null
}

function resolvePaymentCampaignLabel(
  payment: {
    campaign_id?: string | null
    category_id?: string | null
    subcategory_id?: string | null
    memo?: string | null
  },
  categories: DonationCategory[],
  campaignRows: Array<{ id: string; name: string }>
) {
  if (payment.campaign_id) {
    const campaign = campaignRows.find((row) => row.id === payment.campaign_id)
    if (campaign?.name) return campaign.name
  }

  if (payment.subcategory_id) {
    for (const category of categories) {
      const fund = category.funds.find((item) => item.id === payment.subcategory_id)
      if (fund?.name) return fund.name
    }
  }

  if (payment.category_id) {
    const category = categories.find((item) => item.id === payment.category_id)
    if (category?.name) return category.name
  }

  return payment.memo || "General Fund"
}

async function syncDonorAffiliationAfterDonation(input: {
  organizationId: string
  contactId: string
  donorId: string
  context: string
}) {
  try {
    const { handleDonationAffiliationSync } = await import(
      "@/lib/contacts/contact-affiliation-sync"
    )
    await handleDonationAffiliationSync({
      organizationId: input.organizationId,
      contactId: input.contactId,
      donorId: input.donorId,
    })
  } catch (syncError) {
    const message = syncError instanceof Error ? syncError.message : String(syncError)
    console.error(
      `[customer-donation] affiliation sync failed (${input.context}): ${message}`
    )
  }
}

export default function CustomerDonationsPage() {
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [contact, setContact] = useState<Contact | null>(null)
  const [donationCategories, setDonationCategories] = useState<DonationCategory[]>([])
  const [campaigns, setCampaigns] = useState<DonationCampaign[]>([])
  const [pledges, setPledges] = useState<DonationPledge[]>([])
  const [payments, setPayments] = useState<DonationPayment[]>([])
  const [savedPaymentMethods, setSavedPaymentMethods] = useState<SavedPaymentMethod[]>([])

  const [selectedPledge, setSelectedPledge] = useState<DonationPledge | null>(null)
  const [showPaymentDialog, setShowPaymentDialog] = useState(false)
  const [showNewPledgeDialog, setShowNewPledgeDialog] = useState(false)
  const [showOneTimeDonationDialog, setShowOneTimeDonationDialog] = useState(false)
  const [showRecurringDonationDialog, setShowRecurringDonationDialog] = useState(false)

  const [paymentAmount, setPaymentAmount] = useState("")
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [paymentSuccess, setPaymentSuccess] = useState(false)
  const [oneTimeDonationSuccess, setOneTimeDonationSuccess] = useState(false)
  const [recurringDonationSuccess, setRecurringDonationSuccess] = useState(false)
  const [checkoutSuccessAmount, setCheckoutSuccessAmount] = useState<number | null>(null)
  const [checkoutSuccessFrequency, setCheckoutSuccessFrequency] = useState<string | null>(null)
  const [formError, setFormError] = useState("")

  const [newPledgeForm, setNewPledgeForm] = useState({
    amount: "",
    frequency: "one-time",
    payments: "1",
    campaign: "",
    category: "",
    fund: "",
  })

  const [oneTimeDonationForm, setOneTimeDonationForm] = useState({
    amount: "",
    campaign: "",
    category: "",
    fund: "",
    paymentMethod: "",
  })

  const [recurringDonationForm, setRecurringDonationForm] = useState({
    amount: "",
    frequency: "monthly" as "monthly" | "quarterly" | "annually",
    campaign: "",
    category: "",
    fund: "",
  })

  useEffect(() => {
    async function loadDonationsPage() {
      setLoading(true)

      const result = await loadCustomerDonationPortalData()

      if (!result.ok || !result.contact) {
        setContact(null)
        setDonationCategories([])
        setPledges([])
        setPayments([])
        setSavedPaymentMethods([])
        setLoading(false)
        return
      }

      const contactData = result.contact
      setContact(contactData)

      const formattedCategories: DonationCategory[] = result.categories.map((category) => ({
        id: category.id,
        name: category.name,
        funds: category.funds,
      }))

      setDonationCategories(formattedCategories)
      setCampaigns(
        (result.campaigns || []).map((campaign) => ({
          id: campaign.id as string,
          name: campaign.name as string,
        }))
      )

      const formattedPaymentMethods: SavedPaymentMethod[] = result.paymentMethods.map(
        (method) => ({
          id: method.id as string,
          name: (method.name as string) || "Payment Method",
          fee: method.fee != null ? String(method.fee) : null,
        })
      )

      setSavedPaymentMethods(formattedPaymentMethods)
      setSelectedPaymentMethod(formattedPaymentMethods[0]?.id || "")

      const formattedPledges: DonationPledge[] = (result.pledges || []).map((p) => ({
        id: p.id as string,
        campaignId: (p.campaign_id as string | null) ?? null,
        campaign: (p.campaign_name as string) || "General Fund",
        totalAmount: Number(p.amount_pledged || 0),
        paidAmount: Number(p.amount_paid || 0),
        balance: Number(p.balance_remaining ?? 0),
        frequency: (p.frequency as string) || "one-time",
        nextPaymentDate: null,
        nextPaymentAmount: 0,
        startDate: (p.pledge_date as string | null) || null,
        endDate: null,
        status: formatPledgeStatusLabel(p.calculated_status as string | null),
      }))

      const formattedPayments: DonationPayment[] = (result.payments || []).map((p) => ({
        id: p.id as string,
        date: (p.payment_date as string) || "",
        amount: Number(p.amount || 0),
        campaign: resolvePaymentCampaignLabel(p, formattedCategories, result.campaigns || []),
        method: (p.source as string) || "Unknown",
        status: formatPaymentStatusLabel(p.status as string | null),
      }))

      setPledges(formattedPledges)
      setPayments(formattedPayments)
      setLoading(false)
    }

    loadDonationsPage()
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return

    const params = new URLSearchParams(window.location.search)
    const checkoutState = params.get("checkout")
    const checkoutType = params.get("type")
    const stripeSessionId = params.get("session_id")

    if (checkoutState === "cancelled") {
      setFormError("Online payment was cancelled. You can try again or choose an offline method.")
      if (checkoutType === "recurring") {
        setShowRecurringDonationDialog(true)
      } else {
        setShowOneTimeDonationDialog(true)
      }
      window.history.replaceState({}, "", "/customer/donation")
      return
    }

    if (checkoutState !== "success" || !stripeSessionId) return

    async function confirmCheckoutSuccess() {
      const result = await getDonationCheckoutStatusAction(stripeSessionId!)
      if (!result.success) {
        setFormError(result.error || "Could not confirm your payment yet. Please check back shortly.")
        return
      }

      if (result.checkoutType === "recurring_setup") {
        if (result.status === "complete" && result.recurringPlan?.status === "active") {
          setCheckoutSuccessAmount(result.amount)
          setCheckoutSuccessFrequency(result.recurringPlan.frequency)
          setRecurringDonationSuccess(true)
          setShowRecurringDonationDialog(true)
        } else if (result.status === "complete") {
          setCheckoutSuccessAmount(result.amount)
          setCheckoutSuccessFrequency(result.recurringPlan?.frequency ?? null)
          setRecurringDonationSuccess(true)
          setShowRecurringDonationDialog(true)
          setFormError(
            "Your recurring gift is set up. The first charge may take a moment to appear in your history."
          )
        } else {
          setFormError(
            "Your recurring setup is still processing. Refresh this page in a moment."
          )
        }
        window.history.replaceState({}, "", "/customer/donation")
        return
      }

      if (result.status === "complete" && result.payment) {
        setCheckoutSuccessAmount(result.amount)
        setOneTimeDonationSuccess(true)
        setShowOneTimeDonationDialog(true)
        await loadCustomerDonationPortalData().then((portalResult) => {
          if (!portalResult.ok || !portalResult.contact) return
          const formattedPayments: DonationPayment[] = (portalResult.payments || []).map((p) => ({
            id: p.id as string,
            date: (p.payment_date as string) || "",
            amount: Number(p.amount || 0),
            campaign: resolvePaymentCampaignLabel(
              p,
              portalResult.categories.map((category) => ({
                id: category.id,
                name: category.name,
                funds: category.funds,
              })),
              portalResult.campaigns || []
            ),
            method: (p.source as string) || "Unknown",
            status: formatPaymentStatusLabel(p.status as string | null),
          }))
          setPayments(formattedPayments)
        })
      } else {
        setFormError(
          "Your payment is still processing. Refresh this page in a moment if it does not appear."
        )
      }

      window.history.replaceState({}, "", "/customer/donation")
    }

    confirmCheckoutSuccess()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const getSelectedFundName = (categoryId: string, fundId: string) => {
    const category = donationCategories.find((cat) => cat.id === categoryId)
    const fund = category?.funds.find((f) => f.id === fundId)
    return fund?.name || category?.name || "General Fund"
  }

  const getSelectedPaymentMethodName = (paymentMethodId: string) => {
    const method = savedPaymentMethods.find((item) => item.id === paymentMethodId)
    return method?.name || "Unknown"
  }

  const totalPledged = pledges.reduce((sum, pledge) => sum + Number(pledge.totalAmount || 0), 0)
  const totalPaid = payments
    .filter((payment) => normalizePaymentStatus(payment.status) !== "voided")
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
  const outstandingBalance = pledges.reduce((sum, pledge) => sum + Number(pledge.balance || 0), 0)
  const activePledges = pledges.filter(
    (p) => formatPledgeStatusLabel(p.status) !== "Fulfilled" && p.status !== "Cancelled"
  )
  const upcomingPaymentTotal = activePledges.reduce(
    (sum, p) => sum + Number(p.nextPaymentAmount || 0),
    0
  )
  const nextPaymentDate =
    activePledges.find((pledge) => pledge.nextPaymentDate)?.nextPaymentDate || "—"

  const handlePayPledge = (pledge: DonationPledge) => {
    setSelectedPledge(pledge)
    setPaymentAmount(String(pledge.nextPaymentAmount || pledge.balance || ""))
    setSelectedPaymentMethod(savedPaymentMethods[0]?.id || "")
    setShowPaymentDialog(true)
    setPaymentSuccess(false)
    setFormError("")
  }

  const handleOpenOneTimeDonation = () => {
    setOneTimeDonationForm({
      amount: "",
      campaign: "",
      category: "",
      fund: "",
      paymentMethod: savedPaymentMethods[0]?.id || "",
    })
    setOneTimeDonationSuccess(false)
    setFormError("")
    setShowOneTimeDonationDialog(true)
  }

  const handleOpenRecurringDonation = () => {
    setRecurringDonationForm({
      amount: "",
      frequency: "monthly",
      campaign: "",
      category: "",
      fund: "",
    })
    setRecurringDonationSuccess(false)
    setFormError("")
    setShowRecurringDonationDialog(true)
  }

  const processRecurringDonation = async () => {
    if (!contact) return

    setIsProcessing(true)
    setFormError("")

    const hasStripeMethod = savedPaymentMethods.some((method) =>
      isStripeCheckoutPaymentMethod(method.name)
    )

    if (!hasStripeMethod) {
      setFormError("Online card payments are not available for recurring gifts yet.")
      setIsProcessing(false)
      return
    }

    const result = await createRecurringDonationCheckoutAction({
      amount: Number(recurringDonationForm.amount || 0),
      frequency: recurringDonationForm.frequency,
      campaignId: recurringDonationForm.campaign || null,
      categoryId: recurringDonationForm.category || null,
      subcategoryId: recurringDonationForm.fund || null,
    })

    if (!result.success || !result.checkoutUrl) {
      setFormError(result.error || "Could not start recurring checkout. Please try again.")
      setIsProcessing(false)
      return
    }

    window.location.href = result.checkoutUrl
  }

  const handleOpenNewPledge = () => {
    setNewPledgeForm({
      amount: "",
      frequency: "one-time",
      payments: "1",
      campaign: "",
      category: "",
      fund: "",
    })
    setFormError("")
    setShowNewPledgeDialog(true)
  }

  const processPayment = async () => {
    if (!contact || !selectedPledge) return

    setIsProcessing(true)
    setFormError("")

    const paymentMethodName = getSelectedPaymentMethodName(selectedPaymentMethod)

    const donorId = await ensureDonorExtensionForContact(
      contact.organization_id,
      contact.id
    )

    if (!donorId) {
      setFormError("Could not resolve your donor profile. Please try again.")
      setIsProcessing(false)
      return
    }

    const paymentDate = new Date().toISOString().split("T")[0]
    const pledgeAttribution = await fetchPledgeAttribution(supabase, selectedPledge.id)

    const { data, error } = await supabase
      .from("payments")
      .insert({
        organization_id: contact.organization_id,
        contact_id: contact.id,
        donor_id: donorId,
        pledge_id: selectedPledge.id,
        sender_name: contact.full_name || contact.email || null,
        amount: Number(paymentAmount || 0),
        payment_date: `${paymentDate}T12:00:00`,
        source: normalizePaymentSourceChannel(paymentMethodName),
        source_type: "portal",
        status: "unallocated",
        is_verified: false,
        ...toPaymentAttributionColumns(pledgeAttribution),
      })
      .select("id, amount, payment_date, source, status, memo")
      .single()

    if (error) {
      setFormError("Payment could not be saved. Please try again.")
      setIsProcessing(false)
      return
    }

    await syncDonorAffiliationAfterDonation({
      organizationId: contact.organization_id,
      contactId: contact.id,
      donorId,
      context: "portal pledge payment",
    })

    setPayments((currentPayments) => [
      {
        id: data.id,
        date: data.payment_date || "",
        amount: Number(data.amount || 0),
        campaign: selectedPledge.campaign,
        method: paymentMethodName,
        status: formatPaymentStatusLabel(data.status),
      },
      ...currentPayments,
    ])

    setIsProcessing(false)
    setPaymentSuccess(true)
  }

  const processOneTimeDonation = async () => {
    if (!contact) return

    setIsProcessing(true)
    setFormError("")

    const paymentMethodName = getSelectedPaymentMethodName(oneTimeDonationForm.paymentMethod)

    const donorId = await ensureDonorExtensionForContact(
      contact.organization_id,
      contact.id
    )

    if (!donorId) {
      setFormError("Could not resolve your donor profile. Please try again.")
      setIsProcessing(false)
      return
    }

    if (isStripeCheckoutPaymentMethod(paymentMethodName)) {
      const result = await createOneTimeDonationCheckoutAction({
        amount: Number(oneTimeDonationForm.amount || 0),
        campaignId: oneTimeDonationForm.campaign || null,
        categoryId: oneTimeDonationForm.category || null,
        subcategoryId: oneTimeDonationForm.fund || null,
      })

      if (!result.success || !result.checkoutUrl) {
        setFormError(result.error || "Could not start online checkout. Please try again.")
        setIsProcessing(false)
        return
      }

      window.location.href = result.checkoutUrl
      return
    }

    const selectedFundName = getSelectedFundName(
      oneTimeDonationForm.category,
      oneTimeDonationForm.fund
    )

    const paymentDate = new Date().toISOString().split("T")[0]

    const { data, error } = await supabase
      .from("payments")
      .insert({
        organization_id: contact.organization_id,
        contact_id: contact.id,
        donor_id: donorId,
        pledge_id: null,
        sender_name: contact.full_name || contact.email || null,
        amount: Number(oneTimeDonationForm.amount || 0),
        payment_date: `${paymentDate}T12:00:00`,
        source: normalizePaymentSourceChannel(paymentMethodName),
        source_type: "portal",
        status: "unallocated",
        is_verified: false,
        campaign_id: oneTimeDonationForm.campaign || null,
        category_id: oneTimeDonationForm.category || null,
        subcategory_id: oneTimeDonationForm.fund || null,
        memo: `Offline donation recorded (${paymentMethodName})`,
      })
      .select("id, amount, payment_date, source, status, memo")
      .single()

    if (error) {
      setFormError("Donation could not be saved. Please try again.")
      setIsProcessing(false)
      return
    }

    await syncDonorAffiliationAfterDonation({
      organizationId: contact.organization_id,
      contactId: contact.id,
      donorId,
      context: "portal offline one-time donation",
    })

    setPayments((currentPayments) => [
      {
        id: data.id,
        date: data.payment_date || "",
        amount: Number(data.amount || 0),
        campaign:
          getSelectedFundName(oneTimeDonationForm.category, oneTimeDonationForm.fund) ||
          campaigns.find((c) => c.id === oneTimeDonationForm.campaign)?.name ||
          "General Fund",
        method: paymentMethodName,
        status: formatPaymentStatusLabel(data.status),
      },
      ...currentPayments,
    ])

    setIsProcessing(false)
    setCheckoutSuccessAmount(null)
    setOneTimeDonationSuccess(true)
  }

  const createPledge = async () => {
    if (!contact) return

    setIsProcessing(true)
    setFormError("")

    const selectedFundName = getSelectedFundName(newPledgeForm.category, newPledgeForm.fund)
    const numberOfPayments =
      newPledgeForm.frequency === "one-time" ? 1 : Number(newPledgeForm.payments || 1)
    const totalAmount = Number(newPledgeForm.amount || 0) * numberOfPayments
    const pledgeDate = new Date().toISOString().split("T")[0]

    const donorId = await ensureDonorExtensionForContact(
      contact.organization_id,
      contact.id
    )

    if (!donorId) {
      setFormError("Could not resolve your donor profile. Please try again.")
      setIsProcessing(false)
      return
    }

    const pledgePayload = {
      organization_id: contact.organization_id,
      donor_id: donorId,
      campaign_id: newPledgeForm.campaign || null,
      category_id: newPledgeForm.category || null,
      subcategory_id: newPledgeForm.fund || null,
      amount_pledged: totalAmount,
      pledge_date: pledgeDate,
      pledge_type: newPledgeForm.frequency.toLowerCase().replace("-", "_"),
      frequency: newPledgeForm.frequency.toLowerCase().replace("-", "_"),
      status: "open",
      notes: null,
    }

    const { data, error } = await supabase
      .from("pledges")
      .insert(pledgePayload)
      .select("id")
      .single()

    if (error) {
      setFormError(error.message || "Pledge could not be saved. Please try again.")
      setIsProcessing(false)
      return
    }

    await syncDonorAffiliationAfterDonation({
      organizationId: contact.organization_id,
      contactId: contact.id,
      donorId,
      context: "portal pledge creation",
    })

    const { data: pledgeView } = await supabase
      .from("pledge_status_view")
      .select(
        "id, campaign_name, amount_pledged, amount_paid, balance_remaining, calculated_status, frequency, pledge_date"
      )
      .eq("id", data.id)
      .maybeSingle()

    const viewRow = pledgeView || {
      id: data.id,
      campaign_name: selectedFundName,
      amount_pledged: totalAmount,
      amount_paid: 0,
      balance_remaining: totalAmount,
      calculated_status: "open",
      frequency: newPledgeForm.frequency,
      pledge_date: pledgeDate,
    }

    setPledges((currentPledges) => [
      {
        id: viewRow.id as string,
        campaignId: newPledgeForm.campaign || null,
        campaign: (viewRow.campaign_name as string) || selectedFundName || "General Fund",
        totalAmount: Number(viewRow.amount_pledged || totalAmount),
        paidAmount: Number(viewRow.amount_paid || 0),
        balance: Number(viewRow.balance_remaining ?? totalAmount),
        frequency: (viewRow.frequency as string) || newPledgeForm.frequency,
        nextPaymentDate: null,
        nextPaymentAmount: 0,
        startDate: (viewRow.pledge_date as string | null) || pledgeDate,
        endDate: null,
        status: formatPledgeStatusLabel(viewRow.calculated_status as string | null),
      },
      ...currentPledges,
    ])

    setIsProcessing(false)
    setShowNewPledgeDialog(false)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Active":
        return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">Active</Badge>
      case "Fulfilled":
        return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Fulfilled</Badge>
      case "Completed":
        return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Completed</Badge>
      case "Pending":
        return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Pending</Badge>
      case "Unallocated":
        return <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100">Unallocated</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">My Donations</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          View your pledges, payments, and manage your donations.
        </p>
      </div>

      <div className="flex flex-wrap gap-4 [&>*]:w-fit">
        <Card className="border-l-4 border-l-primary">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Pledged</p>
                <p className="text-2xl font-bold text-foreground">
                  {loading ? "—" : formatCurrency(totalPledged)}
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Heart className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Paid</p>
                <p className="text-2xl font-bold text-emerald-600">
                  {loading ? "—" : formatCurrency(totalPaid)}
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Outstanding Balance</p>
                <p className="text-2xl font-bold text-amber-600">
                  {loading ? "—" : formatCurrency(outstandingBalance)}
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
                <DollarSign className="h-5 w-5 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-violet-500">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Next Payment Due</p>
                <p className="text-2xl font-bold text-violet-600">
                  {loading ? "—" : formatCurrency(upcomingPaymentTotal)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{nextPaymentDate}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100">
                <Calendar className="h-5 w-5 text-violet-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {activePledges.length > 0 && (
        <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10">
          <CardContent className="p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-semibold text-foreground">Pay All Upcoming Payments</h3>
                <p className="text-sm text-muted-foreground">
                  Pay {formatCurrency(upcomingPaymentTotal)} for all {activePledges.length} active pledges at once
                </p>
              </div>
              <Button size="lg" className="gap-2">
                <CreditCard className="h-4 w-4" />
                Pay {formatCurrency(upcomingPaymentTotal)}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="pledges" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="pledges">My Pledges</TabsTrigger>
          <TabsTrigger value="payments">Payment History</TabsTrigger>
        </TabsList>

        <TabsContent value="pledges" className="mt-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-lg font-semibold text-foreground">Your Pledges</h2>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button size="sm" onClick={handleOpenOneTimeDonation}>
                  <Heart className="mr-1 h-4 w-4" />
                  One-Time Donation
                </Button>
                <Button variant="secondary" size="sm" onClick={handleOpenRecurringDonation}>
                  <RefreshCw className="mr-1 h-4 w-4" />
                  Recurring Donation
                </Button>
                <Button variant="outline" size="sm" onClick={handleOpenNewPledge}>
                  <Plus className="mr-1 h-4 w-4" />
                  New Pledge
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              {loading ? (
                <Card>
                  <CardContent className="p-6 text-sm text-muted-foreground">
                    Loading donations...
                  </CardContent>
                </Card>
              ) : pledges.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center gap-3 p-8 text-center">
                    <Heart className="h-10 w-10 text-muted-foreground/50" />
                    <div>
                      <p className="text-sm font-medium text-foreground">No pledges yet</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Create a pledge or make a one-time donation when you are ready to support a fund.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                pledges.map((pledge) => (
                  <Card key={pledge.id} className="overflow-hidden">
                    <CardContent className="p-0">
                      <div className="flex flex-col lg:flex-row">
                        <div className="flex-1 p-5">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold text-foreground">{pledge.campaign}</h3>
                                {getStatusBadge(pledge.status)}
                              </div>
                              <p className="mt-1 text-sm text-muted-foreground">
                                {pledge.frequency} pledge
                              </p>
                            </div>
                          </div>

                          <div className="mt-4">
                            <div className="mb-2 flex justify-between text-sm">
                              <span className="text-muted-foreground">Progress</span>
                              <span className="font-medium">
                                {formatCurrency(pledge.paidAmount)} of {formatCurrency(pledge.totalAmount)}
                              </span>
                            </div>
                            <Progress
                              value={pledge.totalAmount > 0 ? (pledge.paidAmount / pledge.totalAmount) * 100 : 0}
                              className="h-2"
                            />
                            <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                              <span>
                                {pledge.totalAmount > 0
                                  ? Math.round((pledge.paidAmount / pledge.totalAmount) * 100)
                                  : 0}
                                % complete
                              </span>
                              <span>{formatCurrency(pledge.balance)} remaining</span>
                            </div>
                          </div>
                        </div>

                        {pledge.status === "Active" && (
                          <div className="flex flex-col justify-center gap-3 border-t border-border bg-muted/30 p-5 lg:w-64 lg:border-l lg:border-t-0">
                            <div className="text-center lg:text-left">
                              <p className="text-xs text-muted-foreground">Next Payment</p>
                              <p className="text-lg font-bold text-foreground">
                                {formatCurrency(pledge.nextPaymentAmount)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Due {pledge.nextPaymentDate || "—"}
                              </p>
                            </div>
                            <Button
                              className="w-full gap-2"
                              onClick={() => handlePayPledge(pledge)}
                            >
                              <CreditCard className="h-4 w-4" />
                              Pay Now
                            </Button>
                          </div>
                        )}

                        {pledge.status === "Fulfilled" && (
                          <div className="flex flex-col items-center justify-center gap-2 border-t border-border bg-emerald-50 p-5 lg:w-64 lg:border-l lg:border-t-0">
                            <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                            <p className="text-sm font-medium text-emerald-700">Fully Paid</p>
                            <p className="text-xs text-emerald-600">Thank you!</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="payments" className="mt-6">
          <div className="flex flex-col gap-4">
            <h2 className="text-lg font-semibold text-foreground">Payment History</h2>

            <Card>
              <CardContent className="p-0">
                {loading ? (
                  <div className="p-6 text-sm text-muted-foreground">Loading payment history...</div>
                ) : payments.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
                    <CreditCard className="h-10 w-10 text-muted-foreground/50" />
                    <div>
                      <p className="text-sm font-medium text-foreground">No payments yet</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Your completed donation payments will appear here.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {payments.map((payment) => (
                      <div key={payment.id} className="flex items-center justify-between p-4 hover:bg-muted/50">
                        <div className="flex items-center gap-4">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
                            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{payment.campaign}</p>
                            <p className="text-sm text-muted-foreground">{payment.date}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="font-semibold text-foreground">{formatCurrency(payment.amount)}</p>
                            <p className="text-xs text-muted-foreground">{payment.method}</p>
                          </div>
                          {getStatusBadge(payment.status)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* One-Time Donation Dialog */}
      <Dialog open={showOneTimeDonationDialog} onOpenChange={setShowOneTimeDonationDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {oneTimeDonationSuccess ? "Donation Successful" : "Make a One-Time Donation"}
            </DialogTitle>
            <DialogDescription>
              {oneTimeDonationSuccess
                ? "Thank you for your contribution!"
                : "Choose an amount, fund, and payment method for your one-time donation."}
            </DialogDescription>
          </DialogHeader>

          {oneTimeDonationSuccess ? (
            <div className="flex flex-col items-center gap-4 py-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                <CheckCircle2 className="h-8 w-8 text-emerald-600" />
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-foreground">
                  {formatCurrency(
                    checkoutSuccessAmount ?? Number(oneTimeDonationForm.amount || 0)
                  )}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {checkoutSuccessAmount != null
                    ? "Online payment received — thank you!"
                    : "Offline donation recorded — staff will reconcile if needed"}
                </p>
              </div>
              <Button className="mt-4 w-full" onClick={() => setShowOneTimeDonationDialog(false)}>
                Done
              </Button>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-4 py-4">
                <div className="flex flex-col gap-2">
                  <Label>Donation Amount</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      $
                    </span>
                    <Input
                      type="number"
                      value={oneTimeDonationForm.amount}
                      onChange={(e) =>
                        setOneTimeDonationForm({
                          ...oneTimeDonationForm,
                          amount: e.target.value,
                        })
                      }
                      className="pl-7"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                {campaigns.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    <Label>Campaign (optional)</Label>
                    <Select
                      value={oneTimeDonationForm.campaign || "none"}
                      onValueChange={(v) =>
                        setOneTimeDonationForm({
                          ...oneTimeDonationForm,
                          campaign: v === "none" ? "" : v,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select campaign" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No campaign</SelectItem>
                        {campaigns.map((campaign) => (
                          <SelectItem key={campaign.id} value={campaign.id}>
                            {campaign.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}

                <div className="flex flex-col gap-2">
                  <Label>Donation Category</Label>
                  <Select
                    value={oneTimeDonationForm.category}
                    onValueChange={(v) =>
                      setOneTimeDonationForm({
                        ...oneTimeDonationForm,
                        category: v,
                        fund: "",
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {donationCategories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {oneTimeDonationForm.category && (
                  <div className="flex flex-col gap-2">
                    <Label>Specific Fund</Label>
                    <Select
                      value={oneTimeDonationForm.fund}
                      onValueChange={(v) =>
                        setOneTimeDonationForm({
                          ...oneTimeDonationForm,
                          fund: v,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select fund" />
                      </SelectTrigger>
                      <SelectContent>
                        {donationCategories
                          .find((c) => c.id === oneTimeDonationForm.category)
                          ?.funds.map((fund) => (
                            <SelectItem key={fund.id} value={fund.id}>
                              {fund.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  <Label>Payment Method</Label>
                  {savedPaymentMethods.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                      No payment methods are available yet.
                    </div>
                  ) : (
                    <RadioGroup
                      value={oneTimeDonationForm.paymentMethod}
                      onValueChange={(v) =>
                        setOneTimeDonationForm({
                          ...oneTimeDonationForm,
                          paymentMethod: v,
                        })
                      }
                      className="flex flex-col gap-2"
                    >
                      {savedPaymentMethods.map((method) => {
                        const isOnline = isStripeCheckoutPaymentMethod(method.name)
                        return (
                          <div key={method.id} className="flex items-center gap-3 rounded-lg border p-3">
                            <RadioGroupItem value={method.id} id={`one-time-${method.id}`} />
                            <Label htmlFor={`one-time-${method.id}`} className="flex-1 cursor-pointer">
                              <div className="flex items-center justify-between gap-2">
                                <span>{method.name}</span>
                                <div className="flex items-center gap-2">
                                  <Badge variant={isOnline ? "default" : "outline"} className="text-xs">
                                    {isOnline ? "Pay online" : "Record offline"}
                                  </Badge>
                                  {method.fee && (
                                    <Badge variant="secondary" className="text-xs">
                                      {method.fee}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </Label>
                          </div>
                        )
                      })}
                    </RadioGroup>
                  )}

                  <Button variant="ghost" size="sm" className="w-fit text-primary">
                    <Plus className="mr-1 h-4 w-4" />
                    Add new card
                  </Button>
                </div>

                {formError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    {formError}
                  </div>
                )}

                {oneTimeDonationForm.amount && (
                  <div className="rounded-lg bg-muted/50 p-4">
                    <p className="text-sm font-medium text-foreground">Donation Summary</p>
                    <div className="mt-2 flex justify-between text-sm">
                      <span className="text-muted-foreground">One-Time Donation:</span>
                      <span className="font-bold text-foreground">
                        {formatCurrency(Number(oneTimeDonationForm.amount))}
                      </span>
                    </div>
                    {oneTimeDonationForm.category && (
                      <div className="mt-1 flex justify-between text-sm">
                        <span className="text-muted-foreground">Fund:</span>
                        <span className="font-medium text-foreground">
                          {getSelectedFundName(
                            oneTimeDonationForm.category,
                            oneTimeDonationForm.fund
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowOneTimeDonationDialog(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={processOneTimeDonation}
                  disabled={
                    !oneTimeDonationForm.amount ||
                    !oneTimeDonationForm.category ||
                    !oneTimeDonationForm.fund ||
                    !oneTimeDonationForm.paymentMethod ||
                    isProcessing
                  }
                  className="gap-2"
                >
                  {isProcessing ? (
                    <>
                      <Clock className="h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : isStripeCheckoutPaymentMethod(
                      getSelectedPaymentMethodName(oneTimeDonationForm.paymentMethod)
                    ) ? (
                    <>
                      <CreditCard className="h-4 w-4" />
                      Pay {formatCurrency(Number(oneTimeDonationForm.amount) || 0)} online
                    </>
                  ) : (
                    <>
                      <DollarSign className="h-4 w-4" />
                      Record {formatCurrency(Number(oneTimeDonationForm.amount) || 0)} offline
                    </>
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Recurring Donation Dialog */}
      <Dialog open={showRecurringDonationDialog} onOpenChange={setShowRecurringDonationDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {recurringDonationSuccess
                ? "Recurring Gift Started"
                : "Set Up a Recurring Donation"}
            </DialogTitle>
            <DialogDescription>
              {recurringDonationSuccess
                ? "Thank you for your ongoing support!"
                : "Choose an amount and frequency. You will complete card setup securely on Stripe."}
            </DialogDescription>
          </DialogHeader>

          {recurringDonationSuccess ? (
            <div className="flex flex-col items-center gap-4 py-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                <CheckCircle2 className="h-8 w-8 text-emerald-600" />
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-foreground">
                  {formatCurrency(checkoutSuccessAmount ?? Number(recurringDonationForm.amount || 0))}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {checkoutSuccessFrequency
                    ? `${checkoutSuccessFrequency.charAt(0).toUpperCase()}${checkoutSuccessFrequency.slice(1)} recurring gift — card on file with Stripe`
                    : "Recurring gift set up with Stripe"}
                </p>
              </div>
              <Button className="mt-4 w-full" onClick={() => setShowRecurringDonationDialog(false)}>
                Done
              </Button>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-4 py-4">
                <div className="flex flex-col gap-2">
                  <Label>Donation Amount</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      $
                    </span>
                    <Input
                      type="number"
                      value={recurringDonationForm.amount}
                      onChange={(e) =>
                        setRecurringDonationForm({
                          ...recurringDonationForm,
                          amount: e.target.value,
                        })
                      }
                      className="pl-7"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <Label>Frequency</Label>
                  <Select
                    value={recurringDonationForm.frequency}
                    onValueChange={(v) =>
                      setRecurringDonationForm({
                        ...recurringDonationForm,
                        frequency: v as "monthly" | "quarterly" | "annually",
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                      <SelectItem value="annually">Annually</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {campaigns.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    <Label>Campaign (optional)</Label>
                    <Select
                      value={recurringDonationForm.campaign || "none"}
                      onValueChange={(v) =>
                        setRecurringDonationForm({
                          ...recurringDonationForm,
                          campaign: v === "none" ? "" : v,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select campaign" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No campaign</SelectItem>
                        {campaigns.map((campaign) => (
                          <SelectItem key={campaign.id} value={campaign.id}>
                            {campaign.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}

                <div className="flex flex-col gap-2">
                  <Label>Donation Category</Label>
                  <Select
                    value={recurringDonationForm.category}
                    onValueChange={(v) =>
                      setRecurringDonationForm({
                        ...recurringDonationForm,
                        category: v,
                        fund: "",
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {donationCategories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {recurringDonationForm.category && (
                  <div className="flex flex-col gap-2">
                    <Label>Specific Fund</Label>
                    <Select
                      value={recurringDonationForm.fund}
                      onValueChange={(v) =>
                        setRecurringDonationForm({
                          ...recurringDonationForm,
                          fund: v,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select fund" />
                      </SelectTrigger>
                      <SelectContent>
                        {donationCategories
                          .find((c) => c.id === recurringDonationForm.category)
                          ?.funds.map((fund) => (
                            <SelectItem key={fund.id} value={fund.id}>
                              {fund.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
                  Payment method: <span className="font-medium text-foreground">Credit card via Stripe</span>
                </div>

                {formError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    {formError}
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowRecurringDonationDialog(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={processRecurringDonation}
                  disabled={
                    !recurringDonationForm.amount ||
                    !recurringDonationForm.category ||
                    !recurringDonationForm.fund ||
                    isProcessing
                  }
                  className="gap-2"
                >
                  {isProcessing ? (
                    <>
                      <Clock className="h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <CreditCard className="h-4 w-4" />
                      Continue to Stripe
                    </>
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {paymentSuccess ? "Payment Successful" : "Make a Payment"}
            </DialogTitle>
            <DialogDescription>
              {paymentSuccess
                ? "Thank you for your contribution!"
                : selectedPledge?.campaign}
            </DialogDescription>
          </DialogHeader>

          {paymentSuccess ? (
            <div className="flex flex-col items-center gap-4 py-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                <CheckCircle2 className="h-8 w-8 text-emerald-600" />
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-foreground">
                  {formatCurrency(Number(paymentAmount))}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Payment saved as unallocated
                </p>
              </div>
              <Button className="mt-4 w-full" onClick={() => setShowPaymentDialog(false)}>
                Done
              </Button>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-4 py-4">
                <div className="flex flex-col gap-2">
                  <Label>Payment Amount</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      $
                    </span>
                    <Input
                      type="number"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      className="pl-7"
                      placeholder="0.00"
                    />
                  </div>
                  {selectedPledge && (
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setPaymentAmount(String(selectedPledge.nextPaymentAmount))}
                      >
                        Next Due ({formatCurrency(selectedPledge.nextPaymentAmount)})
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setPaymentAmount(String(selectedPledge.balance))}
                      >
                        Full Balance ({formatCurrency(selectedPledge.balance)})
                      </Button>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <Label>Payment Method</Label>
                  {savedPaymentMethods.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                      No payment methods are available yet.
                    </div>
                  ) : (
                    <RadioGroup
                      value={selectedPaymentMethod}
                      onValueChange={setSelectedPaymentMethod}
                      className="flex flex-col gap-2"
                    >
                      {savedPaymentMethods.map((method) => (
                        <div key={method.id} className="flex items-center gap-3 rounded-lg border p-3">
                          <RadioGroupItem value={method.id} id={method.id} />
                          <Label htmlFor={method.id} className="flex-1 cursor-pointer">
                            <div className="flex items-center justify-between">
                              <span>{method.name}</span>
                              {method.fee && (
                                <Badge variant="secondary" className="text-xs">
                                  {method.fee}
                                </Badge>
                              )}
                            </div>
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  )}
                  <Button variant="ghost" size="sm" className="w-fit text-primary">
                    <Plus className="mr-1 h-4 w-4" />
                    Add new card
                  </Button>
                </div>

                {formError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    {formError}
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowPaymentDialog(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={processPayment}
                  disabled={!paymentAmount || !selectedPaymentMethod || isProcessing}
                  className="gap-2"
                >
                  {isProcessing ? (
                    <>
                      <Clock className="h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <CreditCard className="h-4 w-4" />
                      Pay {formatCurrency(Number(paymentAmount) || 0)}
                    </>
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* New Pledge Dialog */}
      <Dialog open={showNewPledgeDialog} onOpenChange={setShowNewPledgeDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Make a New Pledge</DialogTitle>
            <DialogDescription>
              Set up a new pledge to support our community.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label>Amount per Payment</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  $
                </span>
                <Input
                  type="number"
                  value={newPledgeForm.amount}
                  onChange={(e) => setNewPledgeForm({ ...newPledgeForm, amount: e.target.value })}
                  className="pl-7"
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Frequency</Label>
              <Select
                value={newPledgeForm.frequency}
                onValueChange={(v) => setNewPledgeForm({ ...newPledgeForm, frequency: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="one-time">One-time</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="annual">Annual</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {newPledgeForm.frequency !== "one-time" && (
              <div className="flex flex-col gap-2">
                <Label>Number of Payments</Label>
                <Select
                  value={newPledgeForm.payments}
                  onValueChange={(v) => setNewPledgeForm({ ...newPledgeForm, payments: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">3 payments</SelectItem>
                    <SelectItem value="6">6 payments</SelectItem>
                    <SelectItem value="12">12 payments</SelectItem>
                    <SelectItem value="24">24 payments</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {campaigns.length > 0 ? (
              <div className="flex flex-col gap-2">
                <Label>Campaign (optional)</Label>
                <Select
                  value={newPledgeForm.campaign || "none"}
                  onValueChange={(v) =>
                    setNewPledgeForm({
                      ...newPledgeForm,
                      campaign: v === "none" ? "" : v,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select campaign" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No campaign</SelectItem>
                    {campaigns.map((campaign) => (
                      <SelectItem key={campaign.id} value={campaign.id}>
                        {campaign.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            <div className="flex flex-col gap-2">
              <Label>Donation Category</Label>
              <Select
                value={newPledgeForm.category}
                onValueChange={(v) =>
                  setNewPledgeForm({ ...newPledgeForm, category: v, fund: "" })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {donationCategories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {newPledgeForm.category && (
              <div className="flex flex-col gap-2">
                <Label>Specific Fund</Label>
                <Select
                  value={newPledgeForm.fund}
                  onValueChange={(v) => setNewPledgeForm({ ...newPledgeForm, fund: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select fund" />
                  </SelectTrigger>
                  <SelectContent>
                    {donationCategories
                      .find((c) => c.id === newPledgeForm.category)
                      ?.funds.map((fund) => (
                        <SelectItem key={fund.id} value={fund.id}>
                          {fund.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {formError && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {formError}
              </div>
            )}

            {newPledgeForm.amount && (
              <div className="rounded-lg bg-muted/50 p-4">
                <p className="text-sm font-medium text-foreground">Pledge Summary</p>
                <div className="mt-2 flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Pledge:</span>
                  <span className="font-bold text-foreground">
                    {formatCurrency(
                      Number(newPledgeForm.amount) *
                        (newPledgeForm.frequency === "one-time"
                          ? 1
                          : Number(newPledgeForm.payments))
                    )}
                  </span>
                </div>
                {newPledgeForm.category && (
                  <div className="mt-1 flex justify-between text-sm">
                    <span className="text-muted-foreground">Fund:</span>
                    <span className="font-medium text-foreground">
                      {getSelectedFundName(newPledgeForm.category, newPledgeForm.fund)}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewPledgeDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={createPledge}
              disabled={
                !newPledgeForm.amount ||
                !newPledgeForm.category ||
                !newPledgeForm.fund ||
                isProcessing
              }
              className="gap-2"
            >
              {isProcessing ? (
                <>
                  <Clock className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Create Pledge"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
