"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Loader2, Pencil } from "lucide-react"

import {
  fetchDepartmentDetail,
  type DepartmentDetail,
} from "@/lib/departments/department-actions"
import { WORKFORCE_DEPARTMENTS_PATH } from "@/lib/departments/department-paths"
import { contactProfileHref } from "@/lib/contacts/contact-profile-path"
import { PageBreadcrumbs } from "@/components/navigation/page-breadcrumbs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type DepartmentDetailClientProps = {
  departmentId: string
  onEdit?: () => void
}

export function DepartmentDetailClient({
  departmentId,
  onEdit,
}: DepartmentDetailClientProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [department, setDepartment] = useState<DepartmentDetail | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const data = await fetchDepartmentDetail(departmentId)
        setDepartment(data)
        if (!data) setError("This department could not be found.")
      } catch (loadError) {
        setError(
          loadError instanceof Error ? loadError.message : "Could not load department."
        )
        setDepartment(null)
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [departmentId])

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading department...
      </div>
    )
  }

  if (!department) {
    return (
      <div className="space-y-4 p-6">
        <p className="text-sm text-muted-foreground">
          {error || "This department could not be found."}
        </p>
        <Button variant="outline" asChild>
          <Link href={WORKFORCE_DEPARTMENTS_PATH}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Departments
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-4 border-b border-border pb-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-2">
          <PageBreadcrumbs
            items={[
              { label: "Departments", href: WORKFORCE_DEPARTMENTS_PATH },
              { label: department.name },
            ]}
          />
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="inline-block size-3 rounded-full border"
              style={{ backgroundColor: department.color || "#3b82f6" }}
            />
            <h1 className="text-2xl font-semibold tracking-tight">{department.name}</h1>
            <Badge variant="outline" className="font-normal">
              Department
            </Badge>
          </div>
          {department.description ? (
            <p className="text-sm text-muted-foreground">{department.description}</p>
          ) : (
            <p className="text-sm text-muted-foreground">
              {department.staff.length} employee
              {department.staff.length === 1 ? "" : "s"} · {department.programsCount}{" "}
              program{department.programsCount === 1 ? "" : "s"}
            </p>
          )}
        </div>
        {onEdit ? (
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Pencil className="mr-1.5 h-4 w-4" />
            Edit department
          </Button>
        ) : null}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Employees</CardTitle>
          <CardDescription>Staff assigned to this department.</CardDescription>
        </CardHeader>
        <CardContent>
          {department.staff.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No employees assigned to this department yet.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {department.staff.map((member) => (
                    <TableRow key={member.staffId}>
                      <TableCell className="font-medium">
                        {member.contactId ? (
                          <Link
                            href={contactProfileHref(member.contactId)}
                            className="text-primary hover:underline"
                          >
                            {member.fullName}
                          </Link>
                        ) : (
                          member.fullName
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {member.email || "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {member.phone || "—"}
                      </TableCell>
                      <TableCell className="capitalize text-muted-foreground">
                        {member.employmentStatus || "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
