"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Eye, EyeOff, Loader2 } from "lucide-react"
import { AuthLayout } from "@/components/customer/auth-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { authCallbackUrl } from "@/lib/auth/auth-redirect"
import { sanitizeCustomerPortalRedirectPath } from "@/lib/auth/sanitize-customer-redirect-path"
import { routeUserByRole } from "@/lib/auth/route-user"
import {
  joinOrganizationAsCustomer,
  type JoinOrganizationSummary,
} from "@/lib/organizations/join-organization-actions"
import { createClient } from "@/lib/supabase/client"

type AuthMode = "signup" | "login"

function buildCompleteJoinPath(orgSlug: string, postJoinNext: string | null) {
  const params = new URLSearchParams()
  params.set("step", "complete")
  if (postJoinNext) {
    params.set("next", postJoinNext)
  }
  return `/join/${orgSlug}?${params.toString()}`
}

export function OrganizationJoinClient({
  organization,
}: {
  organization: JoinOrganizationSummary
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const [mode, setMode] = useState<AuthMode>("signup")
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [repeatPassword, setRepeatPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const postJoinNext = sanitizeCustomerPortalRedirectPath(searchParams.get("next"))
  const isDonationJoin = postJoinNext?.startsWith("/customer/donation") ?? false
  const completeJoinPath = buildCompleteJoinPath(organization.slug, postJoinNext)

  const finishJoin = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setError("Please sign in to finish joining this organization.")
      return false
    }

    const metadata = user.user_metadata ?? {}
    const resolvedFirstName =
      firstName.trim() ||
      String(metadata.first_name || metadata.firstName || "").trim() ||
      "Member"
    const resolvedLastName =
      lastName.trim() || String(metadata.last_name || metadata.lastName || "").trim()

    const result = await joinOrganizationAsCustomer({
      organizationId: organization.id,
      organizationSlug: organization.slug,
      firstName: resolvedFirstName,
      lastName: resolvedLastName,
    })

    if (!result.success) {
      setError(result.error)
      return false
    }

    await routeUserByRole(user.id, router, { customerPath: postJoinNext })
    return true
  }, [firstName, lastName, organization.id, organization.slug, postJoinNext, router, supabase.auth])

  useEffect(() => {
    if (searchParams.get("step") !== "complete") {
      return
    }

    setIsLoading(true)
    void finishJoin().finally(() => setIsLoading(false))
  }, [finishJoin, searchParams])

  async function handleSignUp() {
    if (password !== repeatPassword) {
      throw new Error("Passwords do not match")
    }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: authCallbackUrl(completeJoinPath),
        data: {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          join_organization_id: organization.id,
          join_organization_slug: organization.slug,
        },
      },
    })

    if (signUpError) {
      throw signUpError
    }

    if (!data.user) {
      throw new Error("Sign up failed")
    }

    if (!data.session) {
      setInfo(
        isDonationJoin
          ? "Check your email to confirm your account. After confirming, you'll return here and can make your donation."
          : "Check your email to confirm your account. After confirming, you'll return here to finish joining."
      )
      return
    }

    const joined = await finishJoin()
    if (!joined) {
      throw new Error("Account created, but we could not link you to this organization.")
    }
  }

  async function handleLogin() {
    const { data, error: loginError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (loginError) {
      throw loginError
    }

    if (!data.user) {
      throw new Error("Login failed")
    }

    const joined = await finishJoin()
    if (!joined) {
      throw new Error("Signed in, but we could not link you to this organization.")
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setIsLoading(true)
    setError(null)
    setInfo(null)

    try {
      if (mode === "signup") {
        await handleSignUp()
      } else {
        await handleLogin()
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setIsLoading(false)
    }
  }

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode)
    setError(null)
    setInfo(null)
    setPassword("")
    setRepeatPassword("")
  }

  return (
    <AuthLayout
      heading={isDonationJoin ? `Donate to ${organization.name}` : `Join ${organization.name}`}
      subheading={
        isDonationJoin
          ? "Create an account or sign in to make a one-time or recurring gift."
          : "Create an account or sign in to access programs, registrations, and your customer portal."
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {mode === "signup" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="first-name">First name</Label>
              <Input
                id="first-name"
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="last-name">Last name</Label>
              <Input
                id="last-name"
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                required
                disabled={isLoading}
              />
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            disabled={isLoading}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={8}
              disabled={isLoading}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {mode === "signup" && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="repeat-password">Confirm password</Label>
            <Input
              id="repeat-password"
              type="password"
              autoComplete="new-password"
              value={repeatPassword}
              onChange={(event) => setRepeatPassword(event.target.value)}
              required
              minLength={8}
              disabled={isLoading}
            />
          </div>
        )}

        {error && <p className="text-sm text-red-500">{error}</p>}
        {info && <p className="text-sm text-muted-foreground">{info}</p>}

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {mode === "signup" ? "Creating account..." : "Signing in..."}
            </>
          ) : mode === "signup" ? (
            isDonationJoin ? (
              "Create account and donate"
            ) : (
              "Create account and join"
            )
          ) : isDonationJoin ? (
            "Sign in and donate"
          ) : (
            "Sign in and join"
          )}
        </Button>
      </form>

      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <Separator className="w-full" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-muted/30 px-2 text-muted-foreground">
            {mode === "signup" ? "Already have an account?" : "New here?"}
          </span>
        </div>
      </div>

      <Button
        type="button"
        variant="outline"
        className="w-full"
        disabled={isLoading}
        onClick={() => switchMode(mode === "signup" ? "login" : "signup")}
      >
        {mode === "signup" ? "Sign in instead" : "Create a new account"}
      </Button>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Organization staff should use their{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          invite email
        </Link>{" "}
        instead of this page.
      </p>
    </AuthLayout>
  )
}
