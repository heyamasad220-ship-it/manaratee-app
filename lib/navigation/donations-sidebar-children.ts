import { DONATION_REPORTS_TABS } from "@/components/donations/donation-reports-nav"
import type { SubItem } from "@/lib/navigation/sidebar-nav"

export const DONATIONS_SIDEBAR_CHILDREN: SubItem[] = [
  { label: "Overview", href: "/donations", matchPrefix: "/donations", permissionKey: "donations.view" },
  {
    label: "Campaigns",
    href: "/donations/campaigns",
    matchPrefix: "/donations/campaigns",
    permissionKey: "donations.view",
    children: [
      {
        label: "Overview",
        href: "/donations/campaigns",
        matchPrefix: "/donations/campaigns",
        exact: true,
        permissionKey: "donations.view",
      },
      {
        label: "Pledges",
        href: "/donations/campaigns/pledges",
        matchPrefix: "/donations/campaigns/pledges",
        alsoMatchPrefixes: ["/donations/reports/pledges", "/donations/pledges"],
        permissionKey: "donations.view",
      },
    ],
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
      "/donations/pledges",
    ],
    permissionKey: "donations.view",
    children: DONATION_REPORTS_TABS.map((tab) => ({
      label: tab.label,
      href: tab.href,
      matchPrefix: tab.matchPrefix,
      alsoMatchPrefixes: tab.extraMatchPrefixes,
      permissionKey: tab.requiresManage ? "donations.manage" : "donations.view",
    })),
  },
  {
    label: "Settings",
    href: "/donations/settings",
    matchPrefix: "/donations/settings",
    permissionKey: "donations.manage",
  },
]
