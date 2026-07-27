import type { SubItem } from "@/lib/navigation/sidebar-nav"

export const DONATIONS_SIDEBAR_CHILDREN: SubItem[] = [
  { label: "Overview", href: "/donations", matchPrefix: "/donations", permissionKey: "donations.view" },
  {
    label: "Campaigns",
    href: "/donations/campaigns",
    matchPrefix: "/donations/campaigns",
    permissionKey: "donations.view",
  },
  {
    label: "Pledges",
    href: "/donations/campaigns/pledges",
    matchPrefix: "/donations/campaigns/pledges",
    alsoMatchPrefixes: ["/donations/reports/pledges", "/donations/pledges"],
    permissionKey: "donations.view",
  },
  {
    label: "Reports",
    href: "/donations/reports/one-time",
    matchPrefix: "/donations/reports",
    alsoMatchPrefixes: [
      "/donations/payments",
      "/donations/donors",
      "/donations/import",
      "/donations/reconcile",
    ],
    permissionKey: "donations.view",
  },
  {
    label: "Settings",
    href: "/donations/settings",
    matchPrefix: "/donations/settings",
    permissionKey: "donations.manage",
  },
]
