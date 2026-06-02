"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2 } from "lucide-react"
import type { EmailOtpType } from "@supabase/supabase-js"
import { AuthLayout } from "@/components/customer/auth-layout"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { SET_PASSWORD_PATH } from "@/lib/auth/auth-redirect"

export default function AuthAcceptPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function completeAuth() {
      const next = searchParams.get("next") ?? SET_PASSWORD_PATH
      const safeNext = next.startsWith("/") ? next : SET_PASSWORD_PATH

      const authError = searchParams.get("error_description") ?? searchParams.get("error")
      if (authError) {
        setError(decodeURIComponent(authError.replace(/\+/g, " ")))
        return
      }

      const code = searchParams.get("code")
      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
        if (exchangeError) {
          setError(exchangeError.message)
          return
        }

        router.replace(safeNext)
        return
      }

      const tokenHash = searchParams.get("token_hash")
      const type = searchParams.get("type") as EmailOtpType | null
      if (tokenHash && type) {
        const { error: verifyError } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type,
        })
        if (verifyError) {
          setError(verifyError.message)
          return
        }

        router.replace(safeNext)
        return
      }

      const hash = window.location.hash
      if (hash.includes("access_token") || hash.includes("refresh_token")) {
        const { error: sessionError } = await supabase.auth.getSession()
        window.history.replaceState(null, "", window.location.pathname + window.location.search)

        if (sessionError) {
          setError(sessionError.message)
          return
        }

        router.replace(safeNext)
        return
      }

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        router.replace(safeNext)
        return
      }

      setError(
        "This invite link is invalid or has expired. Ask your administrator to send a new invitation."
      )
    }

    void completeAuth()
  }, [router, searchParams, supabase.auth])

  return (
    <AuthLayout
      heading="Accepting invitation"
      subheading="Please wait while we verify your invite link."
    >
      {error ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-red-500">{error}</p>
          <p className="text-sm text-muted-foreground">
            Invited users cannot sign up from the login page. Open the invite email and use
            that link, or ask your administrator to resend the invitation.
          </p>
          <Button asChild variant="outline" className="w-full">
            <Link href="/login">Back to sign in</Link>
          </Button>
        </div>
      ) : (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Loading...
        </div>
      )}
    </AuthLayout>
  )
}
