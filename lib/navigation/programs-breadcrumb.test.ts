import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { GraduationCap } from "lucide-react"

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
    children: [],
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

  it("keeps Programs clickable back to Overview from the Programs list", () => {
    const trail = buildNavigationTrail("/programs/list", programsNav, null)
    assert.deepEqual(
      trail.map((segment) => ({ label: segment.label, href: segment.href })),
      [
        { label: "Dashboard", href: "/dashboard" },
        { label: "Programs", href: "/programs" },
        { label: "Programs", href: undefined },
      ]
    )
  })

  it("keeps Programs clickable back to Overview from Offerings", () => {
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
})
