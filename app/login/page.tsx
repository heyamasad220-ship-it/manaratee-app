"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Eye, EyeOff, Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { AuthLayout } from "@/components/customer/auth-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"

type AuthMode = "login" | "signup"

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  )
}

function AppleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  )
}

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()

  const [mode, setMode] = useState<AuthMode>("login")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [repeatPassword, setRepeatPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [socialLoading, setSocialLoading] = useState<"google" | "apple" | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function setSelectedOrganization(organizationId: string) {
    const response = await fetch("/api/organizations/select", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ organizationId }),
    })

    if (!response.ok) {
      throw new Error("Failed to set selected organization")
    }
  }

  async function routeUserByRole(userId: string) {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("is_platform_admin")
      .eq("id", userId)
      .maybeSingle()

    if (profileError) throw profileError

    if (profile?.is_platform_admin === true) {
      router.push("/admin/dashboard")
      return
    }

    const { data: memberships, error: membershipError } = await supabase
      .from("organization_members")
      .select("organization_id, role, status")
      .eq("user_id", userId)
      .eq("status", "active")

    if (membershipError) throw membershipError

    const orgAdminMembership = memberships?.find((membership) =>
      ["super_admin", "admin", "coordinator", "viewer"].includes(membership.role)
    )

    if (orgAdminMembership) {
      await setSelectedOrganization(orgAdminMembership.organization_id)
      router.push("/dashboard")
      return
    }

    const customerMembership = memberships?.find(
      (membership) => membership.role === "customer"
    )

    if (customerMembership) {
      router.push("/customer/dashboard")
      return
    }

    const { data: customerProfile, error: customerError } = await supabase
      .from("customer_profiles")
      .select("organization_id")
      .eq("id", userId)
      .maybeSingle()

    if (customerError) throw customerError

    if (customerProfile?.organization_id) {
      router.push("/customer/dashboard")
      return
    }

    router.push("/customer/dashboard")
  }

  async function handleEmailPasswordLogin() {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      throw new Error(error.message)
    }

    if (!data.user) {
      throw new Error("Login failed")
    }

    await routeUserByRole(data.user.id)
  }

  async function handleSignUp() {
    if (password !== repeatPassword) {
      throw new Error("Passwords do not match")
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) throw error

    if (!data.user) {
      throw new Error("Sign up failed")
    }

    if (!data.session) {
      router.push("/auth/confirm")
      return
    }

    await routeUserByRole(data.user.id)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      if (mode === "signup") {
        await handleSignUp()
      } else {
        await handleEmailPasswordLogin()
      }
    } catch (err: unknown) {
      console.error("LOGIN ERROR:", err)
      setError(err instanceof Error ? err.message : "Authentication failed")
      setIsLoading(false)
    }
  }

  async function handleSocialSignIn(provider: "google" | "apple") {
    setSocialLoading(provider)
    setError(null)

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (error) throw error
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Social sign-in failed")
      setSocialLoading(null)
    }
  }

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode)
    setError(null)
    setPassword("")
    setRepeatPassword("")
  }

  return (
    <AuthLayout
      heading={mode === "login" ? "Welcome back" : "Create your account"}
      subheading={
        mode === "login"
          ? "Sign in to your account to continue."
          : "Sign up to get started."
      }
    >
      <div className="flex flex-col gap-3">
        <Button
          type="button"
          variant="outline"
          className="h-11 w-full"
          onClick={() => handleSocialSignIn("google")}
          disabled={socialLoading !== null || isLoading}
        >
          {socialLoading === "google" ? (
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          ) : (
            <GoogleIcon className="mr-2 h-5 w-5" />
          )}
          Continue with Google
        </Button>

        <Button
          type="button"
          variant="outline"
          className="h-11 w-full"
          onClick={() => handleSocialSignIn("apple")}
          disabled={socialLoading !== null || isLoading}
        >
          {socialLoading === "apple" ? (
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          ) : (
            <AppleIcon className="mr-2 h-5 w-5" />
          )}
          Continue with Apple
        </Button>
      </div>

      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <Separator className="w-full" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">
            Or continue with email
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            required
            autoComplete="email"
            className="h-11"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isLoading || socialLoading !== null}
          />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>

            {mode === "login" && (
              <Link
                href="/forgot-password"
                className="text-xs font-medium text-primary hover:underline"
              >
                Forgot password?
              </Link>
            )}
          </div>

          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password"
              required
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              className="h-11 pr-10"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading || socialLoading !== null}
            />

            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label={showPassword ? "Hide password" : "Show password"}
              disabled={isLoading || socialLoading !== null}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        {mode === "signup" && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="repeat-password">Repeat Password</Label>
            <Input
              id="repeat-password"
              type={showPassword ? "text" : "password"}
              placeholder="Repeat your password"
              required
              autoComplete="new-password"
              className="h-11"
              value={repeatPassword}
              onChange={(e) => setRepeatPassword(e.target.value)}
              disabled={isLoading || socialLoading !== null}
            />
          </div>
        )}

        {error && <p className="text-sm text-red-500">{error}</p>}

        <Button
          type="submit"
          className="h-11 w-full"
          disabled={isLoading || socialLoading !== null}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {mode === "login" ? "Signing in..." : "Creating account..."}
            </>
          ) : mode === "login" ? (
            "Sign in"
          ) : (
            "Create account"
          )}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        {mode === "login" ? (
          <>
            Don&apos;t have an account?{" "}
            <button
              type="button"
              onClick={() => switchMode("signup")}
              className="font-medium text-primary hover:underline"
            >
              Sign up
            </button>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <button
              type="button"
              onClick={() => switchMode("login")}
              className="font-medium text-primary hover:underline"
            >
              Sign in
            </button>
          </>
        )}
      </p>
    </AuthLayout>
  )
}