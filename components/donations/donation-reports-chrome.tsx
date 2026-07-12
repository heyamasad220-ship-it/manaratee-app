"use client"

import type { ReactNode } from "react"

import { Header } from "@/components/layout/header"

export function DonationReportsChrome({
  children,
}: {
  children: ReactNode
  canManage?: boolean
}) {
  return (
    <>
      <Header title="Reports" />
      {children}
    </>
  )
}
