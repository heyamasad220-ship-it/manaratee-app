"use client"

import { useState } from "react"
import Link from "next/link"
import { Header } from "@/components/layout/header"
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  formatSubscriptionPrice,
  type OrganizationSubscriptionSummary,
} from "@/lib/organizations/organization-subscription-types"
import { formatDisplayDate } from "@/lib/organizations/organization-subscription-terms"
import {
  addOrganizationPaymentMethodAction,
  removeOrganizationPaymentMethodAction,
  setDefaultOrganizationPaymentMethodAction,
  type OrganizationBillingInvoiceRow,
  type OrganizationPaymentMethodRow,
} from "@/lib/organizations/organization-billing-actions"
import { CreditCard, CalendarDays, History, Layers, Mail, Package, Plus, Trash2 } from "lucide-react"

type OrganizationBillingClientProps = {
  summary: OrganizationSubscriptionSummary
  billingEmail: string | null
  paymentMethods: OrganizationPaymentMethodRow[]
  invoices: OrganizationBillingInvoiceRow[]
}

const CARD_BRANDS = ["Visa", "Mastercard", "American Express", "Discover", "Other"]

function formatCurrency(amount: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount)
}

function formatDate(value: string | null) {
  if (!value) return "—"
  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function formatInvoiceStatus(status: string) {
  const normalized = status.toLowerCase()
  if (normalized === "paid") return "Paid"
  if (normalized === "pending") return "Pending"
  if (normalized === "failed") return "Failed"
  if (normalized === "refunded") return "Refunded"
  return status
}

function invoiceStatusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  const normalized = status.toLowerCase()
  if (normalized === "paid") return "default"
  if (normalized === "failed") return "destructive"
  if (normalized === "refunded") return "outline"
  return "secondary"
}

