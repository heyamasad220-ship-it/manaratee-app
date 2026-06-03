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

  if (code) {
    const callbackParams = new URLSearchParams()
    callbackParams.set("code", code)
    callbackParams.set("next", "/auth/set-password")
    redirect(`/auth/callback?${callbackParams.toString()}`)
  }

  if (tokenHash && type) {
    const confirmParams = new URLSearchParams()
    confirmParams.set("token_hash", tokenHash)
    confirmParams.set("type", type)
    confirmParams.set("next", "/auth/set-password")
    redirect(`/auth/confirm?${confirmParams.toString()}`)
  }

  redirect("/login")
}
