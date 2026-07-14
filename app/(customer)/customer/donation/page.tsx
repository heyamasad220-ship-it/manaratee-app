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
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { loadCustomerDonationPortalData } from "@/lib/customer/customer-portal-data-actions"
import { customerDonationCategoryRequiresFund } from "@/lib/customer/customer-open-donation-categories"
import { recordCustomerPortalDonationAction } from "@/lib/customer/customer-donation-actions"
import { createCustomerPledgeAction, updateCustomerPledgePaymentPlanAction } from "@/lib/customer/customer-pledge-actions"
import {
  calculateInstallmentAmount,
  computeScheduledPledgePaymentDate,
  defaultFirstPaymentDate,
  pledgeHasPaymentPlan,
  suggestedPledgePaymentAmount,
} from "@/lib/donations/pledge-payment-plan"
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
import {
  CustomerDonationPaymentPicker,
  formatContactCardLabel,
  getDefaultDonationPaymentMethodSelection,
  isDonationOnlinePaymentSelection,
  parseDonationPaymentMethodSelection,
  resolveDonationPaymentMethodLabel,
  type OrganizationPaymentMethodOption,
} from "@/components/customer/customer-donation-payment-picker"
import type { ContactPaymentMethodRow } from "@/lib/contacts/contact-payment-method-actions"

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
  installmentAmount: number | null
  totalPayments: number | null
  paymentsMade: number
  frequency: string
  firstPaymentDate: string | null
  nextPaymentDate: string | null
  pledgeDate: string | null
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
  paymentType: string
}

type DonationFrequency = "one-time" | "monthly" | "quarterly" | "annually"

const DONATION_FREQUENCY_OPTIONS: Array<{ value: DonationFrequency; label: string }> = [
  { value: "one-time", label: "One-time" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "annually", label: "Annually" },
]

function mapPortalPledgeRow(row: Record<string, unknown>): DonationPledge {
  const totalAmount = Number(row.amount_pledged || 0)
  const paidAmount = Number(row.amount_paid || 0)
  const balance = Number(row.balance_remaining ?? 0)
  const paymentsMade = Number(row.payments_made || 0)
  const frequency = (row.frequency as string) || "one_time"
  const firstPaymentDate = (row.first_payment_date as string | null) ?? null
  const installmentAmount =
    row.installment_amount == null ? null : Number(row.installment_amount)
  const totalPayments = row.total_payments == null ? null : Number(row.total_payments)
  const nextPaymentDate =
    (row.next_payment_date as string | null) ??
    computeScheduledPledgePaymentDate({
      firstPaymentDate,
      frequency,
      paymentsMade,
    })

  return {
    id: row.id as string,
    campaignId: (row.campaign_id as string | null) ?? null,
    campaign: (row.campaign_name as string) || "Campaign pledge",
    totalAmount,
    paidAmount,
    balance,
    installmentAmount,
    totalPayments,
    paymentsMade,
    frequency,
    firstPaymentDate,
    nextPaymentDate,
    pledgeDate: (row.pledge_date as string | null) ?? null,
    status: formatPledgeStatusLabel(row.calculated_status as string | null),
  }
}

