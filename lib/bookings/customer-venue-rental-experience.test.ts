import assert from "node:assert/strict"
import { describe, it } from "node:test"

import type { CustomerRentalFinancialContext } from "./customer-venue-rental-dtos"
import {
  getCustomerFriendlyStatusLabel,
  getCustomerRentalNextAction,
  getCustomerRentalTimelineStages,
  isCustomerHistoryStatus,
  partitionCustomerVenueRentals,
  partitionCustomerVenueRentalsForDashboard,
} from "./customer-venue-rental-experience"
import type { VenueRentalQueueRow } from "./venue-rental-types"
import { VENUE_RENTAL_STATUSES } from "./venue-rental-types"

function baseRental(overrides: Partial<VenueRentalQueueRow> = {}): VenueRentalQueueRow {
  return {
    id: "rental-1",
    shortId: "VR-001",
    status: VENUE_RENTAL_STATUSES.awaitingSupervisorApproval,
    statusLabel: "Awaiting Supervisor Approval",
    calendarColor: "yellow",
    customerName: "Test Customer",
    customerEmail: "test@example.com",
    customerPhone: null,
    billingContactId: null,
    billingContactName: null,
    billingContactType: null,
    eventTypeId: null,
    eventTypeName: "Birthday Party",
    spaces: [
      {
        venueId: "venue-1",
        venueName: "Grand Hall",
        startAt: "2026-06-15T18:00:00.000Z",
        endAt: "2026-06-15T22:00:00.000Z",
      },
    ],
    addons: [],
    notes: "Please set up round tables",
    guestCount: 50,
    submittedAt: "2026-05-01T12:00:00.000Z",
    submittedAtLabel: "May 1, 2026",
    holdExpiresAt: null,
    hasConflict: false,
    hasReceivedPayment: false,
    policiesSentAt: null,
    policiesAgreedAt: null,
    policiesDocumentUrlSnapshot: null,
    pricingGuideUrlSnapshot: null,
    ...overrides,
  }
}

function financialContext(
  overrides: Partial<CustomerRentalFinancialContext> = {}
): CustomerRentalFinancialContext {
  return {
    payments: {
      deposit: null,
      securityDeposit: null,
      remainingBalance: null,
      outstandingBalance: 0,
      refundStatus: "none",
      refundLabel: null,
    },
    contract: null,
    ...overrides,
  }
}

