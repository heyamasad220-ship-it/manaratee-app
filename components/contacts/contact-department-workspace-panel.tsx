"use client"

import Link from "next/link"
import { Building2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { workforceDepartmentDetailPath } from "@/lib/departments/department-paths"

/** Profile card for Department Heads — mirrors teacher Program assignments → Manage. */
export function ContactDepartmentWorkspacePanel({
  departmentId,
  departmentName,
}: {
  departmentId: string
  departmentName: string
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-4 w-4" />
          Department workspace
        </CardTitle>
        <CardDescription>
          Open the department workspace (overview, rosters, years/seasons, payroll,
          and more) as Department Head.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium">{departmentName}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Badge variant="secondary">Department Head</Badge>
              <span className="text-xs text-muted-foreground">Director</span>
            </div>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href={workforceDepartmentDetailPath(departmentId)}>
              Open workspace
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
