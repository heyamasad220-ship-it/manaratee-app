import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  deriveVenueRentalPaymentLedgerStatus,
  deriveVenueRentalStaffNextAction,
  matchesVenueRentalPaymentLedgerView,
  rentalHasFinancialActivity,
  resolveVenueRentalDiscountDollarAmount,
  summarizeVenueRentalPaymentLedger,
  venueRentalChargePaymentTypeForAddon,
} from "./venue-rental-payment-ledger"
import {
  RENTAL_PAYMENT_STATUSES,
  RENTAL_PAYMENT_TYPES,
  VENUE_RENTAL_STATUSES,
  type RentalPaymentRecord,
} from "./venue-rental-types"

function payment(
  overrides: Partial<RentalPaymentRecord> &
    Pick<RentalPaymentRecord, "payment_type" | "status" | "amount">
): RentalPaymentRecord {
  return {
    id: overrides.id || "p1",
    organization_id: "org",
    venue_rental_id: "r1",
    currency: "USD",
    due_at: overrides.due_at ?? null,
    paid_at: overrides.paid_at ?? null,
    notes: null,
    stripe_payment_intent_id: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  }
}

describe("summarizeVenueRentalPaymentLedger", () => {
  it("sums all completed payments into received, not deposit only", () => {
    const summary = summarizeVenueRentalPaymentLedger([
      payment({
        payment_type: RENTAL_PAYMENT_TYPES.deposit,
        status: RENTAL_PAYMENT_STATUSES.paidManually,
        amount: 100,
      }),
      payment({
        id: "p2",
        payment_type: RENTAL_PAYMENT_TYPES.remainingBalance,
        status: RENTAL_PAYMENT_STATUSES.paidStripeLater,
        amount: 400,
      }),
      payment({
        id: "p3",
        payment_type: RENTAL_PAYMENT_TYPES.securityDeposit,
        status: RENTAL_PAYMENT_STATUSES.paymentRequested,
        amount: 200,
      }),
    ])

    assert.equal(summary.totalCharges, 700)
    assert.equal(summary.amountReceived, 500)
    assert.equal(summary.balanceDue, 200)
    assert.equal(summary.hasManualPayment, true)
    assert.equal(summary.hasOnlinePayment, true)
  })

  it("excludes refund rows from charges and received", () => {
    const summary = summarizeVenueRentalPaymentLedger([
      payment({
        payment_type: RENTAL_PAYMENT_TYPES.deposit,
        status: RENTAL_PAYMENT_STATUSES.paidManually,
        amount: 300,
      }),
      payment({
        id: "ref",
        payment_type: RENTAL_PAYMENT_TYPES.refund,
        status: RENTAL_PAYMENT_STATUSES.refunded,
        amount: 50,
      }),
    ])

    assert.equal(summary.totalCharges, 300)
    assert.equal(summary.amountReceived, 300)
    assert.equal(summary.refundedAmount, 50)
  })
})

describe("deriveVenueRentalPaymentLedgerStatus", () => {
  it("marks unpaid, partial, paid, and overdue", () => {
    assert.equal(
      deriveVenueRentalPaymentLedgerStatus({
        rentalStatus: VENUE_RENTAL_STATUSES.approvedPendingPayment,
        totalCharges: 500,
        amountReceived: 0,
        balanceDue: 500,
        unappliedCredit: 0,
        refundableSecurity: 0,
        refundedAmount: 0,
        paymentDueAt: "2099-01-01T00:00:00.000Z",
      }),
      "unpaid"
    )

    assert.equal(
      deriveVenueRentalPaymentLedgerStatus({
        rentalStatus: VENUE_RENTAL_STATUSES.confirmed,
        totalCharges: 500,
        amountReceived: 200,
        balanceDue: 300,
        unappliedCredit: 0,
        refundableSecurity: 0,
        refundedAmount: 0,
        paymentDueAt: "2099-01-01T00:00:00.000Z",
      }),
      "partial"
    )

    assert.equal(
      deriveVenueRentalPaymentLedgerStatus({
        rentalStatus: VENUE_RENTAL_STATUSES.confirmed,
        totalCharges: 500,
        amountReceived: 500,
        balanceDue: 0,
        unappliedCredit: 0,
        refundableSecurity: 0,
        refundedAmount: 0,
        paymentDueAt: null,
      }),
      "paid"
    )

    assert.equal(
      deriveVenueRentalPaymentLedgerStatus({
        rentalStatus: VENUE_RENTAL_STATUSES.approvedPendingPayment,
        totalCharges: 500,
        amountReceived: 0,
        balanceDue: 500,
        unappliedCredit: 0,
        refundableSecurity: 0,
        refundedAmount: 0,
        paymentDueAt: "2020-01-01T00:00:00.000Z",
        now: new Date("2026-07-01T00:00:00.000Z"),
      }),
      "overdue"
    )
  })

  it("uses no_charges for zero totals (never auto complimentary)", () => {
    assert.equal(
      deriveVenueRentalPaymentLedgerStatus({
        rentalStatus: VENUE_RENTAL_STATUSES.submitted,
        totalCharges: 0,
        amountReceived: 0,
        balanceDue: 0,
        unappliedCredit: 0,
        refundableSecurity: 0,
        refundedAmount: 0,
        paymentDueAt: null,
      }),
      "no_charges"
    )

    assert.equal(
      deriveVenueRentalPaymentLedgerStatus({
        rentalStatus: VENUE_RENTAL_STATUSES.confirmed,
        totalCharges: 0,
        amountReceived: 0,
        balanceDue: 0,
        unappliedCredit: 0,
        refundableSecurity: 0,
        refundedAmount: 0,
        paymentDueAt: null,
      }),
      "no_charges"
    )
  })

  it("prioritizes refund due and refunded", () => {
    assert.equal(
      deriveVenueRentalPaymentLedgerStatus({
        rentalStatus: VENUE_RENTAL_STATUSES.awaitingSecurityDepositRefundApproval,
        totalCharges: 700,
        amountReceived: 700,
        balanceDue: 0,
        unappliedCredit: 0,
        refundableSecurity: 200,
        refundedAmount: 0,
        paymentDueAt: null,
      }),
      "refund_due"
    )

    assert.equal(
      deriveVenueRentalPaymentLedgerStatus({
        rentalStatus: VENUE_RENTAL_STATUSES.securityDepositRefunded,
        totalCharges: 700,
        amountReceived: 700,
        balanceDue: 0,
        unappliedCredit: 0,
        refundableSecurity: 0,
        refundedAmount: 200,
        paymentDueAt: null,
      }),
      "refunded"
    )
  })
})

