import { redirect } from "next/navigation"
import Link from "next/link"

import { CustomerVendorProfileClient } from "@/components/customer/customer-vendor-profile-client"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { requireCustomerPortalPageContext } from "@/lib/auth/require-customer-portal-page"
import { getCustomerVendorProfileAction } from "@/lib/vendor-hub/customer-vendor-profile-actions"
import { isAuthUserApprovedVendorForOrganization } from "@/lib/vendor-hub/vendor-eligibility-queries"
import { CUSTOMER_VENDOR_APPLY_PATH } from "@/lib/applications/application-routes"

export default async function CustomerVendorProfilePage() {
  const { organizationId, userId } = await requireCustomerPortalPageContext()

  const isApprovedVendor = await isAuthUserApprovedVendorForOrganization(
    userId,
    organizationId
  )

  if (!isApprovedVendor) {
    redirect("/customer/opportunities")
  }

  const result = await getCustomerVendorProfileAction(organizationId)

  if (!result.success) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <Card>
          <CardHeader>
            <CardTitle>Vendor profile unavailable</CardTitle>
            <CardDescription>{result.error}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href="/customer/bazaars">My Bazaars</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={CUSTOMER_VENDOR_APPLY_PATH}>Apply as vendor</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6">
      <CustomerVendorProfileClient profile={result.profile} />
    </div>
  )
}
