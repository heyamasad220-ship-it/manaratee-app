"use client"

import { useState } from "react"
import { CreditCard, Plus } from "lucide-react"

import { Badge } from "@/components/ui/badge"
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { ContactPaymentMethodRow } from "@/lib/contacts/contact-payment-method-actions"
import {
  formatCardNumberInput,
  formatExpirationInput,
} from "@/lib/contacts/contact-payment-method-validation"
import { isStripeCheckoutPaymentMethod } from "@/lib/donations/payment-source-channel"
import { addCustomerContactPaymentMethodAction } from "@/lib/customer/customer-payment-method-actions"

export type OrganizationPaymentMethodOption = {
  id: string
  name: string
  fee: string | null
}

const CONTACT_PAYMENT_METHOD_PREFIX = "contact:"
const ORG_PAYMENT_METHOD_PREFIX = "org:"

const CARD_BRANDS = ["Visa", "Mastercard", "American Express", "Discover", "Other"]

export function toContactPaymentMethodSelectionId(id: string) {
  return `${CONTACT_PAYMENT_METHOD_PREFIX}${id}`
}

export function toOrgPaymentMethodSelectionId(id: string) {
  return `${ORG_PAYMENT_METHOD_PREFIX}${id}`
}

export function parseDonationPaymentMethodSelection(value: string): {
  type: "contact" | "org"
  id: string
} | null {
  if (value.startsWith(CONTACT_PAYMENT_METHOD_PREFIX)) {
    return { type: "contact", id: value.slice(CONTACT_PAYMENT_METHOD_PREFIX.length) }
  }
  if (value.startsWith(ORG_PAYMENT_METHOD_PREFIX)) {
    return { type: "org", id: value.slice(ORG_PAYMENT_METHOD_PREFIX.length) }
  }
  return null
}

export function formatContactCardLabel(card: ContactPaymentMethodRow) {
  return `${card.cardBrand || "Card"} •••• ${card.last4}`
}

export function getDefaultDonationPaymentMethodSelection(
  contactPaymentMethods: ContactPaymentMethodRow[],
  organizationPaymentMethods: OrganizationPaymentMethodOption[]
) {
  const defaultCard =
    contactPaymentMethods.find((method) => method.isDefault) ?? contactPaymentMethods[0]
  if (defaultCard) return toContactPaymentMethodSelectionId(defaultCard.id)
  if (organizationPaymentMethods[0]) {
    return toOrgPaymentMethodSelectionId(organizationPaymentMethods[0].id)
  }
  return ""
}

export function isDonationOnlinePaymentSelection(
  selectionId: string,
  organizationPaymentMethods: OrganizationPaymentMethodOption[]
) {
  const parsed = parseDonationPaymentMethodSelection(selectionId)
  if (parsed?.type === "contact") return true
  if (parsed?.type === "org") {
    const method = organizationPaymentMethods.find((item) => item.id === parsed.id)
    return isStripeCheckoutPaymentMethod(method?.name)
  }
  return false
}

export function resolveDonationPaymentMethodLabel(
  selectionId: string,
  contactPaymentMethods: ContactPaymentMethodRow[],
  organizationPaymentMethods: OrganizationPaymentMethodOption[]
) {
  const parsed = parseDonationPaymentMethodSelection(selectionId)
  if (parsed?.type === "contact") {
    const card = contactPaymentMethods.find((method) => method.id === parsed.id)
    return card ? formatContactCardLabel(card) : "Card on file"
  }
  if (parsed?.type === "org") {
    const method = organizationPaymentMethods.find((item) => item.id === parsed.id)
    return method?.name || "Unknown"
  }
  return "Unknown"
}

type CustomerDonationPaymentPickerProps = {
  contactId: string
  contactPaymentMethods: ContactPaymentMethodRow[]
  organizationPaymentMethods: OrganizationPaymentMethodOption[]
  selectedPaymentMethodId: string
  onSelectedPaymentMethodIdChange: (value: string) => void
  onContactPaymentMethodsChange: (methods: ContactPaymentMethodRow[]) => void
}

