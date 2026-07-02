"use client"

import type { ReactNode } from "react"

import { Header } from "@/components/layout/header"
import { DonationReportsNav } from "@/components/donations/donation-reports-nav"

export function DonationReportsChrome({
  children,
  canManage,
}: {
  children: ReactNode
  canManage: boolean
}) {
  return (
    <>
      <Header title="Reports" />
      <DonationReportsNav canManage={canManage} />
      {children}
    </>
  )
}