export function OrganizationBillingClient({
  summary,
  billingEmail,
  paymentMethods: initialPaymentMethods,
  invoices,
}: OrganizationBillingClientProps) {
  const [paymentMethods, setPaymentMethods] = useState(initialPaymentMethods)
  const [showAddCard, setShowAddCard] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cardBrand, setCardBrand] = useState("Visa")
  const [last4, setLast4] = useState("")
  const [expMonth, setExpMonth] = useState("")
  const [expYear, setExpYear] = useState("")
  const [cardholderName, setCardholderName] = useState("")

  const yearlySavings =
    summary.plan && summary.plan.monthlyPrice > 0 && summary.plan.yearlyPrice > 0
      ? summary.plan.monthlyPrice * 12 - summary.plan.yearlyPrice
      : 0
  const terms = summary.subscriptionTerms

  async function handleAddPaymentMethod() {
    setSaving(true)
    setError(null)
    const result = await addOrganizationPaymentMethodAction({
      cardBrand,
      last4,
      expMonth: Number(expMonth),
      expYear: Number(expYear),
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
    setLast4("")
    setExpMonth("")
    setExpYear("")
    setCardholderName("")
  }

  async function handleSetDefault(paymentMethodId: string) {
    const result = await setDefaultOrganizationPaymentMethodAction(paymentMethodId)
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
    if (!confirm("Remove this payment method?")) return
    const result = await removeOrganizationPaymentMethodAction(paymentMethodId)
    if (!result.success) {
      setError(result.error)
      return
    }
    setPaymentMethods((current) => current.filter((method) => method.id !== paymentMethodId))
  }

  return (
    <>
      <Header title="Billing" />

      <div className="space-y-6 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Plan &amp; billing</h2>
            <p className="text-sm text-muted-foreground">
              Subscription plan, payment methods, and billing history for {summary.organizationName}.
              {billingEmail ? ` Billing email: ${billingEmail}.` : null}
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link href="mailto:support@manaratee.com?subject=Subscription%20change%20request">
              <Mail className="mr-2 h-4 w-4" />
              Request plan change
            </Link>
          </Button>
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <CalendarDays className="h-4 w-4" />
                Subscription start
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                {formatDisplayDate(terms.subscriptionStartDate)}
              </p>
              {terms.paidBillingStartsDate &&
              terms.complimentaryMonths > 0 &&
              terms.isInComplimentaryPeriod ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  {terms.complimentaryMonths === 1
                    ? "1 complimentary month"
                    : `${terms.complimentaryMonths} complimentary months`}{" "}
                  — paid billing begins {formatDisplayDate(terms.paidBillingStartsDate)}
                </p>
              ) : terms.paidBillingStartsDate &&
                terms.complimentaryMonths > 0 &&
                !terms.isInComplimentaryPeriod ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  Complimentary period ended — paid billing began{" "}
                  {formatDisplayDate(terms.paidBillingStartsDate)}
                </p>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">
                  {terms.subscriptionStartDate
                    ? "Billing follows your assigned plan terms."
                    : "Start date will be set by Manaratee platform administrators."}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <CreditCard className="h-4 w-4" />
                Current plan
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{summary.plan?.name ?? "No plan assigned"}</p>
              {summary.plan?.description ? (
                <p className="mt-2 text-sm text-muted-foreground">{summary.plan.description}</p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Bundle price</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{summary.billingLabel}</p>
              {terms.hasFirstYearSpecialRate && terms.firstYearEndsDate ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  Standard rate after first year:{" "}
                  {formatSubscriptionPrice(terms.standardMonthlyRate)}/month
                </p>
              ) : null}
              {summary.plan && summary.plan.yearlyPrice > 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  or {formatSubscriptionPrice(summary.plan.yearlyPrice)}/year
                  {yearlySavings > 0
                    ? ` (save ${formatSubscriptionPrice(yearlySavings)} vs monthly)`
                    : ""}
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Package className="h-4 w-4" />
                Persona bundle
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{summary.bundleName ?? "Custom mix"}</p>
              {summary.bundleDescription ? (
                <p className="mt-2 text-sm text-muted-foreground">{summary.bundleDescription}</p>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">
                  Modules were configured individually for your organization.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {terms.pricingNotes.length > 0 ? (
          <Card className="border-amber-200 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Subscription notes</CardTitle>
              <CardDescription>
                Terms set by Manaratee for your organization&apos;s platform subscription.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="list-disc space-y-2 pl-5 text-sm text-muted-foreground">
                {terms.pricingNotes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : null}

        {(summary.plan?.memberLimit != null || summary.plan?.eventLimit != null) && (
          <Card>
            <CardHeader>
              <CardTitle>Plan limits</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-6 text-sm">
              {summary.plan?.memberLimit != null ? (
                <div>
                  <p className="text-muted-foreground">Member limit</p>
                  <p className="font-medium">{summary.plan.memberLimit.toLocaleString()}</p>
                </div>
              ) : null}
              {summary.plan?.eventLimit != null ? (
                <div>
                  <p className="text-muted-foreground">Event limit</p>
                  <p className="font-medium">{summary.plan.eventLimit.toLocaleString()}</p>
                </div>
              ) : null}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Payment methods
              </CardTitle>
              <CardDescription>Cards on file for your Manaratee subscription.</CardDescription>
            </div>
            <Button onClick={() => setShowAddCard(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add payment method
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {paymentMethods.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-muted-foreground">
                No payment methods on file. Add a card to keep billing current.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Card</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Cardholder</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paymentMethods.map((method) => (
                    <TableRow key={method.id}>
                      <TableCell className="font-medium">
                        {method.cardBrand || "Card"} •••• {method.last4}
                      </TableCell>
                      <TableCell>
                        {method.expMonth && method.expYear
                          ? `${String(method.expMonth).padStart(2, "0")}/${method.expYear}`
                          : "—"}
                      </TableCell>
                      <TableCell>{method.cardholderName || "—"}</TableCell>
                      <TableCell>
                        {method.isDefault ? (
                          <Badge>Default</Badge>
                        ) : (
                          <Badge variant="outline">Backup</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {!method.isDefault ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => void handleSetDefault(method.id)}
                            >
                              Make default
                            </Button>
                          ) : null}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void handleRemove(method.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Billing history
            </CardTitle>
            <CardDescription>Platform subscription invoices for your organization.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {invoices.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-muted-foreground">
                No billing history yet. Invoices will appear here after your first platform charge.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((invoice) => (
                    <TableRow key={invoice.id}>
                      <TableCell>{formatDate(invoice.paidAt || invoice.createdAt)}</TableCell>
                      <TableCell>{invoice.description || "Platform subscription"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {invoice.periodStart && invoice.periodEnd
                          ? `${formatDate(invoice.periodStart)} – ${formatDate(invoice.periodEnd)}`
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={invoiceStatusVariant(invoice.status)}>
                          {formatInvoiceStatus(invoice.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(invoice.amount, invoice.currency)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5" />
              Enabled product modules
            </CardTitle>
            <CardDescription>
              Billable modules included in your plan bundle.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Module</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Source</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.productModules.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                      No product modules are enabled yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  summary.productModules.map((module) => (
                    <TableRow key={module.slug}>
                      <TableCell className="font-medium">{module.name}</TableCell>
                      <TableCell className="max-w-md text-muted-foreground">
                        {module.description || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {module.enabledByPlan
                            ? "Included in plan"
                            : module.manuallyOverridden
                              ? "Platform add-on"
                              : "Enabled"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {summary.capabilityModules.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Included capabilities</CardTitle>
              <CardDescription>
                Supporting features automatically enabled with your product modules.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {summary.capabilityModules.map((module) => (
                  <Badge key={module.slug} variant="outline">
                    {module.name}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Always included</CardTitle>
            <CardDescription>Core platform modules included with every organization.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {summary.coreModules.map((module) => (
                <Badge key={module.slug} variant="secondary">
                  {module.name}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground">
          Billing and plan changes are managed by Manaratee platform administrators. Contact
          support to update your subscription plan.
        </p>
      </div>

      <Dialog open={showAddCard} onOpenChange={setShowAddCard}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add payment method</DialogTitle>
            <DialogDescription>
              Store a card on file for your organization&apos;s Manaratee subscription. Full card
              numbers are never stored in Manaratee.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
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
              <Label htmlFor="billing-last4">Last 4 digits</Label>
              <Input
                id="billing-last4"
                inputMode="numeric"
                maxLength={4}
                value={last4}
                onChange={(event) => setLast4(event.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="4242"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="billing-exp-month">Exp. month</Label>
                <Input
                  id="billing-exp-month"
                  inputMode="numeric"
                  maxLength={2}
                  value={expMonth}
                  onChange={(event) => setExpMonth(event.target.value.replace(/\D/g, "").slice(0, 2))}
                  placeholder="12"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="billing-exp-year">Exp. year</Label>
                <Input
                  id="billing-exp-year"
                  inputMode="numeric"
                  maxLength={4}
                  value={expYear}
                  onChange={(event) => setExpYear(event.target.value.replace(/\D/g, "").slice(0, 4))}
                  placeholder="2028"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="billing-cardholder">Cardholder name</Label>
              <Input
                id="billing-cardholder"
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
              {saving ? "Saving..." : "Save payment method"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
