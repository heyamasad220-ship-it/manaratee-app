import { notFound } from "next/navigation"
import { Suspense } from "react"
import { OrganizationJoinClient } from "@/components/customer/organization-join-client"
import { AuthLayout } from "@/components/customer/auth-layout"
import { Loader2 } from "lucide-react"
import { getJoinOrganizationBySlug } from "@/lib/organizations/join-organization-actions"

function JoinLoading() {
  return (
    <AuthLayout heading="Join organization" subheading="Loading...">
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading...
      </div>
    </AuthLayout>
  )
}

async function JoinPageContent({ orgSlug }: { orgSlug: string }) {
  const organization = await getJoinOrganizationBySlug(orgSlug)

  if (!organization) {
    notFound()
  }

  return <OrganizationJoinClient organization={organization} />
}

export default async function JoinOrganizationPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params

  return (
    <Suspense fallback={<JoinLoading />}>
      <JoinPageContent orgSlug={orgSlug} />
    </Suspense>
  )
}
