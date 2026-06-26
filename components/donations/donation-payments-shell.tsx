"use client"

import type { ReactNode } from "react"

import { Header } from "@/components/layout/header"
import { DonationPaymentsNav } from "@/components/donations/donation-payments-nav"

export function DonationPaymentsShell({
  children,
  canManage,
}: {
  children: ReactNode
  canManage: boolean
}) {
  return (
    <>
      <Header title="Payments" />
      <DonationPaymentsNav canManage={canManage} />
      <div className="flex flex-col gap-6 p-6">{children}</div>
    </>
  )
}
