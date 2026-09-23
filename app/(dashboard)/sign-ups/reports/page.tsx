import { Header } from "@/components/layout/header"
import { SignUpsReportsClient } from "@/components/sign-ups/reports/sign-ups-reports-client"
import { requireSignUpsAccess } from "@/lib/sign-ups/sign-up-access"
import { getSignUpReportVolunteers } from "@/lib/sign-ups/sign-up-reports-queries"

export default async function SignUpsReportsPage() {
  await requireSignUpsAccess()

  const volunteers = await getSignUpReportVolunteers()

  return (
    <>
      <Header title="Reports" />
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Volunteers who signed up for an event, with the slot and time they
            took.
          </p>
        </div>
        <SignUpsReportsClient volunteers={volunteers} />
      </div>
    </>
  )
}
