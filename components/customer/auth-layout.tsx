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
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-foreground p-12 text-background">
        <div>
          <Link href="/login" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-background/10">
              <span className="text-sm font-bold text-background">M</span>
            </div>
            <span className="text-lg font-semibold tracking-tight text-background">
              Your Organization
            </span>
          </Link>
        </div>

        <div className="flex flex-col gap-6">
          <blockquote className="text-xl font-medium leading-relaxed text-background/90 text-pretty">
            &ldquo;A place for your community to connect, participate, and stay informed.&rdquo;
          </blockquote>
          <p className="text-sm text-background/50">
            Powered by Manaratee
          </p>
        </div>

        <div className="flex gap-6">
          <span className="text-xs text-background/40">Privacy</span>
          <span className="text-xs text-background/40">Terms</span>
          <span className="text-xs text-background/40">Help</span>
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