function donationFrequencyLabel(frequency: DonationFrequency): string {
  return DONATION_FREQUENCY_OPTIONS.find((option) => option.value === frequency)?.label ?? frequency
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

function resolvePaymentTypeLabel(payment: {
  pledge_id?: string | null
  recurring_donation_plan_id?: string | null
}) {
  if (payment.pledge_id) return "Pledge payment"
  if (payment.recurring_donation_plan_id) return "Recurring donation"
  return "One-time donation"
}

function mapPortalPaymentRow(
  payment: Record<string, unknown>,
  categories: DonationCategory[],
  campaignRows: Array<{ id: string; name: string }>
): DonationPayment {
  return {
    id: payment.id as string,
    date: (payment.payment_date as string) || "",
    amount: Number(payment.amount || 0),
    campaign: resolvePaymentCampaignLabel(
      payment as {
        campaign_id?: string | null
        category_id?: string | null
        subcategory_id?: string | null
        memo?: string | null
      },
      categories,
      campaignRows
    ),
    method: (payment.source as string) || "Unknown",
    status: formatPaymentStatusLabel(payment.status as string | null),
    paymentType: resolvePaymentTypeLabel(
      payment as {
        pledge_id?: string | null
        recurring_donation_plan_id?: string | null
      }
    ),
  }
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
  const [contactPaymentMethods, setContactPaymentMethods] = useState<ContactPaymentMethodRow[]>([])
  const [organizationPaymentMethods, setOrganizationPaymentMethods] = useState<
    OrganizationPaymentMethodOption[]
  >([])
  const [pageLoadError, setPageLoadError] = useState<string | null>(null)

  const [selectedPledge, setSelectedPledge] = useState<DonationPledge | null>(null)
  const [showPaymentDialog, setShowPaymentDialog] = useState(false)
  const [showPaymentPlanDialog, setShowPaymentPlanDialog] = useState(false)
  const [showNewPledgeDialog, setShowNewPledgeDialog] = useState(false)
  const [showDonateDialog, setShowDonateDialog] = useState(false)

  const [paymentAmount, setPaymentAmount] = useState("")
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [paymentSuccess, setPaymentSuccess] = useState(false)
  const [donationSuccessType, setDonationSuccessType] = useState<"one-time" | "recurring" | null>(
    null
  )
  const [checkoutSuccessAmount, setCheckoutSuccessAmount] = useState<number | null>(null)
  const [checkoutSuccessFrequency, setCheckoutSuccessFrequency] = useState<string | null>(null)
  const [formError, setFormError] = useState("")

  const [newPledgeForm, setNewPledgeForm] = useState({
    campaign: "",
    totalAmount: "",
  })

  const [paymentPlanPledge, setPaymentPlanPledge] = useState<DonationPledge | null>(null)
  const [paymentPlanForm, setPaymentPlanForm] = useState({
    installmentAmount: "",
    numberOfPayments: "10",
    frequency: "monthly",
    firstPaymentDate: defaultFirstPaymentDate(),
  })

  const [donationForm, setDonationForm] = useState({
    amount: "",
    frequency: "one-time" as DonationFrequency,
    campaign: "",
    category: "",
    fund: "",
    paymentMethod: "",
  })

  useEffect(() => {
    async function loadDonationsPage() {
      setLoading(true)
      setPageLoadError(null)

      try {
        const result = await loadCustomerDonationPortalData()

        if (!result.ok || !result.contact) {
          setContact(null)
          setDonationCategories([])
          setPledges([])
          setPayments([])
          setContactPaymentMethods([])
          setOrganizationPaymentMethods([])
          setPageLoadError(result.error || "Could not load your donations.")
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

        const formattedOrganizationPaymentMethods: OrganizationPaymentMethodOption[] = (
          result.paymentMethods || []
        ).map((method) => ({
          id: method.id as string,
          name: (method.name as string) || "Payment Method",
          fee: method.fee != null ? String(method.fee) : null,
        }))

        const formattedContactPaymentMethods = result.contactPaymentMethods || []
        const defaultPaymentMethod = getDefaultDonationPaymentMethodSelection(
          formattedContactPaymentMethods,
          formattedOrganizationPaymentMethods
        )

        setOrganizationPaymentMethods(formattedOrganizationPaymentMethods)
        setContactPaymentMethods(formattedContactPaymentMethods)
        setSelectedPaymentMethod(defaultPaymentMethod)

        const formattedPledges: DonationPledge[] = (result.pledges || []).map((row) =>
          mapPortalPledgeRow(row as Record<string, unknown>)
        )

        const formattedPayments: DonationPayment[] = (result.payments || []).map((p) =>
          mapPortalPaymentRow(p as Record<string, unknown>, formattedCategories, result.campaigns || [])
        )

        setPledges(formattedPledges)
        setPayments(formattedPayments)
      } catch (error) {
        console.error("[customer-donation] failed to load portal data:", error)
        setPageLoadError("Could not load your donations. Please refresh and try again.")
      } finally {
        setLoading(false)
      }
    }

    void loadDonationsPage()
  }, [])

  useEffect(() => {
    if (loading || typeof window === "undefined") return

    const params = new URLSearchParams(window.location.search)
    const give = params.get("give")
    const campaign = params.get("campaign")?.trim() || ""
    const action = params.get("action")?.trim() || ""

    if (action === "pledge" && campaign) {
      setNewPledgeForm({ campaign, totalAmount: "" })
      setFormError("")
      setShowNewPledgeDialog(true)
      window.history.replaceState({}, "", "/customer/donation")
      return
    }

    if (give === "one-time" || give === "recurring") {
      setDonationForm({
        amount: "",
        frequency: give === "recurring" ? "monthly" : "one-time",
        campaign,
        category: "",
        fund: "",
        paymentMethod: getDefaultDonationPaymentMethodSelection(
          contactPaymentMethods,
          organizationPaymentMethods
        ),
      })
      setDonationSuccessType(null)
      setCheckoutSuccessAmount(null)
      setCheckoutSuccessFrequency(null)
      setFormError("")
      setShowDonateDialog(true)
      window.history.replaceState({}, "", "/customer/donation")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, contactPaymentMethods, organizationPaymentMethods])

  useEffect(() => {
    if (typeof window === "undefined") return

    const params = new URLSearchParams(window.location.search)
    const checkoutState = params.get("checkout")
    const checkoutType = params.get("type")
    const stripeSessionId = params.get("session_id")

    if (checkoutState === "cancelled") {
      setFormError("Online payment was cancelled. You can try again or choose an offline method.")
      setShowDonateDialog(true)
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
          setDonationSuccessType("recurring")
          setShowDonateDialog(true)
        } else if (result.status === "complete") {
          setCheckoutSuccessAmount(result.amount)
          setCheckoutSuccessFrequency(result.recurringPlan?.frequency ?? null)
          setDonationSuccessType("recurring")
          setShowDonateDialog(true)
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
        setDonationSuccessType("one-time")
        setShowDonateDialog(true)
        await loadCustomerDonationPortalData().then((portalResult) => {
          if (!portalResult.ok || !portalResult.contact) return
          const formattedPayments: DonationPayment[] = (portalResult.payments || []).map((p) =>
            mapPortalPaymentRow(
              p as Record<string, unknown>,
              portalResult.categories.map((category) => ({
                id: category.id,
                name: category.name,
                funds: category.funds,
              })),
              portalResult.campaigns || []
            )
          )
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

  const totalPledged = pledges.reduce((sum, pledge) => sum + Number(pledge.totalAmount || 0), 0)
  const totalPaid = payments
    .filter((payment) => normalizePaymentStatus(payment.status) !== "voided")
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
  const outstandingBalance = pledges.reduce((sum, pledge) => sum + Number(pledge.balance || 0), 0)
  const activePledges = pledges.filter(
    (pledge) => pledge.status !== "Fulfilled" && pledge.status !== "Cancelled" && pledge.balance > 0
  )
  const upcomingPaymentTotal = activePledges.reduce(
    (sum, pledge) =>
      sum +
      suggestedPledgePaymentAmount({
        balance: pledge.balance,
        installmentAmount: pledge.installmentAmount,
        frequency: pledge.frequency,
        totalPayments: pledge.totalPayments,
      }),
    0
  )
  const nextPaymentDate =
    activePledges
      .map((pledge) => pledge.nextPaymentDate)
      .filter(Boolean)
      .sort()[0] || "—"

  const handlePayPledge = (pledge: DonationPledge, presetAmount?: number) => {
    setSelectedPledge(pledge)
    setPaymentAmount(
      presetAmount != null
        ? String(presetAmount)
        : pledgeHasPaymentPlan(pledge)
          ? String(
              suggestedPledgePaymentAmount({
                balance: pledge.balance,
                installmentAmount: pledge.installmentAmount,
                frequency: pledge.frequency,
                totalPayments: pledge.totalPayments,
              })
            )
          : ""
    )
    setSelectedPaymentMethod(
      getDefaultDonationPaymentMethodSelection(contactPaymentMethods, organizationPaymentMethods)
    )
    setShowPaymentDialog(true)
    setPaymentSuccess(false)
    setFormError("")
  }

  const handleOpenDonate = (
    frequency: DonationFrequency = "one-time",
    campaignId = ""
  ) => {
    setDonationForm({
      amount: "",
      frequency,
      campaign: campaignId,
      category: "",
      fund: "",
      paymentMethod: getDefaultDonationPaymentMethodSelection(
        contactPaymentMethods,
        organizationPaymentMethods
      ),
    })
    setDonationSuccessType(null)
    setCheckoutSuccessAmount(null)
    setCheckoutSuccessFrequency(null)
    setFormError("")
    setShowDonateDialog(true)
  }

  const isOneTimeDonation = donationForm.frequency === "one-time"

  const selectedDonationCategory = donationCategories.find(
    (category) => category.id === donationForm.category
  )
  const selectedCategoryRequiresFund = selectedDonationCategory
    ? customerDonationCategoryRequiresFund(selectedDonationCategory)
    : false

  const processDonation = async () => {
    if (!contact) return

    if (isOneTimeDonation) {
      await processOneTimeDonation()
      return
    }

    setIsProcessing(true)
    setFormError("")

    const hasOnlineDonations =
      contactPaymentMethods.length > 0 ||
      organizationPaymentMethods.some((method) => isStripeCheckoutPaymentMethod(method.name))

    if (!hasOnlineDonations) {
      setFormError("Online card payments are not available for recurring gifts yet.")
      setIsProcessing(false)
      return
    }

    const result = await createRecurringDonationCheckoutAction({
      amount: Number(donationForm.amount || 0),
      frequency: donationForm.frequency,
      campaignId: donationForm.campaign || null,
      categoryId: donationForm.category || null,
      subcategoryId: donationForm.fund || null,
    })

    if (!result.success || !result.checkoutUrl) {
      setFormError(result.error || "Could not start recurring checkout. Please try again.")
      setIsProcessing(false)
      return
    }

    window.location.href = result.checkoutUrl
  }

  const handleOpenNewPledge = (campaignId = "") => {
    setNewPledgeForm({
      campaign: campaignId || campaigns[0]?.id || "",
      totalAmount: "",
    })
    setFormError("")
    setShowNewPledgeDialog(true)
  }

  const handleOpenPaymentPlan = (pledge: DonationPledge) => {
    const hasPlan = pledgeHasPaymentPlan(pledge)
    const numberOfPayments = hasPlan ? String(pledge.totalPayments ?? 10) : "10"
    const installmentAmount = hasPlan
      ? String(pledge.installmentAmount ?? "")
      : pledge.totalAmount > 0 && Number(numberOfPayments) > 0
        ? String(calculateInstallmentAmount(pledge.totalAmount, Number(numberOfPayments)))
        : ""

    setPaymentPlanPledge(pledge)
    setPaymentPlanForm({
      installmentAmount,
      numberOfPayments,
      frequency: hasPlan ? pledge.frequency : "monthly",
      firstPaymentDate: pledge.firstPaymentDate || defaultFirstPaymentDate(),
    })
    setFormError("")
    setShowPaymentPlanDialog(true)
  }

  const savePaymentPlan = async () => {
    if (!paymentPlanPledge) return

    setIsProcessing(true)
    setFormError("")

    const result = await updateCustomerPledgePaymentPlanAction({
      pledgeId: paymentPlanPledge.id,
      installmentAmount: Number(paymentPlanForm.installmentAmount || 0),
      numberOfPayments: Number(paymentPlanForm.numberOfPayments || 0),
      frequency: paymentPlanForm.frequency as "monthly" | "quarterly" | "annually",
      firstPaymentDate: paymentPlanForm.firstPaymentDate,
    })

    if (!result.success) {
      setFormError(result.error || "Could not save payment plan.")
      setIsProcessing(false)
      return
    }

    const { data: pledgeView } = await supabase
      .from("pledge_status_view")
      .select(
        "id, campaign_id, campaign_name, amount_pledged, amount_paid, balance_remaining, calculated_status, frequency, pledge_date, installment_amount, total_payments, first_payment_date, next_payment_date"
      )
      .eq("id", paymentPlanPledge.id)
      .maybeSingle()

    if (pledgeView) {
      setPledges((currentPledges) =>
        currentPledges.map((pledge) =>
          pledge.id === paymentPlanPledge.id
            ? mapPortalPledgeRow({
                ...pledgeView,
                payments_made: pledge.paymentsMade,
              })
            : pledge
        )
      )
    }

    setIsProcessing(false)
    setShowPaymentPlanDialog(false)
    setPaymentPlanPledge(null)
  }

  const createPledge = async () => {
    if (!contact) return

    setIsProcessing(true)
    setFormError("")

    const result = await createCustomerPledgeAction({
      campaignId: newPledgeForm.campaign,
      totalAmount: Number(newPledgeForm.totalAmount || 0),
    })

    if (!result.success) {
      setFormError(result.error || "Pledge could not be saved. Please try again.")
      setIsProcessing(false)
      return
    }

    const { data: pledgeView } = await supabase
      .from("pledge_status_view")
      .select(
        "id, campaign_id, campaign_name, amount_pledged, amount_paid, balance_remaining, calculated_status, frequency, pledge_date, installment_amount, total_payments, first_payment_date, next_payment_date"
      )
      .eq("id", result.pledgeId)
      .maybeSingle()

    if (pledgeView) {
      setPledges((currentPledges) => [
        mapPortalPledgeRow({ ...pledgeView, payments_made: 0 }),
        ...currentPledges,
      ])
    }

    setIsProcessing(false)
    setShowNewPledgeDialog(false)
  }

  const processPayment = async () => {
    if (!contact || !selectedPledge) return

    setIsProcessing(true)
    setFormError("")

    const paymentMethodName = resolveDonationPaymentMethodLabel(
      selectedPaymentMethod,
      contactPaymentMethods,
      organizationPaymentMethods
    )
    const parsedSelection = parseDonationPaymentMethodSelection(selectedPaymentMethod)
    const selectedContactCard =
      parsedSelection?.type === "contact"
        ? contactPaymentMethods.find((method) => method.id === parsedSelection.id)
        : null

    const donorId = await ensureDonorExtensionForContact(
      contact.organization_id,
      contact.id
    )

    if (!donorId) {
      setFormError("Could not resolve your donor profile. Please try again.")
      setIsProcessing(false)
      return
    }

    const amount = Number(paymentAmount || 0)
    if (!Number.isFinite(amount) || amount <= 0) {
      setFormError("Enter a valid payment amount.")
      setIsProcessing(false)
      return
    }

    if (amount > selectedPledge.balance + 0.01) {
      setFormError(`Payment cannot exceed the remaining balance of ${formatCurrency(selectedPledge.balance)}.`)
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
        amount: amount,
        payment_date: `${paymentDate}T12:00:00`,
        source: selectedContactCard
          ? normalizePaymentSourceChannel("stripe")
          : normalizePaymentSourceChannel(paymentMethodName),
        source_type: "portal",
        status: "allocated",
        is_verified: false,
        memo: selectedContactCard
          ? `Pledge payment recorded with card on file (${formatContactCardLabel(selectedContactCard)})`
          : null,
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
        paymentType: "Pledge payment",
      },
      ...currentPayments,
    ])

    const paymentValue = amount
    const updatedPaidAmount = selectedPledge.paidAmount + paymentValue
    const updatedBalance = Math.max(selectedPledge.totalAmount - updatedPaidAmount, 0)
    const updatedPaymentsMade = selectedPledge.paymentsMade + 1
    const updatedStatus =
      updatedBalance <= 0 ? "Fulfilled" : updatedPaidAmount > 0 ? "Partial" : selectedPledge.status

    setPledges((currentPledges) =>
      currentPledges.map((pledge) =>
        pledge.id === selectedPledge.id
          ? {
              ...pledge,
              paidAmount: updatedPaidAmount,
              balance: updatedBalance,
              paymentsMade: updatedPaymentsMade,
              status: updatedStatus,
              nextPaymentDate: computeScheduledPledgePaymentDate({
                firstPaymentDate: pledge.firstPaymentDate,
                frequency: pledge.frequency,
                paymentsMade: updatedPaymentsMade,
              }),
            }
          : pledge
      )
    )

    setIsProcessing(false)
    setPaymentSuccess(true)
  }

  const processOneTimeDonation = async () => {
    if (!contact) return

    setIsProcessing(true)
    setFormError("")

    const paymentMethodName = resolveDonationPaymentMethodLabel(
      donationForm.paymentMethod,
      contactPaymentMethods,
      organizationPaymentMethods
    )
    const parsedSelection = parseDonationPaymentMethodSelection(donationForm.paymentMethod)
    const selectedContactCard =
      parsedSelection?.type === "contact"
        ? contactPaymentMethods.find((method) => method.id === parsedSelection.id)
        : null
    const useStripeCheckout = isDonationOnlinePaymentSelection(
      donationForm.paymentMethod,
      organizationPaymentMethods
    )

    const donorId = await ensureDonorExtensionForContact(
      contact.organization_id,
      contact.id
    )

    if (!donorId) {
      setFormError("Could not resolve your donor profile. Please try again.")
      setIsProcessing(false)
      return
    }

    if (useStripeCheckout) {
      const result = await createOneTimeDonationCheckoutAction({
        amount: Number(donationForm.amount || 0),
        campaignId: donationForm.campaign || null,
        categoryId: donationForm.category || null,
        subcategoryId: donationForm.fund || null,
      })

      if (result.success && result.checkoutUrl) {
        window.location.href = result.checkoutUrl
        return
      }

      if (!selectedContactCard) {
        setFormError(result.error || "Could not start online checkout. Please try again.")
        setIsProcessing(false)
        return
      }
    }

    const selectedFundName = getSelectedFundName(
      donationForm.category,
      donationForm.fund
    )

    const result = await recordCustomerPortalDonationAction({
      amount: Number(donationForm.amount || 0),
      campaignId: donationForm.campaign || null,
      categoryId: donationForm.category || null,
      subcategoryId: donationForm.fund || null,
      paymentMethodName: selectedContactCard
        ? normalizePaymentSourceChannel("stripe")
        : paymentMethodName,
      memo: selectedContactCard
        ? `Donation recorded with card on file (${formatContactCardLabel(selectedContactCard)})`
        : `Offline donation recorded (${paymentMethodName})`,
    })

    if (!result.success || !result.payment) {
      setFormError(result.error || "Donation could not be saved. Please try again.")
      setIsProcessing(false)
      return
    }

    const data = result.payment

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
          getSelectedFundName(donationForm.category, donationForm.fund) ||
          campaigns.find((c) => c.id === donationForm.campaign)?.name ||
          "General Fund",
        method: paymentMethodName,
        status: formatPaymentStatusLabel(data.status),
        paymentType: "One-time donation",
      },
      ...currentPayments,
    ])

    setIsProcessing(false)
    setCheckoutSuccessAmount(null)
    setDonationSuccessType("one-time")
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Open":
        return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">Open</Badge>
      case "Partial":
        return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Partial</Badge>
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

      {pageLoadError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {pageLoadError}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="h-full border-l-4 border-l-primary">
          <CardContent className="flex h-full flex-col p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-sm text-muted-foreground">Total Pledged</p>
                <p className="mt-1 text-2xl font-bold text-foreground">
                  {loading ? "—" : formatCurrency(totalPledged)}
                </p>
                <p className="mt-1 min-h-4 text-xs text-muted-foreground">&nbsp;</p>
              </div>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Heart className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="h-full border-l-4 border-l-emerald-500">
          <CardContent className="flex h-full flex-col p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-sm text-muted-foreground">Total Paid</p>
                <p className="mt-1 text-2xl font-bold text-emerald-600">
                  {loading ? "—" : formatCurrency(totalPaid)}
                </p>
                <p className="mt-1 min-h-4 text-xs text-muted-foreground">&nbsp;</p>
              </div>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="h-full border-l-4 border-l-amber-500">
          <CardContent className="flex h-full flex-col p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-sm text-muted-foreground">Outstanding Balance</p>
                <p className="mt-1 text-2xl font-bold text-amber-600">
                  {loading ? "—" : formatCurrency(outstandingBalance)}
                </p>
                <p className="mt-1 min-h-4 text-xs text-muted-foreground">&nbsp;</p>
              </div>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100">
                <DollarSign className="h-5 w-5 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="h-full border-l-4 border-l-violet-500">
          <CardContent className="flex h-full flex-col p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-sm text-muted-foreground">Next Payment Due</p>
                <p className="mt-1 text-2xl font-bold text-violet-600">
                  {loading ? "—" : formatCurrency(upcomingPaymentTotal)}
                </p>
                <p className="mt-1 min-h-4 text-xs text-muted-foreground">{nextPaymentDate}</p>
              </div>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-violet-100">
                <Calendar className="h-5 w-5 text-violet-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="pledges" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="pledges">My Pledges</TabsTrigger>
          <TabsTrigger value="payments">Payment History</TabsTrigger>
        </TabsList>

        <TabsContent value="pledges" className="mt-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-lg font-semibold text-foreground">All Pledges</h2>
              <Button size="sm" onClick={handleOpenNewPledge}>
                <Plus className="mr-1 h-4 w-4" />
                New Pledge
              </Button>
            </div>

            <div className="flex flex-col gap-4">
              {loading ? (
                <Card>
                  <CardContent className="p-6 text-sm text-muted-foreground">
                    Loading pledges...
                  </CardContent>
                </Card>
              ) : pageLoadError ? (
                <Card>
                  <CardContent className="p-6 text-sm text-muted-foreground">
                    {pageLoadError}
                  </CardContent>
                </Card>
              ) : pledges.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center gap-3 p-8 text-center">
                    <Heart className="h-10 w-10 text-muted-foreground/50" />
                    <div>
                      <p className="text-sm font-medium text-foreground">No pledges yet</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Create a pledge toward a campaign when you are ready to support a fund.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                pledges.map((pledge) => {
                  const hasPlan = pledgeHasPaymentPlan(pledge)
                  const canPay =
                    pledge.balance > 0 &&
                    pledge.status !== "Fulfilled" &&
                    pledge.status !== "Cancelled"

                  return (
                  <Card key={pledge.id} className="overflow-hidden">
                    <CardContent className="p-0">
                      <div className="flex flex-col lg:flex-row">
                        <div className="flex-1 p-5">
                          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-foreground">{pledge.campaign}</h3>
                              {getStatusBadge(pledge.status)}
                            </div>
                            <div>
                              <span className="text-muted-foreground">Pledged </span>
                              <span className="font-medium text-foreground">
                                {pledge.pledgeDate || "—"}
                              </span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Total pledge </span>
                              <span className="font-medium text-foreground">
                                {formatCurrency(pledge.totalAmount)}
                              </span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Payments made </span>
                              <span className="font-medium text-foreground">
                                {hasPlan
                                  ? `${pledge.paymentsMade} of ${pledge.totalPayments}`
                                  : pledge.paymentsMade}
                              </span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Remaining balance </span>
                              <span className="font-medium text-foreground">
                                {formatCurrency(pledge.balance)}
                              </span>
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
                          </div>
                        </div>

                        {canPay ? (
                          <div className="flex flex-col justify-center gap-2 border-t border-border p-5 lg:w-56 lg:border-l lg:border-t-0">
                            <Button
                              className="w-full gap-2"
                              onClick={() => handlePayPledge(pledge)}
                            >
                              <CreditCard className="h-4 w-4" />
                              Pay Now
                            </Button>
                            <Button
                              variant="outline"
                              className="w-full gap-2"
                              onClick={() => handleOpenPaymentPlan(pledge)}
                            >
                              <Calendar className="h-4 w-4" />
                              {hasPlan ? "Edit Payment Plan" : "Set Up Payment Plan"}
                            </Button>
                          </div>
                        ) : null}

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
                  )
                })
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
                ) : pageLoadError ? (
                  <div className="p-6 text-sm text-muted-foreground">{pageLoadError}</div>
                ) : payments.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
                    <CreditCard className="h-10 w-10 text-muted-foreground/50" />
                    <div>
                      <p className="text-sm font-medium text-foreground">No payments yet</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Pledge payments, recurring donations, and one-time donations will appear here.
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
                            <p className="text-sm text-muted-foreground">
                              {payment.date}
                              <span className="mx-1.5">·</span>
                              {payment.paymentType}
                            </p>
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

      {/* Donate Dialog */}
      <Dialog open={showDonateDialog} onOpenChange={setShowDonateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {donationSuccessType === "recurring"
                ? "Recurring Gift Started"
                : donationSuccessType === "one-time"
                  ? "Donation Successful"
                  : "Make a Donation"}
            </DialogTitle>
            <DialogDescription>
              {donationSuccessType === "recurring"
                ? "Thank you for your ongoing support!"
                : donationSuccessType === "one-time"
                  ? "Thank you for your contribution!"
                  : "Choose an amount, frequency, fund, and payment details."}
            </DialogDescription>
          </DialogHeader>

          {donationSuccessType ? (
            <div className="flex flex-col items-center gap-4 py-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                <CheckCircle2 className="h-8 w-8 text-emerald-600" />
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-foreground">
                  {formatCurrency(checkoutSuccessAmount ?? Number(donationForm.amount || 0))}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {donationSuccessType === "recurring"
                    ? checkoutSuccessFrequency
                      ? `${checkoutSuccessFrequency.charAt(0).toUpperCase()}${checkoutSuccessFrequency.slice(1)} recurring gift — card on file with Stripe`
                      : "Recurring gift set up with Stripe"
                    : checkoutSuccessAmount != null
                      ? "Online payment received — thank you!"
                      : "Offline donation recorded — staff will reconcile if needed"}
                </p>
              </div>
              <Button className="mt-4 w-full" onClick={() => setShowDonateDialog(false)}>
                Done
              </Button>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-4 py-4">
                <div className="flex flex-col gap-2">
                  <Label>Frequency</Label>
                  <Select
                    value={donationForm.frequency}
                    onValueChange={(v) =>
                      setDonationForm({
                        ...donationForm,
                        frequency: v as DonationFrequency,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DONATION_FREQUENCY_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-2">
                  <Label>Donation Amount</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      $
                    </span>
                    <Input
                      type="number"
                      value={donationForm.amount}
                      onChange={(e) =>
                        setDonationForm({
                          ...donationForm,
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
                      value={donationForm.campaign || "none"}
                      onValueChange={(v) =>
                        setDonationForm({
                          ...donationForm,
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
                    value={donationForm.category}
                    onValueChange={(v) =>
                      setDonationForm({
                        ...donationForm,
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

                {donationForm.category && selectedCategoryRequiresFund ? (
                  <div className="flex flex-col gap-2">
                    <Label>Specific Fund</Label>
                    <Select
                      value={donationForm.fund}
                      onValueChange={(v) =>
                        setDonationForm({
                          ...donationForm,
                          fund: v,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select fund" />
                      </SelectTrigger>
                      <SelectContent>
                        {selectedDonationCategory?.funds.map((fund) => (
                          <SelectItem key={fund.id} value={fund.id}>
                            {fund.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}

                {isOneTimeDonation ? (
                  contact ? (
                    <CustomerDonationPaymentPicker
                      contactId={contact.id}
                      contactPaymentMethods={contactPaymentMethods}
                      organizationPaymentMethods={organizationPaymentMethods}
                      selectedPaymentMethodId={donationForm.paymentMethod}
                      onSelectedPaymentMethodIdChange={(value) =>
                        setDonationForm({
                          ...donationForm,
                          paymentMethod: value,
                        })
                      }
                      onContactPaymentMethodsChange={setContactPaymentMethods}
                    />
                  ) : null
                ) : (
                  <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
                    Payment method:{" "}
                    <span className="font-medium text-foreground">Credit card via Stripe</span>
                  </div>
                )}

                {formError ? (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    {formError}
                  </div>
                ) : null}

                {donationForm.amount ? (
                  <div className="rounded-lg bg-muted/50 p-4">
                    <p className="text-sm font-medium text-foreground">Donation Summary</p>
                    <div className="mt-2 flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        {isOneTimeDonation
                          ? "One-time donation"
                          : `${donationFrequencyLabel(donationForm.frequency)} recurring gift`}
                        :
                      </span>
                      <span className="font-bold text-foreground">
                        {formatCurrency(Number(donationForm.amount))}
                      </span>
                    </div>
                    {donationForm.category ? (
                      <div className="mt-1 flex justify-between text-sm">
                        <span className="text-muted-foreground">Fund:</span>
                        <span className="font-medium text-foreground">
                          {getSelectedFundName(donationForm.category, donationForm.fund)}
                        </span>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowDonateDialog(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={processDonation}
                  disabled={
                    !donationForm.amount ||
                    !donationForm.category ||
                    (selectedCategoryRequiresFund && !donationForm.fund) ||
                    (isOneTimeDonation && !donationForm.paymentMethod) ||
                    isProcessing
                  }
                  className="gap-2"
                >
                  {isProcessing ? (
                    <>
                      <Clock className="h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : isOneTimeDonation ? (
                    parseDonationPaymentMethodSelection(donationForm.paymentMethod)?.type ===
                    "contact" ? (
                      <>
                        <CreditCard className="h-4 w-4" />
                        Pay {formatCurrency(Number(donationForm.amount) || 0)} with card
                      </>
                    ) : isDonationOnlinePaymentSelection(
                        donationForm.paymentMethod,
                        organizationPaymentMethods
                      ) ? (
                      <>
                        <CreditCard className="h-4 w-4" />
                        Pay {formatCurrency(Number(donationForm.amount) || 0)} online
                      </>
                    ) : (
                      <>
                        <DollarSign className="h-4 w-4" />
                        Record {formatCurrency(Number(donationForm.amount) || 0)} offline
                      </>
                    )
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
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handlePayPledge(selectedPledge, selectedPledge.balance)}
                      >
                        Pay in Full ({formatCurrency(selectedPledge.balance)})
                      </Button>
                      {pledgeHasPaymentPlan(selectedPledge) ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setPaymentAmount(
                              String(
                                suggestedPledgePaymentAmount({
                                  balance: selectedPledge.balance,
                                  installmentAmount: selectedPledge.installmentAmount,
                                  frequency: selectedPledge.frequency,
                                  totalPayments: selectedPledge.totalPayments,
                                })
                              )
                            )
                          }
                        >
                          Plan Amount (
                          {formatCurrency(
                            suggestedPledgePaymentAmount({
                              balance: selectedPledge.balance,
                              installmentAmount: selectedPledge.installmentAmount,
                              frequency: selectedPledge.frequency,
                              totalPayments: selectedPledge.totalPayments,
                            })
                          )}
                          )
                        </Button>
                      ) : null}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Or enter any amount up to {formatCurrency(selectedPledge?.balance || 0)}.
                  </p>
                </div>

                {contact ? (
                  <CustomerDonationPaymentPicker
                    contactId={contact.id}
                    contactPaymentMethods={contactPaymentMethods}
                    organizationPaymentMethods={organizationPaymentMethods}
                    selectedPaymentMethodId={selectedPaymentMethod}
                    onSelectedPaymentMethodIdChange={setSelectedPaymentMethod}
                    onContactPaymentMethodsChange={setContactPaymentMethods}
                  />
                ) : null}

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
              Choose a campaign and the total amount you want to pledge. You can pay or set up a
              payment plan later.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-4">
            {campaigns.length > 0 ? (
              <div className="flex flex-col gap-2">
                <Label>Campaign</Label>
                <Select
                  value={newPledgeForm.campaign}
                  onValueChange={(value) =>
                    setNewPledgeForm({ ...newPledgeForm, campaign: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select campaign" />
                  </SelectTrigger>
                  <SelectContent>
                    {campaigns.map((campaign) => (
                      <SelectItem key={campaign.id} value={campaign.id}>
                        {campaign.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                No active campaigns are available for pledges right now.
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Label>Total pledge amount</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  $
                </span>
                <Input
                  type="number"
                  value={newPledgeForm.totalAmount}
                  onChange={(e) =>
                    setNewPledgeForm({ ...newPledgeForm, totalAmount: e.target.value })
                  }
                  className="pl-7"
                  placeholder="1000"
                />
              </div>
            </div>

            {formError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {formError}
              </div>
            ) : null}

            {newPledgeForm.totalAmount ? (
              <div className="rounded-lg bg-muted/50 p-4">
                <p className="text-sm font-medium text-foreground">Pledge summary</p>
                <div className="mt-2 flex justify-between text-sm">
                  <span className="text-muted-foreground">Campaign:</span>
                  <span className="font-medium text-foreground">
                    {campaigns.find((campaign) => campaign.id === newPledgeForm.campaign)?.name ||
                      "—"}
                  </span>
                </div>
                <div className="mt-1 flex justify-between text-sm">
                  <span className="text-muted-foreground">Total pledge:</span>
                  <span className="font-bold text-foreground">
                    {formatCurrency(Number(newPledgeForm.totalAmount))}
                  </span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Pledge date will be set to today. You can pay or set up a payment plan after
                  creating the pledge.
                </p>
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewPledgeDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={createPledge}
              disabled={
                !newPledgeForm.campaign ||
                !newPledgeForm.totalAmount ||
                campaigns.length === 0 ||
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

      {/* Payment Plan Dialog */}
      <Dialog open={showPaymentPlanDialog} onOpenChange={setShowPaymentPlanDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {paymentPlanPledge && pledgeHasPaymentPlan(paymentPlanPledge)
                ? "Edit Payment Plan"
                : "Set Up Payment Plan"}
            </DialogTitle>
            <DialogDescription>
              {paymentPlanPledge
                ? `Schedule how you want to pay your ${formatCurrency(paymentPlanPledge.totalAmount)} pledge to ${paymentPlanPledge.campaign}.`
                : "Choose your installment schedule."}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label>Payment frequency</Label>
              <Select
                value={paymentPlanForm.frequency}
                onValueChange={(value) =>
                  setPaymentPlanForm({ ...paymentPlanForm, frequency: value })
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

            <div className="flex flex-col gap-2">
              <Label>Number of payments</Label>
              <Input
                type="number"
                min={2}
                value={paymentPlanForm.numberOfPayments}
                onChange={(e) => {
                  const numberOfPayments = e.target.value
                  const totalAmount = paymentPlanPledge?.totalAmount ?? 0
                  const installmentAmount =
                    totalAmount > 0 && Number(numberOfPayments) > 0
                      ? String(calculateInstallmentAmount(totalAmount, Number(numberOfPayments)))
                      : paymentPlanForm.installmentAmount
                  setPaymentPlanForm({
                    ...paymentPlanForm,
                    numberOfPayments,
                    installmentAmount,
                  })
                }}
                placeholder="10"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label>Amount per payment</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  $
                </span>
                <Input
                  type="number"
                  value={paymentPlanForm.installmentAmount}
                  onChange={(e) =>
                    setPaymentPlanForm({
                      ...paymentPlanForm,
                      installmentAmount: e.target.value,
                    })
                  }
                  className="pl-7"
                  placeholder="100"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label>First payment date</Label>
              <Input
                type="date"
                value={paymentPlanForm.firstPaymentDate}
                onChange={(e) =>
                  setPaymentPlanForm({
                    ...paymentPlanForm,
                    firstPaymentDate: e.target.value,
                  })
                }
              />
            </div>

            {paymentPlanPledge ? (
              <div className="rounded-lg bg-muted/50 p-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total pledge</span>
                  <span className="font-medium">{formatCurrency(paymentPlanPledge.totalAmount)}</span>
                </div>
                <div className="mt-1 flex justify-between">
                  <span className="text-muted-foreground">Remaining balance</span>
                  <span className="font-medium">{formatCurrency(paymentPlanPledge.balance)}</span>
                </div>
              </div>
            ) : null}

            {formError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {formError}
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPaymentPlanDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={savePaymentPlan}
              disabled={
                !paymentPlanPledge ||
                !paymentPlanForm.installmentAmount ||
                !paymentPlanForm.numberOfPayments ||
                !paymentPlanForm.firstPaymentDate ||
                isProcessing
              }
            >
              {isProcessing ? "Saving..." : "Save Payment Plan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
