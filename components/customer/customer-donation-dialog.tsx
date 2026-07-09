"use client"

import { useEffect, useState } from "react"
import { CheckCircle2, Clock, CreditCard, DollarSign } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { loadCustomerDonationPortalData } from "@/lib/customer/customer-portal-data-actions"
import { ensureDonorExtensionForContact } from "@/lib/donations/donor-contact-bridge"
import { normalizePaymentSourceChannel, isStripeCheckoutPaymentMethod } from "@/lib/donations/payment-source-channel"
import {
  createOneTimeDonationCheckoutAction,
  createRecurringDonationCheckoutAction,
} from "@/lib/donations/stripe-donation-actions"
import { Button } from "@/components/ui/button"
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

export type DonationFrequency = "one-time" | "monthly" | "quarterly" | "annually"

const DONATION_FREQUENCY_OPTIONS: Array<{ value: DonationFrequency; label: string }> = [
  { value: "one-time", label: "One-time" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "annually", label: "Annually" },
]

type DonationCategory = {
  id: string
  name: string
  funds: Array<{ id: string; name: string; category_id: string }>
}

type DonationCampaign = {
  id: string
  name: string
}

type Contact = {
  id: string
  full_name: string | null
  email: string | null
  organization_id: string
}

export type CustomerDonationDialogPreset = {
  campaignId?: string
  categoryId?: string
  frequency?: DonationFrequency
}

