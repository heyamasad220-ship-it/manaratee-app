"use client"

import type { ReactNode } from "react"
import { usePathname } from "next/navigation"

import { Header } from "@/components/layout/header"

export function DonationCampaignsShell({
  children,
}: {
  children: ReactNode
  canManage?: boolean
}) {
  const pathname = usePathname()
  const isPledges =
    pathname === "/donations/campaigns/pledges" ||
    pathname.startsWith("/donations/campaigns/pledges/")

  return (
    <>
      <Header title={isPledges ? "Pledges" : "Campaigns"} />
      {children}
    </>
  )
}