export function CustomerDonationPaymentPicker({
  contactId,
  contactPaymentMethods,
  organizationPaymentMethods,
  selectedPaymentMethodId,
  onSelectedPaymentMethodIdChange,
  onContactPaymentMethodsChange,
}: CustomerDonationPaymentPickerProps) {
  const [showAddCard, setShowAddCard] = useState(false)
  const [savingCard, setSavingCard] = useState(false)
  const [addCardError, setAddCardError] = useState<string | null>(null)
  const [cardBrand, setCardBrand] = useState("Visa")
  const [cardNumber, setCardNumber] = useState("")
  const [securityCode, setSecurityCode] = useState("")
  const [expirationDate, setExpirationDate] = useState("")
  const [cardholderName, setCardholderName] = useState("")

  function resetAddCardForm() {
    setCardBrand("Visa")
    setCardNumber("")
    setSecurityCode("")
    setExpirationDate("")
    setCardholderName("")
    setAddCardError(null)
  }

  async function handleAddPaymentMethod() {
    setSavingCard(true)
    setAddCardError(null)

    const result = await addCustomerContactPaymentMethodAction({
      contactId,
      cardBrand,
      cardNumber,
      securityCode,
      expirationDate,
      cardholderName,
      setAsDefault: contactPaymentMethods.length === 0,
    })

    setSavingCard(false)

    if (!result.success) {
      setAddCardError(result.error)
      return
    }

    const nextMethods = result.paymentMethod.isDefault
      ? [
          result.paymentMethod,
          ...contactPaymentMethods.map((method) => ({ ...method, isDefault: false })),
        ]
      : [...contactPaymentMethods, result.paymentMethod]

    onContactPaymentMethodsChange(nextMethods)
    onSelectedPaymentMethodIdChange(toContactPaymentMethodSelectionId(result.paymentMethod.id))
    setShowAddCard(false)
    resetAddCardForm()
  }

  const hasAnyPaymentOption =
    contactPaymentMethods.length > 0 || organizationPaymentMethods.length > 0

  return (
    <>
      <div className="flex flex-col gap-2">
        <Label>Payment Method</Label>
        {!hasAnyPaymentOption ? (
          <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            No payment methods are available yet. Add a card to continue.
          </div>
        ) : (
          <RadioGroup
            value={selectedPaymentMethodId}
            onValueChange={onSelectedPaymentMethodIdChange}
            className="flex flex-col gap-2"
          >
            {contactPaymentMethods.map((method) => (
              <div
                key={method.id}
                className="flex items-center gap-3 rounded-lg border p-3"
              >
                <RadioGroupItem
                  value={toContactPaymentMethodSelectionId(method.id)}
                  id={`donate-card-${method.id}`}
                />
                <Label
                  htmlFor={`donate-card-${method.id}`}
                  className="flex-1 cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-muted-foreground" />
                      <span>{formatContactCardLabel(method)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {method.isDefault ? (
                        <Badge variant="secondary" className="text-xs">
                          Default
                        </Badge>
                      ) : null}
                      <Badge variant="default" className="text-xs">
                        Pay online
                      </Badge>
                    </div>
                  </div>
                  {method.expMonth && method.expYear ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Expires {String(method.expMonth).padStart(2, "0")}/{method.expYear}
                    </p>
                  ) : null}
                </Label>
              </div>
            ))}

            {organizationPaymentMethods.map((method) => {
              const isOnline = isStripeCheckoutPaymentMethod(method.name)
              return (
                <div key={method.id} className="flex items-center gap-3 rounded-lg border p-3">
                  <RadioGroupItem
                    value={toOrgPaymentMethodSelectionId(method.id)}
                    id={`donate-org-${method.id}`}
                  />
                  <Label htmlFor={`donate-org-${method.id}`} className="flex-1 cursor-pointer">
                    <div className="flex items-center justify-between gap-2">
                      <span>{method.name}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant={isOnline ? "default" : "outline"} className="text-xs">
                          {isOnline ? "Pay online" : "Record offline"}
                        </Badge>
                        {method.fee ? (
                          <Badge variant="secondary" className="text-xs">
                            {method.fee}
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                  </Label>
                </div>
              )
            })}
          </RadioGroup>
        )}

        <Button
          variant="ghost"
          size="sm"
          className="w-fit text-primary"
          onClick={() => setShowAddCard(true)}
        >
          <Plus className="mr-1 h-4 w-4" />
          Add new card
        </Button>
      </div>

      <Dialog
        open={showAddCard}
        onOpenChange={(open) => {
          setShowAddCard(open)
          if (!open) resetAddCardForm()
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add card</DialogTitle>
            <DialogDescription>
              Enter the full card at save time. Only the last 4 digits and expiration are kept on
              your profile.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {addCardError ? <p className="text-sm text-destructive">{addCardError}</p> : null}
            <div className="space-y-2">
              <Label>Card brand</Label>
              <Select value={cardBrand} onValueChange={setCardBrand}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CARD_BRANDS.map((brand) => (
                    <SelectItem key={brand} value={brand}>
                      {brand}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="donation-card-number">Card number</Label>
              <Input
                id="donation-card-number"
                inputMode="numeric"
                autoComplete="cc-number"
                value={cardNumber}
                onChange={(event) => setCardNumber(formatCardNumberInput(event.target.value))}
                placeholder="4242 4242 4242 4242"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="donation-card-expiration">Expiration</Label>
                <Input
                  id="donation-card-expiration"
                  inputMode="numeric"
                  autoComplete="cc-exp"
                  maxLength={7}
                  value={expirationDate}
                  onChange={(event) => setExpirationDate(formatExpirationInput(event.target.value))}
                  placeholder="MM/YYYY"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="donation-card-cvc">Security code</Label>
                <Input
                  id="donation-card-cvc"
                  inputMode="numeric"
                  autoComplete="cc-csc"
                  maxLength={cardBrand.toLowerCase().includes("american express") ? 4 : 3}
                  value={securityCode}
                  onChange={(event) =>
                    setSecurityCode(event.target.value.replace(/\D/g, "").slice(0, 4))
                  }
                  placeholder={cardBrand.toLowerCase().includes("american express") ? "1234" : "123"}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="donation-cardholder">Cardholder name</Label>
              <Input
                id="donation-cardholder"
                autoComplete="cc-name"
                value={cardholderName}
                onChange={(event) => setCardholderName(event.target.value)}
                placeholder="Name on card"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddCard(false)} disabled={savingCard}>
              Cancel
            </Button>
            <Button onClick={() => void handleAddPaymentMethod()} disabled={savingCard}>
              {savingCard ? "Saving..." : "Save card"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
