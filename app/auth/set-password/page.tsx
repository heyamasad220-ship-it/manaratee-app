"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2 } from "lucide-react"
import { AuthLayout } from "@/components/customer/auth-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"
import { routeUserByRole } from "@/lib/auth/route-user"
import { selectOrganization } from "@/lib/organizations/organization-actions"
import { profileRoleFromSystemRole } from "@/lib/organizations/sync-profile-organization"

function SetPasswordLoading() {
  return (
    <AuthLayout
      heading="Setting up your account"
      subheading="Please wait while we verify your invitation."
    >
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading...
      </div>
    </AuthLayout>
  )
}

function SetPasswordContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const [checkingSession, setCheckingSession] = useState(true)
  const [isRecovery, setIsRecovery] = useState(false)
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    async function ensureSession() {
      const isRecoveryFlow =
        searchParams.get("type") === "recovery" ||
        searchParams.get("mode") === "recovery"
      setIsRecovery(isRecoveryFlow)

      const hash = window.location.hash
      if (hash.includes("access_token") || hash.includes("refresh_token")) {
        await supabase.auth.getSession()
        window.history.replaceState(null, "", window.location.pathname)
      }

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        const emailParam = searchParams.get("email")
        const loginParams = new URLSearchParams()
        if (emailParam) loginParams.set("email", emailParam)
        loginParams.set(
          "error",
          isRecoveryFlow
            ? "Your password reset link expired or was already used. Request a new link from the sign-in page."
            : "Your invite link expired or was already used. Sign in with your password, or ask for a new invite."
        )
        router.replace(`/login?${loginParams.toString()}`)
        return
      }

      setCheckingSession(false)
    }

    void ensureSession()
  }, [router, searchParams, supabase.auth])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError("Password must be at least 8 characters.")
      return
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.")
      return
    }

    setIsSaving(true)

    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) {
        throw updateError
      }

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        throw new Error(
          isRecovery
            ? "Session expired. Request a new password reset link from the sign-in page."
            : "Session expired. Open the invite link again."
        )
      }

      const organizationId = user.user_metadata?.organization_id as string | undefined
      if (organizationId) {
        await selectOrganization(organizationId)

        await supabase.from("profiles").upsert(
          {
            id: user.id,
            email: user.email ?? undefined,
            organization_id: organizationId,
            role: profileRoleFromSystemRole("viewer"),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" }
        )
      }

      await routeUserByRole(user.id, router)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not save password.")
      setIsSaving(false)
    }
  }

  if (checkingSession) {
    return <SetPasswordLoading />
  }

  return (
    <AuthLayout
      heading={isRecovery ? "Reset your password" : "Create your password"}
      subheading={
        isRecovery
          ? "Choose a new password for your Manaratee account."
          : "Choose a password to finish setting up your Manaratee account."
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={isSaving}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="confirm-password">Confirm password</Label>
          <Input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            disabled={isSaving}
          />
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <Button type="submit" className="w-full" disabled={isSaving}>
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : isRecovery ? (
            "Save new password"
          ) : (
            "Save password and continue"
          )}
        </Button>
      </form>
    </AuthLayout>
  )
}

export default function SetPasswordPage() {
  return (
    <Suspense fallback={<SetPasswordLoading />}>
      <SetPasswordContent />
    </Suspense>
  )
}
