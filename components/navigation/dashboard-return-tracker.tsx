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
  const search = searchParams.toString()

  useEffect(() => {
    if (!pathname || isContactProfilePath(pathname)) return
    writeStoredReturnToPath(buildCurrentPath(pathname, search))
  }, [pathname, search])

  return null
}
