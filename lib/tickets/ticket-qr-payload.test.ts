import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { ticketCodeFromQrPayload } from "./ticket-qr-payload"

describe("ticketCodeFromQrPayload", () => {
  it("reads a raw ticket code", () => {
    assert.equal(ticketCodeFromQrPayload("ab12cd34"), "AB12CD34")
  })

  it("strips spaces and punctuation", () => {
    assert.equal(ticketCodeFromQrPayload(" AB-12 CD "), "AB12CD")
  })

  it("reads a code query from a URL", () => {
    assert.equal(
      ticketCodeFromQrPayload("https://example.org/tickets?code=k7mnpq2r"),
      "K7MNPQ2R"
    )
  })

  it("reads the last path segment from a URL", () => {
    assert.equal(
      ticketCodeFromQrPayload("https://tickets.example.org/check-in/XYZ23456"),
      "XYZ23456"
    )
  })

  it("rejects empty or tiny payloads", () => {
    assert.equal(ticketCodeFromQrPayload(""), null)
    assert.equal(ticketCodeFromQrPayload("ab"), null)
    assert.equal(ticketCodeFromQrPayload("   "), null)
  })
})
