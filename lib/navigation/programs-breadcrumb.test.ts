import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { GraduationCap } from "lucide-react"

import { buildProgramsChildren } from "./staff-module-nav"
import { buildNavigationTrail, type NavItem } from "./sidebar-nav"

const programsNav: NavItem[] = [
  {
    label: "Programs",
    href: "/programs",
    icon: GraduationCap,
    matchPrefix: "/programs",
    alsoMatchPrefixes: [
      "/finance/financial-assistance",
      "/finance/transactions",
      "/finance/payroll",
    ],
    children: buildProgramsChildren("both"),
  },
]

describe("programs breadcrumbs", () => {
  it("shows Dashboard > Programs > Overview on Programs Home", () => {
    const trail = buildNavigationTrail("/programs", programsNav, null)
    assert.deepEqual(
      trail.map((segment) => ({ label: segment.label, href: segment.href })),
      [
        { label: "Dashboard", href: "/dashboard" },
        { label: "Programs", href: "/programs" },
        { label: "Overview", href: undefined },
      ]
    )
  })

  it("keeps Programs clickable from All programs", () => {
    const trail = buildNavigationTrail("/programs/list", programsNav, null)
    assert.deepEqual(
      trail.map((segment) => ({ label: segment.label, href: segment.href })),
      [
        { label: "Dashboard", href: "/dashboard" },
        { label: "Programs", href: "/programs" },
        { label: "All programs", href: undefined },
      ]
    )
  })

  it("falls back to Offerings when the catalog is not in the flyout", () => {
    const trail = buildNavigationTrail("/programs/catalog", programsNav, null)
    assert.deepEqual(
      trail.map((segment) => ({ label: segment.label, href: segment.href })),
      [
        { label: "Dashboard", href: "/dashboard" },
        { label: "Programs", href: "/programs" },
        { label: "Offerings", href: undefined },
      ]
    )
  })

  it("shows Finance from the Programs flyout", () => {
    const trail = buildNavigationTrail("/finance/transactions", programsNav, null)
    assert.deepEqual(
      trail.map((segment) => ({ label: segment.label, href: segment.href })),
      [
        { label: "Dashboard", href: "/dashboard" },
        { label: "Programs", href: "/programs" },
        { label: "Finance", href: undefined },
      ]
    )
  })
})