function donationFrequencyLabel(frequency: DonationFrequency): string {
  return DONATION_FREQUENCY_OPTIONS.find((option) => option.value === frequency)?.label ?? frequency
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

async function syncDonorAffiliationAfterDonation(input: {
  organizationId: string
  contactId: string
  donorId: string
  context: string
}) {
  try {
    const { handleDonationAffiliationSync } = await import("@/lib/contacts/contact-affiliation-sync")
    await handleDonationAffiliationSync({
      organizationId: input.organizationId,
      contactId: input.contactId,
      donorId: input.donorId,
    })
  } catch (syncError) {
    const message = syncError instanceof Error ? syncError.message : String(syncError)
    console.error(`[customer-donation-dialog] affiliation sync failed (${input.context}): ${message}`)
  }
}

export function CustomerDonationDialog({
  open,
  onOpenChange,
  preset,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  preset?: CustomerDonationDialogPreset
}) {
  const supabase = createClient()

  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [contact, setContact] = useState<Contact | null>(null)
  const [donationCategories, setDonationCategories] = useState<DonationCategory[]>([])
  const [campaigns, setCampaigns] = useState<DonationCampaign[]>([])
  const [contactPaymentMethods, setContactPaymentMethods] = useState<ContactPaymentMethodRow[]>([])
  const [organizationPaymentMethods, setOrganizationPaymentMethods] = useState<
    OrganizationPaymentMethodOption[]
  >([])

  const [isProcessing, setIsProcessing] = useState(false)
  const [formError, setFormError] = useState("")
  const [donationSuccessType, setDonationSuccessType] = useState<"one-time" | "recurring" | null>(
    null
  )
  const [checkoutSuccessAmount, setCheckoutSuccessAmount] = useState<number | null>(null)
  const [checkoutSuccessFrequency, setCheckoutSuccessFrequency] = useState<string | null>(null)

  const [donationForm, setDonationForm] = useState({
    amount: "",
    frequency: "one-time" as DonationFrequency,
    campaign: "",
    category: "",
    fund: "",
    paymentMethod: "",
  })

  const isOneTimeDonation = donationForm.frequency === "one-time"

  const getSelectedFundName = (categoryId: string, fundId: string) => {
    const category = donationCategories.find((cat) => cat.id === categoryId)
    const fund = category?.funds.find((f) => f.id === fundId)
    return fund?.name || category?.name || "General Fund"
  }

  useEffect(() => {
    if (!open) return

    let cancelled = false

    async function loadDonationData() {
      setLoading(true)
      setLoadError(null)

      try {
        const result = await loadCustomerDonationPortalData()

        if (cancelled) return

        if (!result.ok || !result.contact) {
          setContact(null)
          setDonationCategories([])
          setCampaigns([])
          setContactPaymentMethods([])
          setOrganizationPaymentMethods([])
          setLoadError(result.error || "Could not load donation options.")
          return
        }

        const formattedCategories: DonationCategory[] = result.categories.map((category) => ({
          id: category.id,
          name: category.name,
          funds: category.funds,
        }))

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

        setContact(result.contact)
        setDonationCategories(formattedCategories)
        setCampaigns(
          (result.campaigns || []).map((campaign) => ({
            id: campaign.id as string,
            name: campaign.name as string,
          }))
        )
        setOrganizationPaymentMethods(formattedOrganizationPaymentMethods)
        setContactPaymentMethods(formattedContactPaymentMethods)

        setDonationSuccessType(null)
        setCheckoutSuccessAmount(null)
        setCheckoutSuccessFrequency(null)
        setFormError("")

        const presetCategory = preset?.categoryId
          ? formattedCategories.find((category) => category.id === preset.categoryId)
          : null
        const presetFund =
          presetCategory?.funds.length === 1 ? presetCategory.funds[0].id : ""

        setDonationForm({
          amount: "",
          frequency: preset?.frequency ?? "one-time",
          campaign: preset?.campaignId ?? "",
          category: preset?.categoryId ?? "",
          fund: presetFund,
          paymentMethod: defaultPaymentMethod,
        })
      } catch (error) {
        console.error("[customer-donation-dialog] failed to load portal data:", error)
        if (!cancelled) {
          setLoadError("Could not load donation options. Please try again.")
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadDonationData()

    return () => {
      cancelled = true
    }
  }, [open, preset?.campaignId, preset?.categoryId, preset?.frequency])

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

    const donorId = await ensureDonorExtensionForContact(contact.organization_id, contact.id)

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

    const paymentDate = new Date().toISOString().split("T")[0]

    const { error } = await supabase.from("payments").insert({
      organization_id: contact.organization_id,
      contact_id: contact.id,
      donor_id: donorId,
      pledge_id: null,
      sender_name: contact.full_name || contact.email || null,
      amount: Number(donationForm.amount || 0),
      payment_date: `${paymentDate}T12:00:00`,
      source: selectedContactCard
        ? normalizePaymentSourceChannel("stripe")
        : normalizePaymentSourceChannel(paymentMethodName),
      source_type: "portal",
      status: "unallocated",
      is_verified: false,
      campaign_id: donationForm.campaign || null,
      category_id: donationForm.category || null,
      subcategory_id: donationForm.fund || null,
      memo: selectedContactCard
        ? `Donation recorded with card on file (${formatContactCardLabel(selectedContactCard)})`
        : `Offline donation recorded (${paymentMethodName})`,
    })

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

    setIsProcessing(false)
    setCheckoutSuccessAmount(null)
    setDonationSuccessType("one-time")
  }

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

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setDonationSuccessType(null)
      setCheckoutSuccessAmount(null)
      setCheckoutSuccessFrequency(null)
      setFormError("")
    }
    onOpenChange(nextOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
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

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Clock className="h-4 w-4 animate-spin" />
            Loading donation options...
          </div>
        ) : loadError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {loadError}
          </div>
        ) : donationSuccessType ? (
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
            <Button className="mt-4 w-full" onClick={() => handleOpenChange(false)}>
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
                  onValueChange={(value) =>
                    setDonationForm({
                      ...donationForm,
                      frequency: value as DonationFrequency,
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
                    onChange={(event) =>
                      setDonationForm({
                        ...donationForm,
                        amount: event.target.value,
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
                    onValueChange={(value) =>
                      setDonationForm({
                        ...donationForm,
                        campaign: value === "none" ? "" : value,
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
                  onValueChange={(value) =>
                    setDonationForm({
                      ...donationForm,
                      category: value,
                      fund: "",
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {donationCategories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {donationForm.category ? (
                <div className="flex flex-col gap-2">
                  <Label>Specific Fund</Label>
                  <Select
                    value={donationForm.fund}
                    onValueChange={(value) =>
                      setDonationForm({
                        ...donationForm,
                        fund: value,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select fund" />
                    </SelectTrigger>
                    <SelectContent>
                      {donationCategories
                        .find((category) => category.id === donationForm.category)
                        ?.funds.map((fund) => (
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
              <Button variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={processDonation}
                disabled={
                  !donationForm.amount ||
                  !donationForm.category ||
                  !donationForm.fund ||
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
  )
}
