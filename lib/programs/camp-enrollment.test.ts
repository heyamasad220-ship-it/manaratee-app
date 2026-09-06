import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  buildCampFamilyRows,
  buildCampProgramSummary,
  buildCampTrend,
  parseCampMeta,
  splitSummerCamp2026Sessions,
  summerCamp2026Instances,
  type CampParticipationFact,
} from "./camp-enrollment"

function fact(
  overrides: Partial<CampParticipationFact> &
    Pick<CampParticipationFact, "familyId" | "instanceKey" | "programName">
): CampParticipationFact {
  const meta = parseCampMeta(
    overrides.programName,
    overrides.startDate,
    overrides.endDate
  )
  return {
    familyName: overrides.familyName || "Family",
    email: overrides.email || null,
    phone: overrides.phone || null,
    programId: overrides.programId || overrides.instanceKey,
    season: overrides.season || meta.season,
    year: overrides.year || meta.year,
    startDate: overrides.startDate || meta.startDate,
    endDate: overrides.endDate || meta.endDate,
    enrollmentDate: overrides.enrollmentDate || null,
    sortKey: overrides.sortKey || meta.sortKey,
    ...overrides,
  }
}

describe("parseCampMeta", () => {
  it("reads season and year from camp names", () => {
    const summer = parseCampMeta("Summer Camp 1 2024", "2024-06-01")
    assert.equal(summer.season, "Summer")
    assert.equal(summer.year, 2024)

    const fall = parseCampMeta("Fall Camp November 2024")
    assert.equal(fall.season, "Fall")
    assert.equal(fall.year, 2024)

    const winter = parseCampMeta("Winter Camp Ready Set Pray 2024")
    assert.equal(winter.season, "Winter")

    const overnight = parseCampMeta("RIJAAL Overnight Camp 2024")
    assert.equal(overnight.season, "Specialty")
  })
})

describe("Summer Camp 2026 split", () => {
  it("counts Camp 1 and Camp 2 from session weeks", () => {
    const split = splitSummerCamp2026Sessions([
      "2026-06-01",
      "2026-06-22",
      "2026-06-29",
    ])
    assert.equal(split.camp1, true)
    assert.equal(split.camp2, true)
    const instances = summerCamp2026Instances("prog-2026", split)
    assert.equal(instances.length, 2)
    assert.equal(instances[0]?.programName, "Summer Camp 1 2026")
    assert.equal(instances[1]?.programName, "Summer Camp 2 2026")
  })

  it("falls back to one program when there are no session weeks", () => {
    const instances = summerCamp2026Instances(
      "prog-2026",
      splitSummerCamp2026Sessions([])
    )
    assert.equal(instances.length, 1)
    assert.equal(instances[0]?.programName, "Summer Camp 2026")
  })
})

describe("camp reports", () => {
  it("counts a family once per program, including Camp 1 then Camp 2", () => {
    const facts: CampParticipationFact[] = [
      fact({
        familyId: "a",
        instanceKey: "c1-2024",
        programName: "Summer Camp 1 2024",
        startDate: "2024-06-01",
        endDate: "2024-06-25",
      }),
      fact({
        familyId: "a",
        instanceKey: "c2-2024",
        programName: "Summer Camp 2 2024",
        startDate: "2024-06-29",
        endDate: "2024-07-23",
      }),
      fact({
        familyId: "b",
        instanceKey: "c2-2024",
        programName: "Summer Camp 2 2024",
        startDate: "2024-06-29",
        endDate: "2024-07-23",
      }),
    ]

    const families = buildCampFamilyRows(facts)
    const familyA = families.find((row) => row.familyId === "a")
    assert.equal(familyA?.programCount, 2)
    assert.equal(familyA?.lastProgramName, "Summer Camp 2 2024")
    assert.equal(familyA?.lastProgramDate, "2024-07-23")

    const summary = buildCampProgramSummary(facts)
    const camp2 = summary.find((row) => row.programName === "Summer Camp 2 2024")
    assert.equal(camp2?.families, 2)
    assert.equal(camp2?.returningFamilies, 1)
    assert.equal(camp2?.newFamilies, 1)
  })

  it("builds unique family counts by year and season", () => {
    const facts: CampParticipationFact[] = [
      fact({
        familyId: "a",
        instanceKey: "c1",
        programName: "Summer Camp 1 2024",
        startDate: "2024-06-01",
      }),
      fact({
        familyId: "a",
        instanceKey: "c2",
        programName: "Summer Camp 2 2024",
        startDate: "2024-06-29",
      }),
      fact({
        familyId: "c",
        instanceKey: "fall",
        programName: "Fall Camp 2024",
        startDate: "2024-11-25",
      }),
    ]
    const trend = buildCampTrend(facts)
    assert.equal(trend.length, 1)
    assert.equal(trend[0]?.Summer, 1)
    assert.equal(trend[0]?.Fall, 1)
  })
})
