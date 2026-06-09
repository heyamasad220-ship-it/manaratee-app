"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Briefcase, Loader2, Mail, Phone, User } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { EmployeeStaffAssignmentsPanel } from "@/components/hr/employee-staff-assignments-panel"
import { EmployeeStaffDocumentsPanel } from "@/components/hr/employee-staff-documents-panel"
import { ContactProgramAssignmentsPanel } from "@/components/contacts/contact-program-assignments-panel"
import { loadContactProgramAssignments } from "@/lib/programs/program-staff-assignment-actions"
import type { ProgramStaffAssignmentWithDetails } from "@/lib/programs/program-staff-assignment-types"

type StaffStatus = "active" | "inactive" | "on_leave" | "pending"
type StaffType = "full_time" | "part_time" | "temporary" | "contract" | "seasonal"

type EmployeeRecord = {
  id: string
  contact_id: string | null
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  staff_type: StaffType
  status: StaffStatus
  hire_date: string | null
  position_name: string | null
  department_name: string | null
  hr_job_role_name: string | null
}

const STAFF_TYPE_LABELS: Record<string, string> = {
  full_time: "Full-Time",
  part_time: "Part-Time",
  temporary: "Temporary",
  contract: "Contract",
  seasonal: "Seasonal",
}

function getStatusBadge(status: StaffStatus) {
  if (status === "active") return <Badge>Active</Badge>
  if (status === "pending") return <Badge variant="secondary">Pending</Badge>
  if (status === "on_leave") return <Badge variant="outline">On Leave</Badge>
  return <Badge variant="secondary">Inactive</Badge>
}

export function EmployeeProfileClient({
  staffId,
  organizationId,
}: {
  staffId: string
  organizationId: string | null
}) {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [employee, setEmployee] = useState<EmployeeRecord | null>(null)
  const [programAssignments, setProgramAssignments] = useState<ProgramStaffAssignmentWithDetails[]>([])
  const [assignmentsLoading, setAssignmentsLoading] = useState(false)

  useEffect(() => {
    async function loadEmployee() {
      if (!organizationId) {
        setEmployee(null)
        setLoading(false)
        return
      }

      setLoading(true)
      try {
        const { data, error } = await supabase
          .from("staff")
          .select(`
            id,
            contact_id,
            first_name,
            last_name,
            email,
            phone,
            staff_type,
            status,
            hire_date,
            position,
            hr_positions:position_id (name),
            hr_job_roles:hr_job_role_id (name),
            departments:department_id (name)
          `)
          .eq("id", staffId)
          .eq("organization_id", organizationId)
          .maybeSingle()

        if (error) throw error
        if (!data) {
          setEmployee(null)
          return
        }

        const record: EmployeeRecord = {
          id: data.id,
          contact_id: data.contact_id,
          first_name: data.first_name,
          last_name: data.last_name,
          email: data.email,
          phone: data.phone,
          staff_type: (data.staff_type || "full_time") as StaffType,
          status: (data.status || "active") as StaffStatus,
          hire_date: data.hire_date,
          position_name: (data as any).hr_positions?.name || data.position || null,
          department_name: (data as any).departments?.name || null,
          hr_job_role_name: (data as any).hr_job_roles?.name || null,
        }
        setEmployee(record)

        if (record.contact_id) {
          setAssignmentsLoading(true)
          try {
            const assignments = await loadContactProgramAssignments(record.contact_id)
            setProgramAssignments(assignments)
          } catch (assignmentError) {
            console.error("Load program assignments error:", assignmentError)
            setProgramAssignments([])
          } finally {
            setAssignmentsLoading(false)
          }
        } else {
          setProgramAssignments([])
        }
      } catch (loadError) {
        console.error("Load employee profile error:", loadError)
        setEmployee(null)
      } finally {
        setLoading(false)
      }
    }

    void loadEmployee()
  }, [organizationId, staffId, supabase])

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 p-12 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
        Loading employee profile...
      </div>
    )
  }

  if (!employee) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-12">
        <User className="size-16 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Employee not found</h2>
        <p className="text-muted-foreground">This employee record could not be loaded.</p>
        <Button variant="outline" onClick={() => router.push("/workforce/employees")}>
          <ArrowLeft className="mr-2 size-4" />
          Back to Employees
        </Button>
      </div>
    )
  }

  const fullName = `${employee.first_name} ${employee.last_name}`.trim()
  const initials = `${employee.first_name?.[0] || ""}${employee.last_name?.[0] || ""}`.toUpperCase()

  return (
    <div className="flex flex-col gap-6 p-6">
      {!employee.contact_id ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          This staff record is not linked to a contact yet. Link it from Workforce →
          Employees to use the unified contact profile.
        </div>
      ) : null}

      <div className="flex items-center gap-4">
        <Link
          href="/workforce/employees"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-1.5 size-4" />
          Back to Employees
        </Link>
      </div>

      <div className="flex items-start gap-4">
        <Avatar className="size-16">
          <AvatarFallback className="bg-primary/10 text-lg text-primary">{initials}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{fullName}</h1>
            {getStatusBadge(employee.status)}
            <Badge variant="outline">
              {STAFF_TYPE_LABELS[employee.staff_type] || employee.staff_type}
            </Badge>
          </div>
          <p className="mt-1 text-muted-foreground">
            {[employee.position_name, employee.department_name].filter(Boolean).join(" · ") ||
              "No position assigned"}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Briefcase className="size-5" />
            Employment Details
          </CardTitle>
          <CardDescription>Role, department, and contact information</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <dt className="text-xs text-muted-foreground">Position</dt>
              <dd className="text-sm font-medium">{employee.position_name || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Department</dt>
              <dd className="text-sm font-medium">{employee.department_name || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Job Role</dt>
              <dd className="text-sm font-medium">{employee.hr_job_role_name || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Hire Date</dt>
              <dd className="text-sm font-medium">
                {employee.hire_date
                  ? new Date(`${employee.hire_date.slice(0, 10)}T00:00:00`).toLocaleDateString(
                      "en-US",
                      { year: "numeric", month: "long", day: "numeric" }
                    )
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground flex items-center gap-1">
                <Mail className="size-3" /> Email
              </dt>
              <dd className="text-sm font-medium">
                {employee.email ? (
                  <a href={`mailto:${employee.email}`} className="text-primary hover:underline">
                    {employee.email}
                  </a>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground flex items-center gap-1">
                <Phone className="size-3" /> Phone
              </dt>
              <dd className="text-sm font-medium">{employee.phone || "—"}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <EmployeeStaffAssignmentsPanel organizationId={organizationId} staffId={staffId} />

      {employee.contact_id &&
        (assignmentsLoading ? (
          <Card>
            <CardContent className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Loading program assignments...
            </CardContent>
          </Card>
        ) : (
          <ContactProgramAssignmentsPanel
            contactId={employee.contact_id}
            assignments={programAssignments}
          />
        ))}

      <EmployeeStaffDocumentsPanel organizationId={organizationId} staffId={staffId} />
    </div>
  )
}
