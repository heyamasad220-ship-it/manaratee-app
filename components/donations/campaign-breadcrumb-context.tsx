"use client"

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react"

type CampaignBreadcrumbContextValue = {
  campaignName: string | null
  setCampaignName: (name: string | null) => void
}

const CampaignBreadcrumbContext = createContext<CampaignBreadcrumbContextValue | null>(null)

export function CampaignBreadcrumbProvider({ children }: { children: ReactNode }) {
  const [campaignName, setCampaignName] = useState<string | null>(null)
  const value = useMemo(
    () => ({ campaignName, setCampaignName }),
    [campaignName]
  )

  return (
    <CampaignBreadcrumbContext.Provider value={value}>
      {children}
    </CampaignBreadcrumbContext.Provider>
  )
}

export function useCampaignBreadcrumb() {
  const context = useContext(CampaignBreadcrumbContext)
  if (!context) {
    throw new Error("useCampaignBreadcrumb must be used within CampaignBreadcrumbProvider")
  }
  return context
}
