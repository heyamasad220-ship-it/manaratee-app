import { redirect } from "next/navigation"

export default async function HrEmployeeDetailRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  redirect(`/workforce/employees/${id}`)
}
