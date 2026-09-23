import { Header } from "@/components/layout/header"
import { SignUpsOverviewClient } from "@/components/sign-ups/overview/sign-ups-overview-client"
import { requireSignUpsAccess } from "@/lib/sign-ups/sign-up-access"
import { getSignUpOverviewEvents } from "@/lib/sign-ups/sign-up-overview-queries"

export default async function SignUpsOverviewPage() {
  await requireSignUpsAccess()

  const events = await getSignUpOverviewEvents()

  return (
    <>
      <Header title="Overview" />
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Events that need volunteers. The event itself stays in Event
            Management or Vendor Hub. Open the name to work on it there.
          </p>
        </div>
        <SignUpsOverviewClient events={events} />
      </div>
    </>
  )
}
