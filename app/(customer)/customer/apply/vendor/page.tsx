import Link from "next/link"
import { cookies } from "next/headers"
import { ArrowLeft } from "lucide-react"

import { VendorApplyClient } from "@/components/customer/vendor-apply-client"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { fetchContactApplications } from "@/lib/applications/application-actions"
import { resolveCustomerPortalSession } from "@/lib/auth/customer-portal-session"
import { getMyOrganizations } from "@/lib/organizations/get-my-organizations"
import { getCustomerContactForUser } from "@/lib/programs/registration-contact-resolver"
import { createClient } from "@/lib/supabase/server"
import { getVendorHubVendorTypes } from "@/lib/vendor-hub/vendor-type-queries"
import { VENDOR_ORG_APPLICATION_TYPE } from "@/lib/vendor-hub/vendor-participation-model"

type CustomerOrganization = {
  organization_id: string
  organization_name: string
  role_name: string
}

export default async function CustomerVendorApplyPage() {
  const session = await resolveCustomerPortalSession()
  if (!session?.effectiveUserId) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-6">
        <Card>
          <CardHeader>
            <CardTitle>Sign in required</CardTitle>
            <CardDescription>
              Sign in to your community account to apply as a vendor.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/login">Sign in</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const cookieStore = await cookies()
  const organizations = (await getMyOrganizations()) as CustomerOrganization[]
  const selectedOrganizationId = cookieStore.get("active_organization_id")?.value
  const organizationId =
    selectedOrganizationId &&
    organizations.some((org) => org.organization_id === selectedOrganizationId)
      ? selectedOrganizationId
      : organizations[0]?.organization_id

  if (!organizationId) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-6">
        <Card>
          <CardHeader>
            <CardTitle>Organization required</CardTitle>
            <CardDescription>
              Join or select an organization before submitting a vendor application.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  const contact = await getCustomerContactForUser(
    organizationId,
    session.effectiveUserId
  )

  if (!contact?.id) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 p-6">
        <Button variant="ghost" size="sm" className="w-fit px-0" asChild>
          <Link href="/customer/profile/applications">
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Applications
          </Link>
        </Button>
        <Card>
          <CardHeader>
            <CardTitle>Link your contact profile</CardTitle>
            <CardDescription>
              Your account needs a linked contact before you can submit a vendor application.
              Complete your profile first, then return here.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/customer/profile">Open profile</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const supabase = await createClient()
  const [{ data: contactDetails }, vendorTypes] = await Promise.all([
    supabase
      .from("contacts")
      .select("email, phone, full_name")
      .eq("organization_id", organizationId)
      .eq("id", contact.id)
      .maybeSingle(),
    getVendorHubVendorTypes({ activeOnly: true }),
  ])

  const existingApplications = (await fetchContactApplications(contact.id)).filter(
    (app) => app.application_type === VENDOR_ORG_APPLICATION_TYPE
  )

  return (
    <div className="mx-auto max-w-3xl p-6">
      <VendorApplyClient
        applicantName={
          contactDetails?.full_name?.trim() || contact.full_name?.trim() || ""
        }
        applicantEmail={
          contactDetails?.email?.trim() ||
          contact.email?.trim() ||
          session.authenticatedUser.email ||
          ""
        }
        applicantPhone={
          contactDetails?.phone?.trim() || contact.phone?.trim() || ""
        }
        vendorTypes={vendorTypes}
        existingApplications={existingApplications}
      />
    </div>
  )
}
