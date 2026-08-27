import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  formatPhoneDisplay,
  formatPhoneDisplayOrDash,
  formatPhonesInText,
} from "./format-phone"

describe("formatPhoneDisplay", () => {
  it("formats 10-digit numbers", () => {
    assert.equal(formatPhoneDisplay("2146687667"), "(214) 668-7667")
  })

  it("formats already-punctuated numbers", () => {
    assert.equal(formatPhoneDisplay("214-668-7667"), "(214) 668-7667")
    assert.equal(formatPhoneDisplay("(469) 834-8503"), "(469) 834-8503")
  })

  it("strips a leading US country code", () => {
    assert.equal(formatPhoneDisplay("12146687667"), "(214) 668-7667")
    assert.equal(formatPhoneDisplay("+1 (214) 668-7667"), "(214) 668-7667")
  })

  it("leaves non-US lengths unchanged", () => {
    assert.equal(formatPhoneDisplay("5551234"), "5551234")
  })

  it("returns empty for blank values", () => {
    assert.equal(formatPhoneDisplay(null), "")
    assert.equal(formatPhoneDisplay("   "), "")
    assert.equal(formatPhoneDisplayOrDash(null), "—")
  })
})

describe("formatPhonesInText", () => {
  it("formats a phone inside a name-and-number line", () => {
    assert.equal(
      formatPhonesInText("Hassan Ali 2146687667"),
      "Hassan Ali (214) 668-7667"
    )
  })
})
