"use client"

import type { ReactNode } from "react"

import { ContactsReportsNav } from "@/components/contacts/contacts-reports-nav"

export function ContactsReportsChrome({ children }: { children: ReactNode }) {
  return (
    <>
      <ContactsReportsNav />
      {children}
    </>
  )
}
