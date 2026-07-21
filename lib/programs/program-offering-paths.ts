export function programOfferingManageHref(
  programId: string,
  offeringId: string,
  tab?: string
) {
  const base = `/programs/${programId}/offerings/${offeringId}`
  if (!tab || tab === "overview") return base
  return `${base}?tab=${encodeURIComponent(tab)}`
}

export function programOfferingsIndexHref(programId: string) {
  return `/programs/${programId}/offerings`
}
