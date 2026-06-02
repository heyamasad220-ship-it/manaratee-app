import { redirect } from "next/navigation"

export default function VendorHubApplicationsRedirectPage() {
  redirect("/applications/all?application_type=vendor")
}
