import { redirect } from "next/navigation"

export default async function InstructorsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab } = await searchParams
  const pageTab =
    tab === "assignments" || tab === "documents"
      ? tab
      : tab === "overview" || !tab
        ? "employees"
        : "employees"

  redirect(`/workforce/employees?tab=${pageTab}`)
}
