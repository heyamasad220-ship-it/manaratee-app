import { redirect } from "next/navigation"

import { requireCustomerPortalPageContext } from "@/lib/auth/require-customer-portal-page"
import {
  getContactProfileModuleFlags,
  showContactFinancialSurfaces,
} from "@/lib/contacts/contact-profile-module-access"
import { loadCustomerPortalEnabledModuleSlugs } from "@/lib/customer/customer-portal-modules-server"

export default async function CustomerTransactionsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { organizationId } = await requireCustomerPortalPageContext()
  const enabledSlugs = await loadCustomerPortalEnabledModuleSlugs(organizationId)
  const modules = getContactProfileModuleFlags(enabledSlugs)

  if (!showContactFinancialSurfaces(modules)) {
    redirect("/customer/dashboard")
  }

  return children
}
