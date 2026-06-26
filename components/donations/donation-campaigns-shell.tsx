"use client"

import type { ReactNode } from "react"

import { Header } from "@/components/layout/header"
import { DonationCampaignsNav } from "@/components/donations/donation-campaigns-nav"

export function DonationCampaignsShell({
  children,
  canManage,
}: {
  children: ReactNode
  canManage: boolean
}) {
  return (
    <>
      <Header title="Campaigns" />
      <DonationCampaignsNav canManage={canManage} />
      {children}
    </>
  )
}
