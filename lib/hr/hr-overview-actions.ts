"use server"

import { createClient } from "@/lib/supabase/server"
import { fetchApplicationDashboardStats } from "@/lib/applications/application-actions"
import { getSelectedOrganizationId } from "@/lib/organizations/get-selected-organization-id"
import { fetchChildcareProvidersData } from "@/lib/hr/childcare-provider-actions"
import {
  fetchHrEmployeeDashboardStats,
  type HrEmployeeDashboardStats,
} from "@/lib/hr/hr-employee-actions"
import {
  fetchHrTeamDashboardStats,
  type HrTeamDashboardStats,
} from "@/lib/hr/hr-team-actions"

export type PeopleManagementOverview = {
  employees: HrEmployeeDashboardStats
  teams: HrTeamDashboardStats
  volunteerContacts: number
  activeVolunteerRecords: number
  childcareProviders: number
  pendingIntakeApplications: number
}

export async function fetchPeopleManagementOverview(): Promise<PeopleManagementOverview> {
  const supabase = await createClient()
  const organizationId = await getSelectedOrganizationId()

  if (!organizationId) {
    return {
      employees: {
        totalEmployees: 0,
        activeStaff: 0,
        totalDepartments: 0,
        totalPositions: 0,
      },
      teams: {
        totalTeams: 0,
        activeTeams: 0,
        totalMembers: 0,
        teamLeaders: 0,
      },
      volunteerContacts: 0,
      activeVolunteerRecords: 0,
      childcareProviders: 0,
      pendingIntakeApplications: 0,
    }
  }

  const [
    employees,
    teams,
    volunteerContactsResult,
    volunteerRecordsResult,
    childcare,
    applicationStats,
  ] = await Promise.all([
    fetchHrEmployeeDashboardStats(),
    fetchHrTeamDashboardStats(),
    supabase
      .from("contact_roles")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("role", "volunteer"),
    supabase
      .from("volunteers")
      .select("status")
      .eq("organization_id", organizationId),
    fetchChildcareProvidersData(),
    fetchApplicationDashboardStats({
      applicationType: ["employment", "volunteer", "childcare_provider"],
    }),
  ])

  const activeVolunteerRecords = (volunteerRecordsResult.data || []).filter(
    (row) => row.status === "active"
  ).length

  return {
    employees,
    teams,
    volunteerContacts: volunteerContactsResult.count || 0,
    activeVolunteerRecords,
    childcareProviders: childcare.stats.totalProviders,
    pendingIntakeApplications: applicationStats.pendingReview,
  }
}
