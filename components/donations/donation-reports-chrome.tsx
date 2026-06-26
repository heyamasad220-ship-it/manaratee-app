"use client"

import type { ReactNode } from "react"

import { DonationReportsNav } from "@/components/donations/donation-reports-nav"

export function DonationReportsChrome({ children }: { children: ReactNode }) {
  return (
    <>
      <DonationReportsNav />
      {children}
    </>
  )
}