describe("customer venue rental experience", () => {
  it("maps internal statuses to customer-friendly labels", () => {
    assert.equal(
      getCustomerFriendlyStatusLabel(VENUE_RENTAL_STATUSES.awaitingSupervisorApproval),
      "Request under review"
    )
    assert.equal(
      getCustomerFriendlyStatusLabel(VENUE_RENTAL_STATUSES.approvedPendingPayment),
      "Approved — pay deposit to confirm"
    )
    assert.equal(
      getCustomerFriendlyStatusLabel(VENUE_RENTAL_STATUSES.securityDepositRefunded),
      "Security deposit refunded"
    )
  })

  it("returns sign agreement next action when contract is sent", () => {
    const action = getCustomerRentalNextAction(
      baseRental({ status: VENUE_RENTAL_STATUSES.approvedPendingPayment }),
      financialContext({
        contract: {
          id: "contract-1",
          status: "Sent",
          documentUrl: "https://example.com/agreement.pdf",
          sentAt: "2026-05-02T12:00:00.000Z",
          signedAt: null,
          canDownload: true,
          canSign: true,
        },
      })
    )

    assert.equal(action.requiresAction, true)
    assert.equal(action.actionType, "sign_agreement")
    assert.match(action.label, /agreement/i)
    assert.match(action.label, /team/i)
  })

  it("returns staff-mediated payment action when deposit is due", () => {
    const action = getCustomerRentalNextAction(
      baseRental({ status: VENUE_RENTAL_STATUSES.approvedPendingPayment }),
      financialContext({
        payments: {
          deposit: {
            id: "pay-1",
            paymentType: "deposit",
            label: "Deposit",
            amount: 500,
            currency: "USD",
            dueDate: "2026-05-10T00:00:00.000Z",
            dueDateLabel: "May 10, 2026",
            status: "Unpaid",
            paidDate: null,
            paidDateLabel: null,
            isPaid: false,
            isDue: true,
          },
          securityDeposit: null,
          remainingBalance: null,
          outstandingBalance: 500,
          refundStatus: "none",
          refundLabel: null,
        },
      })
    )

    assert.equal(action.actionType, "pay_deposit")
    assert.equal(action.requiresAction, true)
    assert.match(action.label, /payment instructions/i)
  })

  it("partitions dashboard rentals into active and past", () => {
    const futureConfirmed = baseRental({
      id: "upcoming",
      status: VENUE_RENTAL_STATUSES.confirmed,
      spaces: [
        {
          venueId: "venue-1",
          venueName: "Grand Hall",
          startAt: "2099-06-15T18:00:00.000Z",
          endAt: "2099-06-15T22:00:00.000Z",
        },
      ],
    })
    const completed = baseRental({
      id: "history",
      status: VENUE_RENTAL_STATUSES.completed,
    })
    const needsPayment = baseRental({
      id: "action",
      status: VENUE_RENTAL_STATUSES.approvedPendingPayment,
    })

    const dashboard = partitionCustomerVenueRentalsForDashboard([
      futureConfirmed,
      completed,
      needsPayment,
    ])

    assert.equal(dashboard.active.length, 2)
    assert.equal(dashboard.past.length, 1)
    assert.equal(dashboard.active[0]?.id, "action")
  })

  it("partitions rentals into action required, upcoming, and history", () => {
    const futureConfirmed = baseRental({
      id: "upcoming",
      status: VENUE_RENTAL_STATUSES.confirmed,
      spaces: [
        {
          venueId: "venue-1",
          venueName: "Grand Hall",
          startAt: "2099-06-15T18:00:00.000Z",
          endAt: "2099-06-15T22:00:00.000Z",
        },
      ],
    })
    const completed = baseRental({
      id: "history",
      status: VENUE_RENTAL_STATUSES.completed,
    })
    const needsPayment = baseRental({
      id: "action",
      status: VENUE_RENTAL_STATUSES.approvedPendingPayment,
    })

    const sections = partitionCustomerVenueRentals([
      futureConfirmed,
      completed,
      needsPayment,
    ])

    assert.equal(sections.upcoming.length, 1)
    assert.equal(sections.history.length, 1)
    assert.equal(sections.actionRequired.length, 1)
  })

  it("marks history statuses correctly", () => {
    assert.equal(isCustomerHistoryStatus(VENUE_RENTAL_STATUSES.completed), true)
    assert.equal(isCustomerHistoryStatus(VENUE_RENTAL_STATUSES.declined), true)
    assert.equal(isCustomerHistoryStatus(VENUE_RENTAL_STATUSES.confirmed), false)
  })

  it("builds timeline stages through approval and payment", () => {
    const stages = getCustomerRentalTimelineStages({
      rental: baseRental({ status: VENUE_RENTAL_STATUSES.depositPaid }),
      approvedAt: "2026-05-02T12:00:00.000Z",
      context: financialContext({
        contract: {
          id: "contract-1",
          status: "Signed",
          documentUrl: null,
          sentAt: null,
          signedAt: "2026-05-03T12:00:00.000Z",
          canDownload: false,
          canSign: false,
        },
        payments: {
          deposit: {
            id: "pay-1",
            paymentType: "deposit",
            label: "Deposit",
            amount: 500,
            currency: "USD",
            dueDate: null,
            dueDateLabel: null,
            status: "Paid",
            paidDate: "2026-05-04T12:00:00.000Z",
            paidDateLabel: "May 4, 2026",
            isPaid: true,
            isDue: false,
          },
          securityDeposit: null,
          remainingBalance: null,
          outstandingBalance: 0,
          refundStatus: "none",
          refundLabel: null,
        },
      }),
    })

    assert.deepEqual(
      stages.map((stage) => stage.id),
      [
        "request_submitted",
        "request_approved",
        "deposit_paid",
        "reservation_confirmed",
        "full_balance_paid",
        "event_completed",
      ]
    )

    const submitted = stages.find((stage) => stage.id === "request_submitted")
    const approved = stages.find((stage) => stage.id === "request_approved")
    const deposit = stages.find((stage) => stage.id === "deposit_paid")
    const fullBalance = stages.find((stage) => stage.id === "full_balance_paid")

    assert.equal(submitted?.state, "complete")
    assert.equal(approved?.state, "complete")
    assert.equal(deposit?.state, "complete")
    assert.equal(fullBalance?.state, "upcoming")
    assert.match(fullBalance?.dateLabel || "", /^Due by /)
  })

  it("marks full balance paid when remaining balance is paid", () => {
    const stages = getCustomerRentalTimelineStages({
      rental: baseRental({
        status: VENUE_RENTAL_STATUSES.confirmed,
        spaces: [
          {
            venueId: "venue-1",
            venueName: "Hall A",
            startAt: "2026-08-20T18:00:00.000Z",
            endAt: "2026-08-20T22:00:00.000Z",
          },
        ],
      }),
      approvedAt: "2026-05-02T12:00:00.000Z",
      context: financialContext({
        payments: {
          deposit: {
            id: "pay-1",
            paymentType: "deposit",
            label: "Deposit",
            amount: 500,
            currency: "USD",
            dueDate: null,
            dueDateLabel: null,
            status: "Paid",
            paidDate: "2026-05-04T12:00:00.000Z",
            paidDateLabel: "May 4, 2026",
            isPaid: true,
            isDue: false,
          },
          securityDeposit: null,
          remainingBalance: {
            id: "pay-2",
            paymentType: "remaining_balance",
            label: "Remaining Balance",
            amount: 1500,
            currency: "USD",
            dueDate: "2026-08-06T18:00:00.000Z",
            dueDateLabel: "Aug 6, 2026",
            status: "Paid",
            paidDate: "2026-08-01T12:00:00.000Z",
            paidDateLabel: "Aug 1, 2026",
            isPaid: true,
            isDue: false,
          },
          outstandingBalance: 0,
          refundStatus: "none",
          refundLabel: null,
        },
      }),
    })

    const fullBalance = stages.find((stage) => stage.id === "full_balance_paid")
    assert.equal(fullBalance?.state, "complete")
    assert.equal(fullBalance?.dateLabel, "Aug 1, 2026")
  })
})
