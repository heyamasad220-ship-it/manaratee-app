import { redirect } from "next/navigation"

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const code = typeof params.code === "string" ? params.code : null
  const tokenHash = typeof params.token_hash === "string" ? params.token_hash : null
  const type = typeof params.type === "string" ? params.type : null

  if (code || tokenHash) {
    const acceptParams = new URLSearchParams()
    if (code) acceptParams.set("code", code)
    if (tokenHash) acceptParams.set("token_hash", tokenHash)
    if (type) acceptParams.set("type", type)
    acceptParams.set("next", "/auth/set-password")
    redirect(`/auth/accept?${acceptParams.toString()}`)
  }

  redirect("/dashboard")
}
