import { redirect } from "next/navigation"
import { hrOverviewHref } from "@/lib/hr/hr-overview-path"

export default async function InstructorsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  await searchParams
  redirect(hrOverviewHref({ tab: "employees" }))
}
