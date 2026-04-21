import { createClient } from "@/lib/supabase/server"

export default async function OrganizationPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: organization, error } = await supabase
    .from("organizations")
    .select("id, name")
    .eq("id", id)
    .maybeSingle()

  if (error || !organization) {
    return (
      <div style={{ padding: "20px" }}>
        <h1>Organization not found</h1>
        <p>Requested ID: {id}</p>
        <p>Error: {error?.message ?? "No row returned"}</p>
      </div>
    )
  }

  return (
    <div style={{ padding: "20px" }}>
      <h1>Welcome to {organization.name}</h1>
      <p>Organization ID: {organization.id}</p>
    </div>
  )
}