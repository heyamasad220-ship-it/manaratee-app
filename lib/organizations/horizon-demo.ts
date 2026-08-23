export const HORIZON_DEMO_ORGANIZATION_NAME = "Horizon Community Foundation"
export const HORIZON_DEMO_STAFF_DISPLAY_NAME = "Admin"

export function isHorizonDemoOrganization(name: string | null | undefined) {
  return name?.trim().toLowerCase() === HORIZON_DEMO_ORGANIZATION_NAME.toLowerCase()
}
