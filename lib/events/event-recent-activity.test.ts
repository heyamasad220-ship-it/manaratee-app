import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { buildEventRecentOrders } from "./event-recent-activity"

function attendee(overrides: {
  orderId: string
  orderNumber?: string
  orderStatus?: string
  orderTotalCents?: number
  orderRefundedCents?: number
  purchaserName?: string | null
  attendeeName?: string | null
  orderCreatedAt?: string | null
  createdAt?: string
}) {
  return {
    orderId: overrides.orderId,
    orderNumber: overrides.orderNumber ?? "1001",
    orderStatus: overrides.orderStatus ?? "completed",
    orderTotalCents: overrides.orderTotalCents ?? 1000,
    orderRefundedCents: overrides.orderRefundedCents ?? 0,
    currency: "USD",
    purchaserName: overrides.purchaserName ?? "Jane Doe",
    attendeeName: overrides.attendeeName ?? "Kid",
    orderCreatedAt: overrides.orderCreatedAt ?? "2026-08-20T18:00:00Z",
    createdAt: overrides.createdAt ?? "2026-08-20T18:00:00Z",
  }
}

describe("buildEventRecentOrders", () => {
  it("dedupes tickets into a couple of recent orders", () => {
    const items = buildEventRecentOrders(
      [
        attendee({ orderId: "a", orderNumber: "1001", orderCreatedAt: "2026-08-22T12:00:00Z" }),
        attendee({ orderId: "a", orderNumber: "1001", orderCreatedAt: "2026-08-22T12:00:00Z" }),
        attendee({
          orderId: "b",
          orderNumber: "1002",
          purchaserName: "Sam",
          orderCreatedAt: "2026-08-21T12:00:00Z",
        }),
        attendee({ orderId: "c", orderNumber: "1003", orderCreatedAt: "2026-08-10T12:00:00Z" }),
      ],
      2
    )

    assert.equal(items.length, 2)
    assert.match(items[0]!.label, /Order 1001 · Jane Doe · \$10\.00/)
    assert.match(items[1]!.label, /Order 1002 · Sam · \$10\.00/)
  })

  it("labels refunds separately from new orders", () => {
    const items = buildEventRecentOrders([
      attendee({
        orderId: "r",
        orderNumber: "2001",
        orderStatus: "refunded",
        orderTotalCents: 4100,
        orderRefundedCents: 4100,
      }),
      attendee({
        orderId: "p",
        orderNumber: "2002",
        orderStatus: "partially_refunded",
        orderTotalCents: 2000,
        orderRefundedCents: 500,
        orderCreatedAt: "2026-08-19T12:00:00Z",
      }),
    ])

    assert.equal(items[0]!.label, "Refund · 2001 · $41.00")
    assert.equal(items[1]!.label, "Partial refund · 2002 · $5.00")
  })
})
