"use client"

import type { ReactNode } from "react"

import { Header } from "@/components/layout/header"

export function DonationCampaignsShell({
  children,
}: {
  children: ReactNode
  canManage?: boolean
}) {
  return (
    <>
      <Header title="Campaigns" />
      {children}
    </>
  )
}
