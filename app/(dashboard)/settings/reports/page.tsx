import { redirect } from "next/navigation"

/** Legacy Settings → Reports placeholder; org Reports lives at `/reports`. */
export default function SettingsReportsRedirectPage() {
  redirect("/reports")
}
