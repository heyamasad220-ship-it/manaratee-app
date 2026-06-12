"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

import type { VendorHubEventWithInternal } from "@/lib/vendor-hub/vendor-hub-types"

type VendorHubEventContextValue = {
  events: VendorHubEventWithInternal[]
  selectedEventId: string
  selectedEvent: VendorHubEventWithInternal | null
  setSelectedEventId: (eventId: string) => void
  isLoading: boolean
}

const VendorHubEventContext = createContext<VendorHubEventContextValue | null>(
  null
)

function readEventIdFromUrl() {
  if (typeof window === "undefined") {
    return ""
  }

  return new URLSearchParams(window.location.search).get("event") ?? ""
}

function writeEventIdToUrl(eventId: string) {
  if (typeof window === "undefined") {
    return
  }

  const url = new URL(window.location.href)

  if (eventId) {
    url.searchParams.set("event", eventId)
  } else {
    url.searchParams.delete("event")
  }

  window.history.replaceState(window.history.state, "", url.toString())
}

export function VendorHubEventProvider({
  initialEvents,
  children,
}: {
  initialEvents: VendorHubEventWithInternal[]
  children: ReactNode
}) {
  const defaultEventId = initialEvents[0]?.id ?? ""

  const [selectedEventId, setSelectedEventIdState] = useState(defaultEventId)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    const eventFromUrl = readEventIdFromUrl()

    if (eventFromUrl && initialEvents.some((event) => event.id === eventFromUrl)) {
      setSelectedEventIdState(eventFromUrl)
    } else if (!eventFromUrl && defaultEventId) {
      writeEventIdToUrl(defaultEventId)
      setSelectedEventIdState(defaultEventId)
    }

    setHydrated(true)
  }, [defaultEventId, initialEvents])

  const setSelectedEventId = useCallback((eventId: string) => {
    setSelectedEventIdState(eventId)
    writeEventIdToUrl(eventId)
  }, [])

  const selectedEvent = useMemo(
    () => initialEvents.find((event) => event.id === selectedEventId) ?? null,
    [initialEvents, selectedEventId]
  )

  const value = useMemo(
    () => ({
      events: initialEvents,
      selectedEventId,
      selectedEvent,
      setSelectedEventId,
      isLoading: !hydrated,
    }),
    [initialEvents, selectedEventId, selectedEvent, setSelectedEventId, hydrated]
  )

  return (
    <VendorHubEventContext.Provider value={value}>
      {children}
    </VendorHubEventContext.Provider>
  )
}

export function useVendorHubEvent() {
  const context = useContext(VendorHubEventContext)

  if (!context) {
    throw new Error("useVendorHubEvent must be used within VendorHubEventProvider")
  }

  return context
}

export function useOptionalVendorHubEvent() {
  return useContext(VendorHubEventContext)
}
