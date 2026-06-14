import { redirect } from "next/navigation"

export default function GlobalSettingsPage() {
  redirect("/settings/users")
}
