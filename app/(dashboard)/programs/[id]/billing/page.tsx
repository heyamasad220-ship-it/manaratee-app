import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft } from "lucide-react"

import { Header } from "@/components/layout/header"
import { ProgramBillingScheduleView } from "@/components/programs/program-billing-schedule-view"
import { Button } from "@/components/ui/button"
import { getProgramById } from "@/lib/programs/program-queries"
import { getOfferingBillingScheduleBundle } from "@/lib/programs/program-billing-queries"
import {
  BILLING_MIGRATION_MESSAGE,
  BILLING_MIGRATION_SCRIPTS,
} from "@/lib/programs/program-billing-schema"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"

function formatDate(value: string | null) {
  if (!value) return "Not set"

  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export default async function ProgramBillingPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    notFound()
  }

  const program = await getProgramById(id)

  if (!program) {
    notFound()
  }

  const { bundle, migrationRequired } = await getOfferingBillingScheduleBundle(
    id,
    organizationId
  )

  return (
    <>
      <Header title="Programs" />

      <div className="flex flex-col gap-6 p-6">
        <div>
          <Link
            href={`/programs/${id}`}
            className="mb-3 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Program
          </Link>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                Billing Schedule
              </h1>
              <p className="mt-2 text-muted-foreground">
                {program.name}
                {bundle
                  ? ` · ${bundle.offering.name} (${formatDate(bundle.offering.start_date)} – ${formatDate(bundle.offering.end_date)})`
                  : null}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Phase 2B charge ledger only — no Stripe, payment gateway, or
                auto-charge.
              </p>
            </div>

            <Button variant="outline" asChild>
              <Link href={`/programs/${id}/edit`}>Edit Program & Fee Plan</Link>
            </Button>
          </div>
        </div>

        {migrationRequired ? (
          <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-4 text-sm text-amber-950">
            <p className="font-medium">Database migration required</p>
            <p className="mt-2">{BILLING_MIGRATION_MESSAGE}</p>
            <ol className="mt-3 list-decimal space-y-1 pl-5">
              {BILLING_MIGRATION_SCRIPTS.map((script) => (
                <li key={script}>
                  <code className="rounded bg-amber-100 px-1.5 py-0.5 text-xs">
                    {script}
                  </code>
                </li>
              ))}
            </ol>
          </div>
        ) : null}

        {!bundle ? (
          <div className="rounded-lg border bg-muted/30 p-6 text-sm text-muted-foreground">
            This program does not have a default offering configured yet. Add an
            offering with start and end dates to generate the billing calendar.
          </div>
        ) : (
          <ProgramBillingScheduleView
            programId={id}
            bundle={bundle}
            readOnly={migrationRequired}
          />
        )}
      </div>
    </>
  )
}
