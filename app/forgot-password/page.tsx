"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft, Loader2, Mail } from "lucide-react"
import { AuthLayout } from "@/components/customer/auth-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/lib/supabase/client"
import { passwordResetRedirectUrl } from "@/lib/auth/auth-redirect"

export default function ForgotPasswordPage() {
  const supabase = createClient()

  const [email, setEmail] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setIsLoading(true)
    setError(null)

    const cleanEmail = email.trim().toLowerCase()
    if (!cleanEmail) {
      setError("Enter your email address.")
      setIsLoading(false)
      return
    }

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo: passwordResetRedirectUrl(),
    })

    setIsLoading(false)

    if (resetError) {
      setError(resetError.message)
      return
    }

    setSubmitted(true)
  }

  return (
    <AuthLayout
      heading={submitted ? "Check your email" : "Reset your password"}
      subheading={
        submitted
          ? "We sent a password reset link to your email. Open it to choose a new password."
          : "Enter your email address and we'll send you a link to reset your password."
      }
    >
      {submitted ? (
        <div className="flex flex-col gap-5">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Mail className="h-6 w-6 text-primary" />
          </div>

          <Button variant="outline" className="w-full" asChild>
            <Link href="/login">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to sign in
            </Link>
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            Didn&apos;t receive the email?{" "}
            <button
              type="button"
              onClick={() => {
                setSubmitted(false)
                setError(null)
              }}
              className="font-medium text-primary hover:underline"
            >
              Try again
            </button>
          </p>
        </div>
      ) : (
        <>
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                required
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={isLoading}
              />
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending link...
                </>
              ) : (
                "Send reset link"
              )}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            <Link
              href="/login"
              className="inline-flex items-center font-medium text-primary hover:underline"
            >
              <ArrowLeft className="mr-1 h-3.5 w-3.5" />
              Back to sign in
            </Link>
          </p>
        </>
      )}
    </AuthLayout>
  )
}
