import { redirect } from "next/navigation"

/** Resources settings tab moved to Facilities → Inventory. */
export default function FacilitiesResourcesSettingsRedirectPage() {
  redirect("/facilities/inventory")
}
