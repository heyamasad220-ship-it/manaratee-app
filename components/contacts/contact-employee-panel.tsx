"use client"

import { useCallback, useEffect, useMemo, useState, useTransition } from "react"
import { Briefcase, Loader2, Mail, Pencil, Phone } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import type { ContactRoleValue } from "@/lib/contacts/contact-constants"
import { syncStaffContactAffiliations } from "@/lib/hr/staff-affiliation-actions"
import {
  canHaveProgramStaffAssignments,
  EMPLOYMENT_TYPE_LABELS,
  findHrJobRoleIdForProgramRole,
  getEmploymentTypeLabel,
  getProgramRoleLabel,
  normalizeEmploymentStaffType,
  PROGRAM_ROLE_OPTIONS,
  resolveProgramRole,
  type EmploymentStaffType,
  type ProgramRole,
} from "@/lib/hr/staff-role-utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { EmployeeStaffAssignmentsPanel } from "@/components/hr/employee-staff-assignments-panel"
import { EmployeeStaffDocumentsPanel } from "@/components/hr/employee-staff-documents-panel"
import { ContactDepartmentWorkspacePanel } from "@/components/contacts/contact-department-workspace-panel"
import { ContactProgramWorkspacePanel } from "@/components/contacts/contact-program-workspace-panel"
import { Checkbox } from "@/components/ui/checkbox"
import { listProgramsLedByContactAction } from "@/lib/programs/program-lead-actions"

type StaffStatus = "active" | "inactive" | "on_leave" | "pending"

type EmployeeRecord = {
  id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  staff_type: string | null
  status: StaffStatus
  hire_date: string | null
  position: string | null
  position_id: string | null
  position_name: string | null
  department_id: string | null
  department_name: string | null
  is_department_head: boolean
  hr_job_role_id: string | null
  hr_job_role_name: string | null
}

type DepartmentOption = { id: string; name: string }
type HrPositionOption = { id: string; name: string }
type HrJobRoleOption = { id: string; name: string }

const EMPLOYMENT_TYPE_OPTIONS: { value: EmploymentStaffType; label: string }[] = [
  { value: "full_time", label: "Full-Time" },
  { value: "part_time", label: "Part-Time" },
  { value: "temporary", label: "Temporary" },
  { value: "contract", label: "Contract" },
  { value: "seasonal", label: "Seasonal" },
]

function getStatusBadge(status: StaffStatus) {
  if (status === "active") return <Badge>Active</Badge>
  if (status === "pending") return <Badge variant="secondary">Pending</Badge>
  if (status === "on_leave") return <Badge variant="outline">On Leave</Badge>
  return <Badge variant="secondary">Inactive</Badge>
}

