import type { SubItem } from "@/lib/navigation/sidebar-nav"

export const DONATIONS_SIDEBAR_CHILDREN: SubItem[] = [
  {
    label: "Overview",
    href: "/donations",
    matchPrefix: "/donations",
    exact: true,
    permissionKey: "donations.view",
  },
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
    alsoMatchPrefixes: ["/donations/pledges"],
    permissionKey: "donations.view",
  },
  {
    label: "Donations",
    href: "/donations/payments/transactions",
    matchPrefix: "/donations/payments",
    alsoMatchPrefixes: ["/donations/import", "/donations/reconcile", "/donations/recurring"],
    permissionKey: "donations.view",
  },
  {
    label: "Reports",
    href: "/donations/reports",
    matchPrefix: "/donations/reports",
    alsoMatchPrefixes: ["/donations/donors", "/donations/groups"],
    permissionKey: "donations.view",
  },
  {
    label: "Settings",
    href: "/donations/settings",
    matchPrefix: "/donations/settings",
    permissionKey: "donations.manage",
  },
]
