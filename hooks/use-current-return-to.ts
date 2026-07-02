"use client"

import { useMemo } from "react"
import { usePathname, useSearchParams } from "next/navigation"

import { buildCurrentPath } from "@/lib/navigation/return-to"

export function useCurrentReturnTo(): string {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  return useMemo(
    () => buildCurrentPath(pathname, searchParams.toString()),
    [pathname, searchParams]
  )
}
