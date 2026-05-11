import Image from "next/image"
import Link from "next/link"

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
    <div className="flex min-h-screen">
      {/* Left decorative panel */}
<div className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center bg-white p-12">
  <div className="flex flex-col items-center justify-center">
    <Link href="/login">
      <Image
        src="/logo.png"
        alt="Manaratee Logo"
        width={700}
        height={300}
        className="h-auto w-[80%] max-w-[700px] object-contain"
        priority
      />
    </Link>
  </div>

      

        <div className="flex gap-6">
          <span className="text-xs text-black/40">Privacy</span>
          <span className="text-xs text-black/40">Terms</span>
          <span className="text-xs text-black/40">Help</span>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex w-full flex-col items-center justify-center px-6 py-12 lg:w-1/2">
        <div className="w-full max-w-[400px]">
          {/* Mobile logo */}
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground">
              <span className="text-sm font-bold text-background">M</span>
            </div>
            <span className="text-lg font-semibold tracking-tight text-foreground">
              Your Organization
            </span>
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
