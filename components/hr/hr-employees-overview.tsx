"use client"

import * as React from "react"
import {
  fetchHrEmployeeDashboardStats,
  type HrEmployeeDashboardStats,
} from "@/lib/hr/hr-employee-actions"
import { StatCard, StatCardsRow } from "@/components/ui/stat-card"
import { Building2, Users } from "lucide-react"

export function HrEmployeesOverview() {
  const [stats, setStats] = React.useState<HrEmployeeDashboardStats>({
    totalEmployees: 0,
    activeStaff: 0,
    totalDepartments: 0,
    totalPositions: 0,
  })

  React.useEffect(() => {
    void loadData()
  }, [])

  async function loadData() {
    try {
      const statsData = await fetchHrEmployeeDashboardStats()
      setStats(statsData)
    } catch (error: unknown) {
      console.error(error)
      alert(error instanceof Error ? error.message : "Could not load employee overview.")
    }
  }

  const statCards = [
    { label: "Total Employees", value: stats.totalEmployees, icon: Users },
    { label: "Departments", value: stats.totalDepartments, icon: Building2 },
  ]

  return (
    <StatCardsRow>
      {statCards.map((stat) => (
        <StatCard key={stat.label} label={stat.label} value={stat.value} icon={stat.icon} />
      ))}
    </StatCardsRow>
  )
}
