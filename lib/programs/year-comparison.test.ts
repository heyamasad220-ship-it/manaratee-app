import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  buildProgramSeriesSummaries,
  buildSeriesBreakdown,
  buildYearRows,
  filterYearComparisonFacts,
  parseProgramSeriesAndYear,
  previousYearKey,
  programSeriesKey,
  seriesShortLabelFromRaw,
  type YearComparisonFact,
} from "./year-comparison"

function fact(
  overrides: Partial<YearComparisonFact> &
    Pick<YearComparisonFact, "yearKey" | "familyId" | "kidId">
): YearComparisonFact {
  const yearKey = overrides.yearKey
  const start = Number(yearKey.slice(0, 4))
  const seriesKey = overrides.seriesKey ?? "edu::qlh"
  return {
    departmentId: "edu",
    departmentName: "Education",
    seriesKey,
    seriesLabel: "Quran for Little Hearts",
    yearLabel: yearKey.replace("-", "–"),
    sortYear: start,
    programKind: "academic",
    programId: `prog-${seriesKey}-${yearKey}`,
    ...overrides,
  }
}

describe("parseProgramSeriesAndYear", () => {
  it("parses academic year programs including QLH", () => {
    const qlh = parseProgramSeriesAndYear("QLH 2022-2023")
    assert.equal(qlh.seriesLabel, "Quran for Little Hearts")
    assert.equal(qlh.yearKey, "2022-2023")
    assert.equal(qlh.sortYear, 2022)

    const sunday = parseProgramSeriesAndYear("Sunday School 2026-2027")
    assert.equal(sunday.seriesLabel, "Sunday School")
    assert.equal(sunday.yearKey, "2026-2027")

    const short = parseProgramSeriesAndYear("QLH 2024-25")
    assert.equal(short.yearKey, "2024-2025")
  })

  it("parses calendar-year seasonal names", () => {
    const camp = parseProgramSeriesAndYear("Summer Camp 2026")
    assert.equal(camp.seriesLabel, "Summer Camp")
    assert.equal(camp.yearKey, "2026")
    assert.equal(camp.sortYear, 2026)

    const campOne = parseProgramSeriesAndYear("Summer Camp 1 2024")
    assert.equal(campOne.seriesLabel, "Summer Camp")
    assert.equal(campOne.yearKey, "2024")

    const winterBreak = parseProgramSeriesAndYear("Winter Break Camp 2024")
    assert.equal(winterBreak.seriesLabel, "Winter Camp")
    assert.equal(winterBreak.yearKey, "2024")
  })

  it("falls back to start date when the name has no year", () => {
    const parsed = parseProgramSeriesAndYear("After School Club", "2025-09-02")
    assert.equal(parsed.seriesLabel, "After School Club")
    assert.equal(parsed.yearKey, "2025-2026")
  })
})

describe("previousYearKey", () => {
  it("steps academic and calendar years back one", () => {
    assert.equal(previousYearKey("2026-2027"), "2025-2026")
    assert.equal(previousYearKey("2022-2023"), "2021-2022")
    assert.equal(previousYearKey("2026"), "2025")
  })
})

describe("buildYearRows", () => {
  it("counts unique kids and families and classifies new vs returning", () => {
    const facts: YearComparisonFact[] = [
      fact({ yearKey: "2024-2025", familyId: "parent-a", kidId: "kid-1" }),
      fact({ yearKey: "2024-2025", familyId: "parent-a", kidId: "kid-2" }),
      fact({ yearKey: "2024-2025", familyId: "parent-b", kidId: "kid-3" }),
      fact({ yearKey: "2025-2026", familyId: "parent-a", kidId: "kid-1" }),
      fact({ yearKey: "2025-2026", familyId: "parent-a", kidId: "kid-4" }),
      fact({ yearKey: "2025-2026", familyId: "parent-c", kidId: "kid-5" }),
    ]

    const rows = buildYearRows(facts)
    assert.equal(rows.length, 2)

    const first = rows[0]
    assert.equal(first.kids, 3)
    assert.equal(first.families, 2)
    assert.equal(first.programId, "prog-edu::qlh-2024-2025")
    assert.equal(first.newFamilies, 2)
    assert.equal(first.returningFamilies, 0)
    assert.equal(first.droppedFamilies, 0)

    const second = rows[1]
    assert.equal(second.kids, 3)
    assert.equal(second.families, 2)
    assert.equal(second.returningFamilies, 1)
    assert.equal(second.newFamilies, 1)
    assert.equal(second.droppedFamilies, 1)
    assert.equal(second.returningKids, 1)
    assert.equal(second.newKids, 2)
    assert.equal(second.droppedKids, 2)
    assert.equal(second.kidsPerFamily, 1.5)
    assert.equal(second.kidsChangePct, 0)
    assert.equal(second.familiesChangePct, 0)
  })

  it("does not double-count a kid enrolled in two offerings the same year", () => {
    const rows = buildYearRows([
      fact({ yearKey: "2025-2026", familyId: "p", kidId: "k", seriesKey: "edu::qlh" }),
      fact({ yearKey: "2025-2026", familyId: "p", kidId: "k", seriesKey: "edu::qlh" }),
    ])
    assert.equal(rows[0]?.kids, 1)
    assert.equal(rows[0]?.families, 1)
  })

  it("links each year to the program with the most enrollments", () => {
    const mixed = buildYearRows([
      fact({ yearKey: "2026-2027", familyId: "a", kidId: "1", seriesKey: "edu::qlh" }),
      fact({
        yearKey: "2026-2027",
        familyId: "b",
        kidId: "2",
        seriesKey: "edu::sunday school",
        seriesLabel: "Sunday School",
      }),
      fact({
        yearKey: "2026-2027",
        familyId: "c",
        kidId: "3",
        seriesKey: "edu::sunday school",
        seriesLabel: "Sunday School",
      }),
    ])
    assert.equal(mixed[0]?.programId, "prog-edu::sunday school-2026-2027")

    const single = buildYearRows([
      fact({ yearKey: "2026-2027", familyId: "a", kidId: "1" }),
    ])
    assert.equal(single[0]?.programId, "prog-edu::qlh-2026-2027")
  })
})

