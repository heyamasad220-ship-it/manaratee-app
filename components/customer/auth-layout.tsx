import Image from "next/image"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"

export function SocialLoginButtons() {
  const supabase = createClient()

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
  }

  const signInWithApple = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "apple",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
  }
}
export function AuthLayout({
  children,
  heading,
  subheading,
}: {
  children: React.ReactNode
  heading: string
  subheading?: string
}) {
  return (
    <div className="flex min-h-screen bg-white">
      {/* Left logo panel */}
      <div className="hidden lg:flex lg:w-1/2 items-center justify-center bg-white px-12">
        <Link href="/login" className="block w-full max-w-[760px]">
          <Image
            src="/logo.png"
            alt="Manaratee Logo"
            width={900}
            height={420}
            className="h-auto w-full object-contain"
            priority
          />
        </Link>
      </div>

      {/* Right form panel */}
      <div className="flex w-full flex-col items-center justify-center px-6 py-12 lg:w-1/2 bg-muted/30">
        <div className="w-full max-w-[400px]">
          {/* Mobile logo */}
          <div className="mb-8 flex justify-center lg:hidden">
            <Link href="/login" className="block w-full max-w-[320px]">
              <Image
                src="/logo.png"
                alt="Manaratee Logo"
                width={500}
                height={220}
                className="h-auto w-full object-contain"
                priority
              />
            </Link>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight text-foreground text-balance">
              {heading}
            </h1>

            {subheading && (
              <p className="mt-2 text-sm text-muted-foreground">
                {subheading}
              </p>
            )}
          </div>

          {children}
        </div>
      </div>
    </div>
  )
}