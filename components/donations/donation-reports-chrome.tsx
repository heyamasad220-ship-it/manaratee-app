"use client"

import { createContext, useContext, type ReactNode } from "react"
import { usePathname } from "next/navigation"

import { Header } from "@/components/layout/header"
import { DONATION_REPORTS_DONORS_PATH } from "@/lib/donations/donation-payment-paths"

const DonationReportsCanManageContext = createContext(false)

export function useDonationReportsCanManage() {
  return useContext(DonationReportsCanManageContext)
}

function isDonorsPath(pathname: string) {
  return (
    pathname === DONATION_REPORTS_DONORS_PATH ||
    pathname.startsWith(`${DONATION_REPORTS_DONORS_PATH}/`)
  )
}

export function DonationReportsChrome({
  children,
  canManage = false,
}: {
  children: ReactNode
  canManage?: boolean
}) {
  const pathname = usePathname()

  return (
    <DonationReportsCanManageContext.Provider value={canManage}>
      {isDonorsPath(pathname) ? <Header title="Donors" /> : null}
      {children}
    </DonationReportsCanManageContext.Provider>
  )
}

/** @deprecated Report tabs retired — unique analytics live on each object home. */
export function DonationReportsTabs(_props: { className?: string }) {
  return null
}
