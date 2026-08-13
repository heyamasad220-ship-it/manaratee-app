import { redirect } from "next/navigation"
import { Suspense } from "react"

import { Header } from "@/components/layout/header"
import {
  ProgramsAttendanceReportPanel,
  ProgramsWaitlistReportPanel,
} from "@/components/programs/programs-attendance-waitlist-report-panels"
import { ProgramsReportsNav } from "@/components/programs/programs-reports-nav"

export default async function ProgramsReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string | string[] }>
}) {
  const resolved = await searchParams
  const tabRaw = Array.isArray(resolved.tab) ? resolved.tab[0] : resolved.tab
  const tab = (tabRaw || "").trim().toLowerCase()

  if (!tab || tab === "overview" || tab === "enrollment") {
    redirect("/programs/registrations")
  }
  if (tab === "transactions") {
    redirect("/finance/transactions")
  }
  if (tab === "childcare") {
    redirect("/programs/reports/childcare")
  }
  if (tab === "enrollments") {
    redirect("/programs/reports/enrollments")
  }
  if (tab === "tuition-plans" || tab === "payment-summary") {
    redirect("/programs/reports/tuition-plans")
  }
  if (tab === "addons" || tab === "add-ons") {
    redirect("/programs/reports/addons")
  }
  if (tab !== "attendance" && tab !== "waitlist") {
    redirect("/programs/registrations")
  }

  const activeTab = tab as "attendance" | "waitlist"

  return (
    <>
      <Header title="Reports" />

      <Suspense fallback={null}>
        <ProgramsReportsNav />
      </Suspense>

      <div className="flex flex-col gap-6 p-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          {activeTab === "attendance" ? "Attendance" : "Waitlist"}
        </h1>

        <Suspense
          fallback={
            <div className="rounded-lg border py-16 text-center text-sm text-muted-foreground">
              Loading…
            </div>
          }
        >
          {activeTab === "attendance" ? (
            <ProgramsAttendanceReportPanel />
          ) : null}
          {activeTab === "waitlist" ? <ProgramsWaitlistReportPanel /> : null}
        </Suspense>
      </div>
    </>
  )
}
