import { redirect } from "next/navigation"

export default function SignUpsApplicationsRedirectPage() {
  redirect("/applications/all?application_type=volunteer")
}
