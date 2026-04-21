"use client"

import { useState } from "react"
import { Header } from "@/components/layout/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Plus, Pencil, Trash2 } from "lucide-react"

// Mock roles
const defaultRoles = [
  { id: "r-1", name: "Admin", users: 3, permissions: "Full access to all settings and data" },
  { id: "r-2", name: "Manager", users: 5, permissions: "Manage events, people, and view reports" },
  { id: "r-3", name: "Staff", users: 12, permissions: "View and manage assigned areas" },
  { id: "r-4", name: "Volunteer", users: 28, permissions: "Limited access to assigned tasks" },
  { id: "r-5", name: "Read Only", users: 4, permissions: "View-only access to all areas" },
]

export default function RolesPermissionsPage() {
  const [roles] = useState(defaultRoles)

  return (
    <>
      <Header title="Roles & Permissions" />
      <div className="p-6">
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-foreground">Manage Roles</h2>
              <p className="text-sm text-muted-foreground">
                Configure user roles and their permissions across the system
              </p>
            </div>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Role
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>System Roles</CardTitle>
              <CardDescription>
                Define what each role can access and modify in the system
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Role</TableHead>
                    <TableHead>Users</TableHead>
                    <TableHead>Permissions</TableHead>
                    <TableHead className="w-[100px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roles.map((role) => (
                    <TableRow key={role.id}>
                      <TableCell className="font-medium">{role.name}</TableCell>
                      <TableCell>{role.users} users</TableCell>
                      <TableCell className="text-muted-foreground">{role.permissions}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-red-600">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}
