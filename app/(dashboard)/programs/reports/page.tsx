"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense } from "react"

import { Header } from "@/components/layout/header"
import {
  ProgramsAttendanceReportPanel,
  ProgramsWaitlistReportPanel,
} from "@/components/programs/programs-attendance-waitlist-report-panels"
import {
  ProgramsReportsNav,
  resolveProgramsReportsTab,
} from "@/components/programs/programs-reports-nav"

function ProgramsReportsPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const activeTab = resolveProgramsReportsTab("/programs/reports", searchParams)

  React.useEffect(() => {
    const tab = searchParams.get("tab")
    if (!tab || tab === "overview" || tab === "enrollment") {
      router.replace("/programs/registrations")
      return
    }
    if (tab === "transactions") {
      router.replace("/finance/transactions")
      return
    }
    if (tab === "childcare") {
      router.replace("/programs/reports/childcare")
      return
    }
    if (tab === "enrollments") {
      router.replace("/programs/reports/enrollments")
      return
    }
    if (tab === "tuition-plans" || tab === "payment-summary") {
      router.replace("/programs/reports/tuition-plans")
      return
    }
    if (tab === "addons" || tab === "add-ons") {
      router.replace("/programs/reports/addons")
    }
  }, [router, searchParams])

  if (activeTab === "enrollment" || activeTab === "enrollments") {
    return null
  }

  return (
    <>
      <Header title="Reports" />

      <ProgramsReportsNav />

      <div className="flex flex-col gap-6 p-6">
        <h1 className="text-2xl font-semibold tracking-tight">
          {activeTab === "attendance" ? "Attendance" : "Waitlist"}
        </h1>

        {activeTab === "attendance" ? <ProgramsAttendanceReportPanel /> : null}
        {activeTab === "waitlist" ? <ProgramsWaitlistReportPanel /> : null}
      </div>
    </>
  )
}

export default function ProgramsReportsPage() {
  return (
    <Suspense fallback={null}>
      <ProgramsReportsPageContent />
    </Suspense>
  )
}
