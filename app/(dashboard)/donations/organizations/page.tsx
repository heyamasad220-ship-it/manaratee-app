import { Header } from "@/components/layout/header"
import { OrganizationsList } from "@/components/people/organizations-list"

export default function OrganizationsPage() {
  return (
    <>
      <Header title="Organizations" />
      <OrganizationsList basePath="/donations/organizations" />
    </>
  )
}