export function ContactEmployeePanel({
  staffId,
  organizationId,
  contactRoles = [],
  contactId = null,
}: {
  staffId: string
  organizationId: string | null
  contactRoles?: ContactRoleValue[]
  contactId?: string | null
}) {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [employee, setEmployee] = useState<EmployeeRecord | null>(null)
  const [ledPrograms, setLedPrograms] = useState<
    Array<{ programId: string; programName: string }>
  >([])
  const [departments, setDepartments] = useState<DepartmentOption[]>([])
  const [hrPositions, setHrPositions] = useState<HrPositionOption[]>([])
  const [hrJobRoles, setHrJobRoles] = useState<HrJobRoleOption[]>([])

  const [isEditing, setIsEditing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [employmentType, setEmploymentType] = useState<EmploymentStaffType>("full_time")
  const [programRole, setProgramRole] = useState<ProgramRole | "none">("none")
  const [status, setStatus] = useState<StaffStatus>("active")
  const [departmentId, setDepartmentId] = useState<string | null>(null)
  const [isDepartmentHead, setIsDepartmentHead] = useState(false)
  const [positionId, setPositionId] = useState<string | null>(null)
  const [hireDate, setHireDate] = useState("")

  const resetForm = useCallback(
    (record: EmployeeRecord) => {
      setFirstName(record.first_name)
      setLastName(record.last_name)
      setEmail(record.email || "")
      setPhone(record.phone || "")
      setEmploymentType(normalizeEmploymentStaffType(record.staff_type))
      setProgramRole(
        resolveProgramRole({
          staffType: record.staff_type,
          hrJobRoleName: record.hr_job_role_name,
          contactRoles,
        }) || "none"
      )
      setStatus(record.status)
      setDepartmentId(record.department_id)
      setIsDepartmentHead(record.is_department_head)
      setPositionId(record.position_id)
      setHireDate(record.hire_date?.slice(0, 10) || "")
      setError(null)
    },
    [contactRoles]
  )

  const loadEmployee = useCallback(async () => {
    if (!organizationId) {
      setEmployee(null)
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const [staffResult, departmentsResult, positionsResult, jobRolesResult] =
        await Promise.all([
          supabase
            .from("staff")
            .select(`
              id,
              first_name,
              last_name,
              email,
              phone,
              staff_type,
              status,
              hire_date,
              position,
              position_id,
              department_id,
              is_department_head,
              hr_job_role_id,
              hr_positions:position_id (name),
              hr_job_roles:hr_job_role_id (name),
              departments:department_id (name)
            `)
            .eq("id", staffId)
            .eq("organization_id", organizationId)
            .maybeSingle(),
          supabase
            .from("departments")
            .select("id, name")
            .eq("organization_id", organizationId)
            .order("name"),
          supabase
            .from("hr_positions")
            .select("id, name")
            .eq("organization_id", organizationId)
            .eq("is_active", true)
            .order("name"),
          supabase
            .from("hr_job_roles")
            .select("id, name")
            .eq("organization_id", organizationId)
            .eq("is_active", true)
            .order("name"),
        ])

      let staffData = staffResult.data
      let staffError = staffResult.error

      // Column added in scripts/186 — fall back if not migrated yet.
      if (
        staffError &&
        (staffError.message.includes("is_department_head") ||
          staffError.message.toLowerCase().includes("does not exist"))
      ) {
        const retry = await supabase
          .from("staff")
          .select(`
              id,
              first_name,
              last_name,
              email,
              phone,
              staff_type,
              status,
              hire_date,
              position,
              position_id,
              department_id,
              hr_job_role_id,
              hr_positions:position_id (name),
              hr_job_roles:hr_job_role_id (name),
              departments:department_id (name)
            `)
          .eq("id", staffId)
          .eq("organization_id", organizationId)
          .maybeSingle()
        staffData = retry.data
        staffError = retry.error
      }

      if (staffError) throw staffError
      if (departmentsResult.error) throw departmentsResult.error
      if (positionsResult.error && positionsResult.error.code !== "42P01") {
        throw positionsResult.error
      }
      if (jobRolesResult.error && jobRolesResult.error.code !== "42P01") {
        throw jobRolesResult.error
      }

      setDepartments((departmentsResult.data || []) as DepartmentOption[])
      setHrPositions((positionsResult.data || []) as HrPositionOption[])
      setHrJobRoles((jobRolesResult.data || []) as HrJobRoleOption[])

      const data = staffData
      if (!data) {
        setEmployee(null)
        return
      }

      const record: EmployeeRecord = {
        id: data.id,
        first_name: data.first_name,
        last_name: data.last_name,
        email: data.email,
        phone: data.phone,
        staff_type: data.staff_type,
        status: (data.status || "active") as StaffStatus,
        hire_date: data.hire_date,
        position: data.position,
        position_id: data.position_id || null,
        position_name: (data as any).hr_positions?.name || data.position || null,
        department_id: data.department_id || null,
        department_name: (data as any).departments?.name || null,
        is_department_head: Boolean(
          (data as { is_department_head?: boolean }).is_department_head
        ),
        hr_job_role_id: data.hr_job_role_id || null,
        hr_job_role_name: (data as any).hr_job_roles?.name || null,
      }

      setEmployee(record)
    } catch (loadError) {
      console.error("Load employee record error:", loadError)
      setEmployee(null)
    } finally {
      setLoading(false)
    }
  }, [organizationId, staffId, supabase])

  useEffect(() => {
    void loadEmployee()
  }, [loadEmployee])

  useEffect(() => {
    let cancelled = false
    async function loadLedPrograms() {
      if (!contactId) {
        setLedPrograms([])
        return
      }
      const programs = await listProgramsLedByContactAction(contactId)
      if (!cancelled) setLedPrograms(programs)
    }
    void loadLedPrograms()
    return () => {
      cancelled = true
    }
  }, [contactId])

  useEffect(() => {
    if (employee && !isEditing) {
      resetForm(employee)
    }
  }, [employee, isEditing, resetForm])

  const showAssignments = useMemo(() => {
    if (!employee) return false
    return canHaveProgramStaffAssignments({
      staffType: employee.staff_type,
      hrJobRoleName: employee.hr_job_role_name,
      contactRoles,
    })
  }, [contactRoles, employee])

  const resolvedProgramRoleLabel = employee
    ? getProgramRoleLabel({
        staffType: employee.staff_type,
        hrJobRoleName: employee.hr_job_role_name,
        contactRoles,
      })
    : null

  const employmentTypeLabel = employee
    ? getEmploymentTypeLabel(normalizeEmploymentStaffType(employee.staff_type))
    : null

  function handleCancel() {
    if (employee) {
      resetForm(employee)
    }
    setIsEditing(false)
  }

  function handleSave() {
    if (!organizationId || !employee) return

    const cleanFirstName = firstName.trim()
    const cleanLastName = lastName.trim()
    if (!cleanFirstName || !cleanLastName) {
      setError("First and last name are required.")
      return
    }

    setError(null)
    startTransition(async () => {
      try {
        const selectedPosition = hrPositions.find((item) => item.id === positionId)
        const selectedProgramRole = programRole === "none" ? null : programRole
        const matchedJobRoleId = findHrJobRoleIdForProgramRole(
          hrJobRoles,
          selectedProgramRole
        )

        const { error: updateError } = await supabase
          .from("staff")
          .update({
            first_name: cleanFirstName,
            last_name: cleanLastName,
            email: email.trim() || null,
            phone: phone.trim() || null,
            staff_type: employmentType,
            status,
            position: selectedPosition?.name || employee.position_name || employee.position || null,
            position_id: positionId,
            hr_job_role_id: matchedJobRoleId,
            hire_date: hireDate || null,
            department_id: departmentId,
            is_department_head: Boolean(departmentId) && isDepartmentHead,
          })
          .eq("id", employee.id)
          .eq("organization_id", organizationId)

        if (updateError) throw updateError

        try {
          await syncStaffContactAffiliations(employee.id)
        } catch (syncError) {
          console.warn("Staff updated but affiliation sync failed:", syncError)
        }

        setIsEditing(false)
        await loadEmployee()
      } catch (saveError) {
        setError(
          saveError instanceof Error ? saveError.message : "Could not save employee record."
        )
      }
    })
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading employee record...
        </CardContent>
      </Card>
    )
  }

  if (!employee) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          Employee record could not be loaded.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {employee.is_department_head &&
      employee.department_id &&
      employee.department_name ? (
        <ContactDepartmentWorkspacePanel
          departmentId={employee.department_id}
          departmentName={employee.department_name}
        />
      ) : null}

      <ContactProgramWorkspacePanel programs={ledPrograms} />

      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="size-5" />
              Employment details
            </CardTitle>
            <CardDescription>
              HR position and employment type. Program role controls program assignments.
            </CardDescription>
          </div>
          {!isEditing ? (
            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Button>
          ) : null}
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          {isEditing ? (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="employee-first-name">First name</Label>
                  <Input
                    id="employee-first-name"
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="employee-last-name">Last name</Label>
                  <Input
                    id="employee-last-name"
                    value={lastName}
                    onChange={(event) => setLastName(event.target.value)}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="employee-email">Work email</Label>
                  <Input
                    id="employee-email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="employee-phone">Work phone</Label>
                  <Input
                    id="employee-phone"
                    type="tel"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Employment type</Label>
                  <Select
                    value={employmentType}
                    onValueChange={(value) =>
                      setEmploymentType(value as EmploymentStaffType)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EMPLOYMENT_TYPE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={status}
                    onValueChange={(value) => setStatus(value as StaffStatus)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="on_leave">On Leave</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Department</Label>
                  <Select
                    value={departmentId || "none"}
                    onValueChange={(value) => {
                      const next = value === "none" ? null : value
                      setDepartmentId(next)
                      if (!next) setIsDepartmentHead(false)
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No department</SelectItem>
                      {departments.map((department) => (
                        <SelectItem key={department.id} value={department.id}>
                          {department.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <label className="flex items-start gap-2 pt-1 text-sm">
                    <Checkbox
                      checked={isDepartmentHead}
                      disabled={!departmentId}
                      onCheckedChange={(checked) =>
                        setIsDepartmentHead(checked === true)
                      }
                      className="mt-0.5"
                    />
                    <span>
                      <span className="font-medium">Department Head (Director)</span>
                      <span className="block text-xs text-muted-foreground">
                        Can open this department&apos;s workspace from their profile
                        (all tabs).
                      </span>
                    </span>
                  </label>
                </div>
                <div className="space-y-2">
                  <Label>Position</Label>
                  <Select
                    value={positionId || "none"}
                    onValueChange={(value) =>
                      setPositionId(value === "none" ? null : value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select position" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No position</SelectItem>
                      {hrPositions.map((position) => (
                        <SelectItem key={position.id} value={position.id}>
                          {position.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Organizational job title, e.g. Program &amp; Event Coordinator.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Program role</Label>
                  <Select
                    value={programRole}
                    onValueChange={(value) =>
                      setProgramRole(value as ProgramRole | "none")
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select program role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {PROGRAM_ROLE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Instructor, assistant, volunteer, or child care. Required for program
                    assignments.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="employee-hire-date">Start date</Label>
                  <Input
                    id="employee-hire-date"
                    type="date"
                    value={hireDate}
                    onChange={(event) => setHireDate(event.target.value)}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={handleCancel} disabled={isPending}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={isPending}>
                  {isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save changes"
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="mb-4 flex flex-wrap items-center gap-2">
                {getStatusBadge(employee.status)}
                {employmentTypeLabel ? (
                  <Badge variant="outline">{employmentTypeLabel}</Badge>
                ) : null}
                {resolvedProgramRoleLabel ? (
                  <Badge variant="secondary">{resolvedProgramRoleLabel}</Badge>
                ) : null}
                {employee.is_department_head ? (
                  <Badge variant="secondary">Department Head</Badge>
                ) : null}
              </div>
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
                  <dt className="text-xs text-muted-foreground">Program role</dt>
                  <dd className="text-sm font-medium">{resolvedProgramRoleLabel || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Employment type</dt>
                  <dd className="text-sm font-medium">
                    {employmentTypeLabel || EMPLOYMENT_TYPE_LABELS.full_time}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Hire date</dt>
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
                    <Mail className="size-3" /> Work email
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
                    <Phone className="size-3" /> Work phone
                  </dt>
                  <dd className="text-sm font-medium">{employee.phone || "—"}</dd>
                </div>
              </dl>
            </>
          )}
        </CardContent>
      </Card>

      {showAssignments ? (
        <EmployeeStaffAssignmentsPanel organizationId={organizationId} staffId={staffId} />
      ) : null}
      <EmployeeStaffDocumentsPanel organizationId={organizationId} staffId={staffId} />
    </div>
  )
}
