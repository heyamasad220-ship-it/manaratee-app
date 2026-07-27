"use client"

import { createContext, useContext, type ReactNode } from "react"

import { Header } from "@/components/layout/header"
import { DonationReportsNav } from "@/components/donations/donation-reports-nav"

const DonationReportsCanManageContext = createContext(false)

export function useDonationReportsCanManage() {
  return useContext(DonationReportsCanManageContext)
}

export function DonationReportsChrome({
  children,
  canManage = false,
}: {
  children: ReactNode
  canManage?: boolean
}) {
  return (
    <DonationReportsCanManageContext.Provider value={canManage}>
      <Header title="Reports" />
      {children}
    </DonationReportsCanManageContext.Provider>
  )
}

/** Place below KPI cards on each Reports page. */
export function DonationReportsTabs({ className }: { className?: string }) {
  const canManage = useDonationReportsCanManage()
  return <DonationReportsNav canManage={canManage} className={className} />
}