describe("department vs series returning", () => {
  it("treats a Sunday School family as returning to Education even if they switch to QLH", () => {
    const facts: YearComparisonFact[] = [
      fact({
        yearKey: "2025-2026",
        seriesKey: "edu::sunday school",
        seriesLabel: "Sunday School",
        familyId: "parent-a",
        kidId: "kid-1",
      }),
      fact({
        yearKey: "2026-2027",
        seriesKey: "edu::qlh",
        seriesLabel: "Quran for Little Hearts",
        familyId: "parent-a",
        kidId: "kid-1",
      }),
    ]

    const departmentRows = buildYearRows(facts)
    const latest = departmentRows[departmentRows.length - 1]
    assert.equal(latest.returningFamilies, 1)
    assert.equal(latest.newFamilies, 0)

    const qlhRows = buildYearRows(facts.filter((row) => row.seriesKey === "edu::qlh"))
    assert.equal(qlhRows[0]?.newFamilies, 1)
    assert.equal(qlhRows[0]?.returningFamilies, 0)
  })
})

describe("buildSeriesBreakdown", () => {
  it("compares each series to its own previous year", () => {
    const facts: YearComparisonFact[] = [
      fact({
        yearKey: "2025-2026",
        seriesKey: "edu::qlh",
        familyId: "a",
        kidId: "1",
      }),
      fact({
        yearKey: "2026-2027",
        seriesKey: "edu::qlh",
        familyId: "a",
        kidId: "1",
      }),
      fact({
        yearKey: "2026-2027",
        seriesKey: "edu::sunday school",
        seriesLabel: "Sunday School",
        familyId: "b",
        kidId: "2",
      }),
    ]
    const rows = buildSeriesBreakdown(facts, "2026-2027")
    const qlh = rows.find((row) => row.seriesKey === "edu::qlh")
    const sunday = rows.find((row) => row.seriesKey === "edu::sunday school")
    assert.equal(qlh?.returningFamilies, 1)
    assert.equal(qlh?.programId, "prog-edu::qlh-2026-2027")
    assert.equal(sunday?.newFamilies, 1)
    assert.equal(sunday?.returningFamilies, 0)
    assert.equal(sunday?.programId, "prog-edu::sunday school-2026-2027")
  })
})

describe("filterYearComparisonFacts", () => {
  it("filters by department, series, and kind", () => {
    const facts: YearComparisonFact[] = [
      fact({ yearKey: "2026-2027", familyId: "a", kidId: "1" }),
      fact({
        yearKey: "2026-2027",
        familyId: "b",
        kidId: "2",
        departmentId: "camps",
        departmentName: "Camps",
        seriesKey: "camps::summer camp",
        seriesLabel: "Summer Camp",
        programKind: "seasonal",
      }),
    ]
    assert.equal(
      filterYearComparisonFacts(facts, { departmentId: "edu" }).length,
      1
    )
    assert.equal(
      filterYearComparisonFacts(facts, { programKind: "seasonal" }).length,
      1
    )
    assert.equal(
      filterYearComparisonFacts(facts, { seriesKey: "edu::qlh" }).length,
      1
    )
  })
})

