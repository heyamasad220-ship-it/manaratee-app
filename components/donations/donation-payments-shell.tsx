"use client"

import type { ReactNode } from "react"

import { Header } from "@/components/layout/header"

export function DonationPaymentsShell({
  children,
}: {
  children: ReactNode
  canManage?: boolean
}) {
  return (
    <>
      <Header title="Payments" />
      <div className="flex flex-col gap-6 p-6">{children}</div>
    </>
  )
}
