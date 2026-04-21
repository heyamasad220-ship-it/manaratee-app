"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft, Mail } from "lucide-react"
import { AuthLayout } from "@/components/customer/auth-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function ForgotPasswordPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)
    setTimeout(() => {
      setIsLoading(false)
      setSubmitted(true)
    }, 800)
  }

  return (
    <AuthLayout
      heading={submitted ? "Check your email" : "Reset your password"}
      subheading={
        submitted
          ? "We sent a password reset link to your email. Please check your inbox."
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
              onClick={() => setSubmitted(false)}
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
              />
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Sending link..." : "Send reset link"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            <Link href="/login" className="inline-flex items-center font-medium text-primary hover:underline">
              <ArrowLeft className="mr-1 h-3.5 w-3.5" />
              Back to sign in
            </Link>
          </p>
        </>
      )}
    </AuthLayout>
  )
}
