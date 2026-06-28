"use client"

import { useState } from "react"
import { CreditCard, Plus, Trash2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
  addContactPaymentMethodAction,
  removeContactPaymentMethodAction,
  setDefaultContactPaymentMethodAction,
  type ContactPaymentMethodRow,
} from "@/lib/contacts/contact-payment-method-actions"
import {
  formatCardNumberInput,
  formatExpirationInput,
  parseCardExpiration,
  validateCardNumber,
  validateSecurityCode,
} from "@/lib/contacts/contact-payment-method-validation"

type ContactPaymentMethodsPanelProps = {
  contactId: string
  paymentMethods: ContactPaymentMethodRow[]
  compact?: boolean
}

const CARD_BRANDS = ["Visa", "Mastercard", "American Express", "Discover", "Other"]

export function ContactPaymentMethodsPanel({
  contactId,
  paymentMethods: initialPaymentMethods,
  compact = false,
}: ContactPaymentMethodsPanelProps) {
  const [paymentMethods, setPaymentMethods] = useState(initialPaymentMethods)
  const [showAddCard, setShowAddCard] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
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
    setError(null)
  }

  async function handleAddPaymentMethod() {
    const cardNumberError = validateCardNumber(cardNumber)
    if (cardNumberError) {
      setError(cardNumberError)
      return
    }

    const securityCodeError = validateSecurityCode(securityCode, cardBrand)
    if (securityCodeError) {
      setError(securityCodeError)
      return
    }

    const parsedExpiration = parseCardExpiration(expirationDate)
    if (!parsedExpiration.ok) {
      setError(parsedExpiration.error)
      return
    }

    setSaving(true)
    setError(null)
    const result = await addContactPaymentMethodAction({
      contactId,
      cardBrand,
      cardNumber,
      securityCode,
      expirationDate,
      cardholderName,
      setAsDefault: paymentMethods.length === 0,
    })
    setSaving(false)

    if (!result.success) {
      setError(result.error)
      return
    }

    setPaymentMethods((current) => {
      const next = result.paymentMethod.isDefault
        ? current.map((method) => ({ ...method, isDefault: false }))
        : current
      return [result.paymentMethod, ...next]
    })
    setShowAddCard(false)
    resetAddCardForm()
  }

  async function handleSetDefault(paymentMethodId: string) {
    const result = await setDefaultContactPaymentMethodAction({ contactId, paymentMethodId })
    if (!result.success) {
      setError(result.error)
      return
    }
    setPaymentMethods((current) =>
      current.map((method) => ({
        ...method,
        isDefault: method.id === paymentMethodId,
      }))
    )
  }

  async function handleRemove(paymentMethodId: string) {
    const result = await removeContactPaymentMethodAction({ contactId, paymentMethodId })
    if (!result.success) {
      setError(result.error)
      return
    }
    setPaymentMethods((current) => current.filter((method) => method.id !== paymentMethodId))
  }

  return (
    <>
      <Card>
        <CardHeader
          className={
            compact
              ? "flex flex-row items-center justify-between space-y-0 px-4 py-3"
              : "flex flex-row items-center justify-between space-y-0"
          }
        >
          <div>
            <CardTitle
              className={
                compact
                  ? "flex items-center gap-2 text-sm"
                  : "flex items-center gap-2 text-base"
              }
            >
              <CreditCard className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
              Payment methods
            </CardTitle>
            {!compact ? (
              <CardDescription>
                Credit and debit cards stored on this contact profile.
              </CardDescription>
            ) : null}
          </div>
          <Button size="sm" className={compact ? "h-8 px-2.5 text-xs" : undefined} onClick={() => setShowAddCard(true)}>
            <Plus className={compact ? "mr-1 h-3.5 w-3.5" : "mr-2 h-4 w-4"} />
            Add Card
          </Button>
        </CardHeader>
        <CardContent className={compact ? "space-y-3 px-4 pb-4 pt-0" : "space-y-4"}>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          {paymentMethods.length === 0 ? (
            <div
              className={
                compact
                  ? "flex flex-col items-center justify-center py-4 text-center"
                  : "flex flex-col items-center justify-center py-8 text-center"
              }
            >
              <CreditCard
                className={
                  compact
                    ? "mb-2 h-7 w-7 text-muted-foreground/50"
                    : "mb-3 h-10 w-10 text-muted-foreground/50"
                }
              />
              <p className={compact ? "text-xs font-medium" : "text-sm font-medium"}>No cards on file</p>
              {!compact ? (
                <p className="mt-1 max-w-md text-xs text-muted-foreground">
                  Add a card to keep payment details on this contact. Full card numbers are never
                  stored in Manaratee.
                </p>
              ) : null}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {paymentMethods.map((method) => (
                <div
                  key={method.id}
                  className={
                    compact
                      ? "flex flex-col gap-2 rounded-md border border-border bg-muted/30 p-3"
                      : "flex flex-col gap-3 rounded-lg border border-border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between"
                  }
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={compact ? "text-xs font-medium" : "text-sm font-medium"}>
                        {method.cardBrand || "Card"} •••• {method.last4}
                      </span>
                      {method.isDefault ? (
                        <Badge className={compact ? "px-1.5 py-0 text-[10px]" : undefined}>Default</Badge>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      {method.expMonth && method.expYear ? (
                        <span>
                          Expires {String(method.expMonth).padStart(2, "0")}/{method.expYear}
                        </span>
                      ) : null}
                      {method.cardholderName ? <span>{method.cardholderName}</span> : null}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {!method.isDefault ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className={compact ? "h-7 px-2 text-xs" : undefined}
                        onClick={() => void handleSetDefault(method.id)}
                      >
                        Make default
                      </Button>
                    ) : null}
                    <Button
                      variant="ghost"
                      size="sm"
                      className={compact ? "h-7 w-7 px-0" : undefined}
                      onClick={() => void handleRemove(method.id)}
                    >
                      <Trash2 className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

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
              the contact profile. Full card numbers and security codes are never stored in
              Manaratee.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
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
              <Label htmlFor="contact-card-number">Card number</Label>
              <Input
                id="contact-card-number"
                inputMode="numeric"
                autoComplete="cc-number"
                value={cardNumber}
                onChange={(event) => setCardNumber(formatCardNumberInput(event.target.value))}
                placeholder="4242 4242 4242 4242"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contact-card-expiration">Expiration</Label>
                <Input
                  id="contact-card-expiration"
                  inputMode="numeric"
                  autoComplete="cc-exp"
                  maxLength={7}
                  value={expirationDate}
                  onChange={(event) =>
                    setExpirationDate(formatExpirationInput(event.target.value))
                  }
                  placeholder="MM/YYYY"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact-card-cvc">Security code</Label>
                <Input
                  id="contact-card-cvc"
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
              <Label htmlFor="contact-cardholder">Cardholder name</Label>
              <Input
                id="contact-cardholder"
                autoComplete="cc-name"
                value={cardholderName}
                onChange={(event) => setCardholderName(event.target.value)}
                placeholder="Name on card"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddCard(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={() => void handleAddPaymentMethod()} disabled={saving}>
              {saving ? "Saving..." : "Save card"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
