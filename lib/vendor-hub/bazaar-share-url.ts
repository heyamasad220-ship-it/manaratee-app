import { randomUUID } from "crypto"

import { getAppBaseUrl } from "@/lib/app/get-app-base-url"

export function buildBazaarShareUrl(shareToken: string, baseUrl?: string) {
  const root = (baseUrl ?? getAppBaseUrl()).replace(/\/$/, "")
  return `${root}/bazaar/${shareToken}`
}

export function createBazaarShareToken() {
  return randomUUID().replace(/-/g, "")
}
