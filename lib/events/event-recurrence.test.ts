import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  expandEventOccurrences,
  formatEventRecurrenceSchedule,
  resolveEventRecurrenceSave,
} from "./event-recurrence"

describe("resolveEventRecurrenceSave", () => {
  it("clears recurrence when the next config is turned off", () => {
    const result = resolveEventRecurrenceSave({
      existingConfig: {
        enabled: true,
        frequency: "weekly",
        interval: 1,
        weekdays: [6],
        endType: "count",
        endCount: 1,
        seriesId: "series-1",
      },
      nextConfig: null,
      nextConfigProvided: true,
    })
    assert.equal(result.storedRecurrence, null)
    assert.equal(result.createExtraOccurrences, false)
  })

  it("keeps existing recurrence when the form does not send a config", () => {
    const result = resolveEventRecurrenceSave({
      existingConfig: {
        enabled: true,
        frequency: "weekly",
        interval: 1,
        weekdays: [2],
        endType: "count",
        endCount: 10,
        seriesId: "series-2",
      },
      nextConfig: undefined,
      nextConfigProvided: false,
    })
    assert.equal(result.storedRecurrence?.enabled, true)
    assert.equal(result.storedRecurrence?.seriesId, "series-2")
    assert.equal(result.createExtraOccurrences, false)
  })

  it("marks a newly enabled series so extra dates can be created", () => {
    const result = resolveEventRecurrenceSave({
      existingConfig: null,
      nextConfig: {
        enabled: true,
        frequency: "weekly",
        interval: 1,
        weekdays: [6],
        endType: "count",
        endCount: 4,
      },
      nextConfigProvided: true,
    })
    assert.equal(result.storedRecurrence?.enabled, true)
    assert.equal(result.createExtraOccurrences, true)
    assert.equal(result.needsSeriesId, true)
  })

  it("does not spawn extra dates when an event is already recurring", () => {
    const result = resolveEventRecurrenceSave({
      existingConfig: {
        enabled: true,
        frequency: "weekly",
        interval: 1,
        weekdays: [6],
        endType: "count",
        endCount: 1,
        seriesId: "series-3",
      },
      nextConfig: {
        enabled: true,
        frequency: "weekly",
        interval: 1,
        weekdays: [6],
        endType: "count",
        endCount: 1,
        seriesId: "series-3",
      },
      nextConfigProvided: true,
    })
    assert.equal(result.storedRecurrence?.seriesId, "series-3")
    assert.equal(result.createExtraOccurrences, false)
    assert.equal(result.needsSeriesId, false)
  })
})

describe("custom recurrence dates", () => {
  it("expands each chosen date with the same meeting time", () => {
    const startAt = new Date(2026, 10, 3, 14, 0, 0)
    const endAt = new Date(2026, 10, 3, 16, 0, 0)
    const occurrences = expandEventOccurrences(startAt, endAt, {
      enabled: true,
      frequency: "custom",
      interval: 1,
      endType: "count",
      endCount: 2,
      customDates: ["2026-11-03", "2027-02-02"],
    })
    assert.equal(occurrences.length, 2)
    assert.equal(occurrences[0]?.startAt.getMonth(), 10)
    assert.equal(occurrences[0]?.startAt.getDate(), 3)
    assert.equal(occurrences[0]?.startAt.getHours(), 14)
    assert.equal(occurrences[1]?.startAt.getFullYear(), 2027)
    assert.equal(occurrences[1]?.startAt.getMonth(), 1)
    assert.equal(occurrences[1]?.startAt.getDate(), 2)
    assert.equal(occurrences[1]?.startAt.getHours(), 14)
  })

  it("labels a custom series as Custom dates", () => {
    assert.equal(
      formatEventRecurrenceSchedule({
        enabled: true,
        frequency: "custom",
        interval: 1,
        endType: "count",
        endCount: 2,
        customDates: ["2026-11-03", "2027-02-02"],
      }),
      "Custom dates"
    )
  })
})
