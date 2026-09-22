import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { isDuplicateCustomerFamilyMember } from "./customer-family-match"

describe("customer family duplicate match", () => {
  const member = {
    firstName: "Ihab",
    lastName: "Neel",
    gender: "Male",
    dateOfBirth: "2013-01-01",
    relationship: "child",
  }

  it("treats the same name, gender, birth date, and relationship as a duplicate", () => {
    assert.equal(
      isDuplicateCustomerFamilyMember(member, {
        firstName: "ihab",
        lastName: "neel",
        gender: "Male",
        dateOfBirth: "2013-01-01",
        relationship: "child",
      }),
      true
    )
  })

  it("allows a different child with another date of birth", () => {
    assert.equal(
      isDuplicateCustomerFamilyMember(member, {
        ...member,
        dateOfBirth: "2015-01-01",
      }),
      false
    )
  })
})
