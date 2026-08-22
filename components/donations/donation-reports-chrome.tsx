"use client"

import { createContext, Suspense, useContext, type ReactNode } from "react"

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
      <Suspense fallback={null}>
        <DonationReportsNav canManage={canManage} className="px-6" />
      </Suspense>
      {children}
    </DonationReportsCanManageContext.Provider>
  )
}

/** @deprecated Report tabs now live in DonationReportsChrome. */
export function DonationReportsTabs({ className }: { className?: string }) {
  const canManage = useDonationReportsCanManage()
  return <DonationReportsNav canManage={canManage} className={className} />
}