describe("seriesShortLabelFromRaw", () => {
  it("uses compact aliases and keeps already-short names", () => {
    assert.equal(seriesShortLabelFromRaw("Kids Saturday Quranic Arabic"), "Kids SQA")
    assert.equal(seriesShortLabelFromRaw("Saturday Quranic Arabic"), "SQA")
    assert.equal(seriesShortLabelFromRaw("Quran Institute Junior"), "QIJ")
    assert.equal(seriesShortLabelFromRaw("QLH"), "QLH")
    assert.equal(seriesShortLabelFromRaw("Sunday School"), "Sunday School")
    assert.equal(seriesShortLabelFromRaw("Summer Camp 1"), "Summer Camp")
    assert.equal(
      seriesShortLabelFromRaw("The Companion of the Quran"),
      "The Companion of the Quran"
    )
  })
})

describe("buildProgramSeriesSummaries", () => {
  it("counts only active and closed years and groups by series", () => {
    const rows = buildProgramSeriesSummaries(
      [
        { name: "Kids Saturday Quranic Arabic 2026-2027", status: "active" },
        { name: "Kids Saturday Quranic Arabic 2025-2026", status: "closed" },
        { name: "Kids Saturday Quranic Arabic 2024-2025", status: "draft" },
        { name: "QLH 2026-2027", status: "active" },
        { name: "QLH 2025-2026", status: "paused" },
        { name: "Sunday School 2026-2027", status: "archived" },
      ],
      "edu"
    )
    assert.equal(rows.length, 2)
    const kids = rows.find((row) => row.shortLabel === "Kids SQA")
    const qlh = rows.find((row) => row.shortLabel === "QLH")
    assert.equal(kids?.activeCount, 1)
    assert.equal(kids?.closedCount, 1)
    assert.equal(qlh?.activeCount, 1)
    assert.equal(qlh?.closedCount, 0)
  })

  it("merges camp name variants into one season card without collapsing Education series", () => {
    const rows = buildProgramSeriesSummaries(
      [
        { name: "Fall Camp 2022", status: "closed" },
        { name: "Fall Camp October 2024", status: "closed" },
        { name: "Fall Camp November 2024", status: "closed" },
        { name: "Summer Camp 1 2024", status: "closed" },
        { name: "Summer Camp 2 2024", status: "closed" },
        { name: "Summer Camp 2026", status: "closed" },
        { name: "Winter Break Camp 2024", status: "closed" },
        { name: "Winter Camp Ready Set Pray 2024", status: "closed" },
        { name: "Winter Camp 2025", status: "closed" },
        { name: "Youth Intensive 2025", status: "closed" },
        { name: "Special Needs Summer Camp 2026", status: "closed" },
        { name: "Sunday School 2025-2026", status: "closed" },
        { name: "Sunday School 2026-2027", status: "active" },
        { name: "QLH 2022-2023", status: "closed" },
        { name: "Quran for Little Hearts 2024-2025", status: "active" },
      ],
      "dept"
    )

    const fall = rows.find((row) => row.shortLabel === "Fall Camp")
    const summer = rows.find((row) => row.shortLabel === "Summer Camp")
    const winter = rows.find((row) => row.shortLabel === "Winter Camp")
    const youth = rows.find((row) => row.shortLabel === "Youth Intensive")
    const special = rows.find((row) => row.shortLabel === "Special Needs Summer Camp")
    const sunday = rows.find((row) => row.shortLabel === "Sunday School")
    const qlh = rows.find((row) => row.shortLabel === "QLH")

    assert.equal(fall?.closedCount, 3)
    assert.equal(summer?.closedCount, 3)
    assert.equal(winter?.closedCount, 3)
    assert.equal(youth?.closedCount, 1)
    assert.equal(special?.closedCount, 1)
    assert.equal(sunday?.activeCount, 1)
    assert.equal(sunday?.closedCount, 1)
    assert.equal(qlh?.activeCount, 1)
    assert.equal(qlh?.closedCount, 1)
    assert.equal(
      rows.some((row) => row.shortLabel === "Summer Camp 1"),
      false
    )
    assert.equal(
      programSeriesKey("dept", "Summer Camp 1 2024"),
      programSeriesKey("dept", "Summer Camp 2026")
    )
    assert.equal(
      programSeriesKey("dept", "QLH 2022-2023"),
      programSeriesKey("dept", "Quran for Little Hearts 2024-2025")
    )
  })

  it("hides series that only have one program when minPrograms is 2", () => {
    const rows = buildProgramSeriesSummaries(
      [
        { name: "Fall Camp 2022", status: "closed" },
        { name: "Fall Camp 2023", status: "closed" },
        { name: "RIJAAL Overnight Camp 2024", status: "closed" },
        { name: "Special Needs Summer Camp 2026", status: "closed" },
        { name: "Youth Intensive 2025", status: "closed" },
        { name: "Youth Intensive 2026", status: "closed" },
      ],
      "camps",
      { minPrograms: 2 }
    )
    assert.deepEqual(
      rows.map((row) => row.shortLabel).sort(),
      ["Fall Camp", "Youth Intensive"]
    )
  })
})
