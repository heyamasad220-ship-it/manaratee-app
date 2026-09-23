"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react"

import { Header } from "@/components/layout/header"

type Crumb = { label: string; href?: string }

const VendorHubBreadcrumbSetterContext = createContext<(extras: Crumb[]) => void>(() => {})

export function VendorHubChrome({ children }: { children: ReactNode }) {
  const [extras, setExtrasState] = useState<Crumb[]>([])
  const setExtras = useCallback((next: Crumb[]) => {
    setExtrasState((current) => {
      if (
        current.length === next.length &&
        current.every(
          (item, index) => item.label === next[index]?.label && item.href === next[index]?.href
        )
      ) {
        return current
      }
      return next
    })
  }, [])

  return (
    <VendorHubBreadcrumbSetterContext.Provider value={setExtras}>
      <Header breadcrumbExtras={extras} />
      {children}
    </VendorHubBreadcrumbSetterContext.Provider>
  )
}

export function VendorHubBreadcrumbLabel({ label }: { label: string }) {
  const setExtras = useContext(VendorHubBreadcrumbSetterContext)

  useEffect(() => {
    setExtras([{ label }])
    return () => setExtras([])
  }, [label, setExtras])

  return null
}
