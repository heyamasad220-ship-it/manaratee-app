"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Check } from "lucide-react"

import { DonationOpsPanel } from "@/components/donations/donation-ops-panel"
import { PaymentImportMatchWorkspace } from "@/components/donations/payment-import-match-workspace"
import { donationImportMatchHref } from "@/lib/donations/donation-payment-paths"
import { cn } from "@/lib/utils"

const STEPS = [
  { id: "import", label: "Import File" },
  { id: "match", label: "Auto-Match" },
  { id: "review", label: "Review Exceptions" },
  { id: "done", label: "Complete" },
] as const

export function DonationImportMatchPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const view = searchParams.get("view") === "match" ? "match" : "import"
  const currentStep = view === "match" ? 2 : 0

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Import & Match</h2>
        <p className="text-sm text-muted-foreground">
          Import external payments, then match them to contacts and pledges. Standalone donations do
          not need a pledge.
        </p>
      </div>

      <ol className="flex flex-wrap items-center gap-2 text-sm">
        {STEPS.map((step, index) => {
          const href =
            index <= 1
              ? donationImportMatchHref({ view: "import" })
              : donationImportMatchHref({ view: "match" })
          const complete = index < currentStep
          const active = index === currentStep
          return (
            <li key={step.id} className="flex items-center gap-2">
              {index > 0 ? <span className="text-muted-foreground">→</span> : null}
              <Link
                href={href}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-3 py-1.5",
                  active
                    ? "border-primary bg-primary/5 text-foreground"
                    : complete
                      ? "border-border text-muted-foreground"
                      : "border-transparent text-muted-foreground"
                )}
              >
                <span
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-full text-xs",
                    active || complete ? "bg-primary text-primary-foreground" : "bg-muted"
                  )}
                >
                  {complete ? <Check className="h-3 w-3" /> : index + 1}
                </span>
                {step.label}
              </Link>
            </li>
          )
        })}
      </ol>

      {view === "match" ? <DonationOpsPanel /> : null}

      <PaymentImportMatchWorkspace
        key={view}
        mode={view}
        onImported={() => router.push(donationImportMatchHref({ view: "match" }))}
      />
    </div>
  )
}
