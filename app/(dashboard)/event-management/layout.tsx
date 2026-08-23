import type { Metadata } from "next"

import { requireOrganizationModule } from "@/lib/modules/dashboard-module-access-server"

export const metadata: Metadata = {
  title: "Event Management",
}

export default async function EventManagementLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireOrganizationModule("event-management")
  return children
}
