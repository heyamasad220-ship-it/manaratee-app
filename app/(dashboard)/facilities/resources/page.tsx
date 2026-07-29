import { redirect } from "next/navigation"

/** Legacy resources route — use Facilities → Inventory. */
export default function FacilitiesResourcesRedirectPage() {
  redirect("/facilities/inventory")
}
