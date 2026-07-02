"use client"

import { useEffect } from "react"
import { usePathname, useSearchParams } from "next/navigation"

import {
  buildCurrentPath,
  isContactProfilePath,
  writeStoredReturnToPath,
} from "@/lib/navigation/return-to"

/** Remember the last non-contact-profile dashboard page for profile back navigation. */
export function DashboardReturnTracker() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (!pathname || isContactProfilePath(pathname)) return
    writeStoredReturnToPath(buildCurrentPath(pathname, searchParams.toString()))
  }, [pathname, searchParams])

  return null
}
