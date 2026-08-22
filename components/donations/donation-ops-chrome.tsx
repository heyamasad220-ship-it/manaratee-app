"use client"

import { createContext, useContext, type ReactNode } from "react"
import { usePathname } from "next/navigation"

import { Header } from "@/components/layout/header"
import { DonationOpsNav } from "@/components/donations/donation-ops-nav"
import { isDonationPaymentDetailPath } from "@/lib/donations/donation-payment-paths"

const DonationOpsCanManageContext = createContext(false)

export function useDonationOpsCanManage() {
  return useContext(DonationOpsCanManageContext)
}

export function DonationOpsChrome({
  children,
  canManage = false,
}: {
  children: ReactNode
  canManage?: boolean
}) {
  const pathname = usePathname()

  if (isDonationPaymentDetailPath(pathname)) {
    return <>{children}</>
  }

  return (
    <DonationOpsCanManageContext.Provider value={canManage}>
      <Header title="Donations" />
      <DonationOpsNav canManage={canManage} />
      {children}
    </DonationOpsCanManageContext.Provider>
  )
}
