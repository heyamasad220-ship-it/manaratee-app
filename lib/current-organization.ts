let cachedOrganizationId: string | null | undefined
let cachedPlatformSupportMode: boolean | undefined
let inFlightOrganizationContext: Promise<{
  organizationId: string | null
  platformSupportMode: boolean
}> | null = null

async function fetchOrganizationContextFromApi() {
  try {
    const response = await fetch("/api/organizations/selected", {
      method: "GET",
      cache: "no-store",
    })

    if (!response.ok) {
      return { organizationId: null, platformSupportMode: false }
    }

    const payload = (await response.json()) as {
      organizationId?: string | null
      platformSupportMode?: boolean
    }

    return {
      organizationId: payload.organizationId?.trim() || null,
      platformSupportMode: payload.platformSupportMode === true,
    }
  } catch (error) {
    console.error("Error resolving selected organization:", error)
    return { organizationId: null, platformSupportMode: false }
  }
}

export async function getCurrentOrganizationContext() {
  if (cachedOrganizationId !== undefined && cachedPlatformSupportMode !== undefined) {
    return {
      organizationId: cachedOrganizationId,
      platformSupportMode: cachedPlatformSupportMode,
    }
  }

  if (!inFlightOrganizationContext) {
    inFlightOrganizationContext = fetchOrganizationContextFromApi().finally(() => {
      inFlightOrganizationContext = null
    })
  }

  const context = await inFlightOrganizationContext
  cachedOrganizationId = context.organizationId
  cachedPlatformSupportMode = context.platformSupportMode
  return context
}

export async function getCurrentOrganizationId(): Promise<string | null> {
  const context = await getCurrentOrganizationContext()
  return context.organizationId
}

export function clearSelectedOrganizationIdCache() {
  cachedOrganizationId = undefined
  cachedPlatformSupportMode = undefined
}