describe("ledger view matching", () => {
  it("hides no-charge rentals from the default financial view", () => {
    assert.equal(
      matchesVenueRentalPaymentLedgerView("financial", "no_charges", {
        includeNoCharges: false,
        hasFinancialActivity: false,
      }),
      false
    )

    assert.equal(
      matchesVenueRentalPaymentLedgerView("financial", "unpaid", {
        hasFinancialActivity: true,
      }),
      true
    )
  })
})

describe("staff next action", () => {
  it("suggests collect payment, remaining, or add charges", () => {
    assert.equal(
      deriveVenueRentalStaffNextAction({
        rentalId: "r1",
        paymentStatus: "no_charges",
        balanceDue: 0,
      }).label,
      "Add Charges"
    )

    assert.equal(
      deriveVenueRentalStaffNextAction({
        rentalId: "r1",
        paymentStatus: "unpaid",
        balanceDue: 500,
      }).label,
      "Collect Payment"
    )

    assert.equal(
      deriveVenueRentalStaffNextAction({
        rentalId: "r1",
        paymentStatus: "partial",
        balanceDue: 400,
      }).label,
      "Collect Remaining Balance"
    )

    assert.equal(
      deriveVenueRentalStaffNextAction({
        rentalId: "r1",
        paymentStatus: "paid",
        balanceDue: 0,
      }).label,
      "No Action Needed"
    )
  })
})

describe("rentalHasFinancialActivity", () => {
  it("requires meaningful financial signal", () => {
    assert.equal(
      rentalHasFinancialActivity({
        rentalStatus: VENUE_RENTAL_STATUSES.confirmed,
        totalCharges: 0,
        amountReceived: 0,
        refundedAmount: 0,
        balanceDue: 0,
        paymentStatus: "no_charges",
        paymentCount: 0,
      }),
      false
    )

    assert.equal(
      rentalHasFinancialActivity({
        rentalStatus: VENUE_RENTAL_STATUSES.approvedPendingPayment,
        totalCharges: 100,
        amountReceived: 0,
        refundedAmount: 0,
        balanceDue: 100,
        paymentStatus: "unpaid",
        paymentCount: 1,
      }),
      true
    )
  })

  it("hides declined and cancelled-before-payment when nothing was collected", () => {
    assert.equal(
      rentalHasFinancialActivity({
        rentalStatus: VENUE_RENTAL_STATUSES.declined,
        totalCharges: 800,
        amountReceived: 0,
        refundedAmount: 0,
        balanceDue: 800,
        paymentStatus: "unpaid",
        paymentCount: 0,
      }),
      false
    )

    assert.equal(
      rentalHasFinancialActivity({
        rentalStatus: VENUE_RENTAL_STATUSES.cancelledBeforePayment,
        totalCharges: 2000,
        amountReceived: 0,
        refundedAmount: 0,
        balanceDue: 2000,
        paymentStatus: "unpaid",
        paymentCount: 1,
      }),
      false
    )
  })

  it("keeps cancelled-after-payment on Payments for refund settlement", () => {
    assert.equal(
      rentalHasFinancialActivity({
        rentalStatus: VENUE_RENTAL_STATUSES.cancelledAfterPayment,
        totalCharges: 2000,
        amountReceived: 500,
        refundedAmount: 0,
        balanceDue: 1500,
        paymentStatus: "partial",
        paymentCount: 1,
      }),
      true
    )
  })
})

describe("resolveVenueRentalDiscountDollarAmount", () => {
  it("returns fixed amounts and percent of basis", () => {
    assert.equal(
      resolveVenueRentalDiscountDollarAmount({
        discountType: "fixed",
        amount: 150,
      }),
      150
    )
    assert.equal(
      resolveVenueRentalDiscountDollarAmount({
        discountType: "percent",
        amount: 20,
        basisAmount: 1000,
      }),
      200
    )
  })

  it("rejects invalid percent input", () => {
    assert.throws(() =>
      resolveVenueRentalDiscountDollarAmount({
        discountType: "percent",
        amount: 120,
        basisAmount: 1000,
      })
    )
    assert.throws(() =>
      resolveVenueRentalDiscountDollarAmount({
        discountType: "percent",
        amount: 10,
        basisAmount: 0,
      })
    )
  })
})

describe("venueRentalChargePaymentTypeForAddon", () => {
  it("maps cleaning and damage add-ons to ledger types", () => {
    assert.equal(
      venueRentalChargePaymentTypeForAddon({ slug: "extra-cleaning" }),
      "cleaning_fee"
    )
    assert.equal(
      venueRentalChargePaymentTypeForAddon({ slug: "damage-charge" }),
      "adjustment"
    )
    assert.equal(
      venueRentalChargePaymentTypeForAddon({
        slug: "table-covers",
        name: "Table Covers",
      }),
      "addon_fee"
    )
  })
})
