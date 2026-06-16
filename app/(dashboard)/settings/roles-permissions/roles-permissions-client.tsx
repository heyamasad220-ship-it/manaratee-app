"use client"

import { Fragment, useEffect, useMemo, useState } from "react"
import { Header } from "@/components/layout/header"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Plus, Pencil, Trash2, Loader2, ShieldCheck } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

type OrganizationRole = {
  id: string
  organization_id: string
  name: string
  description: string | null
  is_system_role: boolean
  created_at: string
  updated_at: string
}

type OrganizationMember = {
  id: string
  role_id: string | null
}

type RolePermission = {
  id: string
  organization_id: string
  role_id: string
  permission_key: string
  enabled: boolean
}

type PermissionDefinition = {
  key: string
  label: string
  description: string
  group: string
}

const permissionDefinitions: PermissionDefinition[] = [
  {
    key: "settings.users.view",
    label: "View Users",
    description: "Can open the Users page.",
    group: "Settings",
  },
  {
    key: "settings.users.manage",
    label: "Manage Users",
    description: "Can invite users and change user roles.",
    group: "Settings",
  },
  {
    key: "settings.roles.view",
    label: "View Roles & Permissions",
    description: "Can open the Roles & Permissions page.",
    group: "Settings",
  },
  {
    key: "settings.roles.manage",
    label: "Manage Roles & Permissions",
    description: "Can create roles and edit permissions.",
    group: "Settings",
  },
  {
    key: "applications.view",
    label: "View Applications",
    description: "Can open the Applications page.",
    group: "Applications",
  },
  {
    key: "applications.manage",
    label: "Manage Applications",
    description: "Can approve, reject, and update applications.",
    group: "Applications",
  },
  {
    key: "programs.view",
    label: "View Programs",
    description: "Can open Programs pages.",
    group: "Programs",
  },
  {
    key: "programs.manage",
    label: "Manage Programs",
    description: "Can create and edit programs.",
    group: "Programs",
  },
  {
    key: "staff.view",
    label: "View Staff",
    description: "Can open Staff/Instructors pages.",
    group: "Staff",
  },
  {
    key: "staff.manage",
    label: "Manage Staff",
    description: "Can create, edit, and delete staff records.",
    group: "Staff",
  },
  {
    key: "donations.view",
    label: "View Donations",
    description: "Can open donation and fundraising pages.",
    group: "Donations",
  },
  {
    key: "donations.manage",
    label: "Manage Donations",
    description: "Can create, import, reconcile, and update donations.",
    group: "Donations",
  },
  {
    key: "reports.view",
    label: "View Reports",
    description: "Can open reports.",
    group: "Reports",
  },
  {
    key: "events.view",
    label: "View Events",
    description: "Can open Event Management pages.",
    group: "Events",
  },
  {
    key: "events.manage",
    label: "Manage Events",
    description: "Can create and edit internal events and event types.",
    group: "Events",
  },
  {
    key: "ticketing.view",
    label: "View Ticketing",
    description: "Can open ticketing and event sales pages.",
    group: "Events",
  },
  {
    key: "ticketing.manage",
    label: "Manage Ticketing",
    description: "Can create and complete ticket orders.",
    group: "Events",
  },
  {
    key: "membership.view",
    label: "View Membership",
    description: "Can open membership pages and view members.",
    group: "Membership",
  },
  {
    key: "membership.manage",
    label: "Manage Membership",
    description: "Can add members, create memberships, and update status.",
    group: "Membership",
  },
  {
    key: "bookings.view",
    label: "View Venue Rentals",
    description: "Can open Venue Rentals pages.",
    group: "Venue Rentals",
  },
  {
    key: "bookings.manage",
    label: "Manage Venue Rentals",
    description: "Can approve, edit, and manage venue rental workflows.",
    group: "Venue Rentals",
  },
  {
    key: "spaces.view",
    label: "View Facilities",
    description: "Can open Facilities pages, master calendar, and setup briefs.",
    group: "Facilities",
  },
  {
    key: "spaces.manage",
    label: "Manage Facilities",
    description: "Can manage spaces and update facility setup notes.",
    group: "Facilities",
  },
  {
    key: "contacts.view",
    label: "View Contacts",
    description: "Can open Contacts pages and view contact records.",
    group: "Contacts",
  },
  {
    key: "contacts.manage",
    label: "Manage Contacts",
    description: "Can create, edit, and delete contacts and affiliations.",
    group: "Contacts",
  },
]

const permissionGroups = Array.from(
  new Set(permissionDefinitions.map((permission) => permission.group)),
)

export function RolesPermissionsClient({
  organizationId,
}: {
  organizationId: string
}) {
  const supabase = createClient()

  const [roles, setRoles] = useState<OrganizationRole[]>([])
  const [members, setMembers] = useState<OrganizationMember[]>([])
  const [permissions, setPermissions] = useState<RolePermission[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingPermissionKey, setSavingPermissionKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingRole, setEditingRole] = useState<OrganizationRole | null>(null)
  const [roleName, setRoleName] = useState("")
  const [roleDescription, setRoleDescription] = useState("")

  async function ensurePermissionsForRoles(roleRows: OrganizationRole[]) {
    if (roleRows.length === 0) return

    const rowsToInsert = roleRows.flatMap((role) =>
      permissionDefinitions.map((permission) => ({
        organization_id: organizationId,
        role_id: role.id,
        permission_key: permission.key,
        enabled: ["super admin", "admin"].includes(role.name.toLowerCase()),
      })),
    )

    const { error } = await supabase
      .from("role_permissions")
      .upsert(rowsToInsert, {
        onConflict: "role_id,permission_key",
        ignoreDuplicates: true,
      })

    if (error) {
      console.error("Ensure permissions error:", error)
    }
  }

  async function loadData() {
    setLoading(true)
    setError(null)

    const rolesResult = await supabase
      .from("organization_roles")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: true })

    if (rolesResult.error) {
      setError(rolesResult.error.message)
      setRoles([])
      setMembers([])
      setPermissions([])
      setLoading(false)
      return
    }

    const roleRows = (rolesResult.data ?? []) as OrganizationRole[]
    setRoles(roleRows)

    await ensurePermissionsForRoles(roleRows)

    const [membersResult, permissionsResult] = await Promise.all([
      supabase
        .from("organization_members")
        .select("id, role_id")
        .eq("organization_id", organizationId),

      supabase
        .from("role_permissions")
        .select("*")
        .eq("organization_id", organizationId),
    ])

    if (membersResult.error) {
      setError(membersResult.error.message)
      setMembers([])
    } else {
      setMembers((membersResult.data ?? []) as OrganizationMember[])
    }

    if (permissionsResult.error) {
      setError(permissionsResult.error.message)
      setPermissions([])
    } else {
      setPermissions((permissionsResult.data ?? []) as RolePermission[])
    }

    setLoading(false)
  }

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId])

  const roleCounts = useMemo(() => {
    return roles.reduce<Record<string, number>>((acc, role) => {
      acc[role.id] = members.filter((member) => member.role_id === role.id).length
      return acc
    }, {})
  }, [roles, members])

  const permissionsByRoleAndKey = useMemo(() => {
    const map = new Map<string, RolePermission>()

    permissions.forEach((permission) => {
      map.set(`${permission.role_id}:${permission.permission_key}`, permission)
    })

    return map
  }, [permissions])

  function roleHasPermission(roleId: string, permissionKey: string) {
    return permissionsByRoleAndKey.get(`${roleId}:${permissionKey}`)?.enabled === true
  }

  function openAddDialog() {
    setEditingRole(null)
    setRoleName("")
    setRoleDescription("")
    setDialogOpen(true)
  }

  function openEditDialog(role: OrganizationRole) {
    setEditingRole(role)
    setRoleName(role.name)
    setRoleDescription(role.description ?? "")
    setDialogOpen(true)
  }

  async function saveRole() {
    const cleanName = roleName.trim()
    const cleanDescription = roleDescription.trim()

    if (!cleanName) {
      setError("Role name is required.")
      return
    }

    setSaving(true)
    setError(null)

    if (editingRole) {
      const { error } = await supabase
        .from("organization_roles")
        .update({
          name: cleanName,
          description: cleanDescription || null,
        })
        .eq("id", editingRole.id)
        .eq("organization_id", organizationId)

      if (error) {
        setError(error.message)
        setSaving(false)
        return
      }
    } else {
      const { error } = await supabase.from("organization_roles").insert({
        organization_id: organizationId,
        name: cleanName,
        description: cleanDescription || null,
        is_system_role: false,
      })

      if (error) {
        setError(error.message)
        setSaving(false)
        return
      }
    }

    setDialogOpen(false)
    setEditingRole(null)
    setRoleName("")
    setRoleDescription("")
    await loadData()
    setSaving(false)
  }

  async function deleteRole(role: OrganizationRole) {
    const usersCount = roleCounts[role.id] ?? 0

    if (role.is_system_role) {
      setError("System roles cannot be deleted.")
      return
    }

    if (usersCount > 0) {
      setError("You cannot delete a role that is assigned to users. Move those users to another role first.")
      return
    }

    const confirmed = window.confirm(`Delete the role "${role.name}"?`)

    if (!confirmed) return

    setSaving(true)
    setError(null)

    const { error } = await supabase
      .from("organization_roles")
      .delete()
      .eq("id", role.id)
      .eq("organization_id", organizationId)

    if (error) {
      setError(error.message)
      setSaving(false)
      return
    }

    await loadData()
    setSaving(false)
  }

  async function togglePermission(role: OrganizationRole, permissionKey: string, enabled: boolean) {
    const saveKey = `${role.id}:${permissionKey}`
    setSavingPermissionKey(saveKey)
    setError(null)

    const existingPermission = permissionsByRoleAndKey.get(saveKey)

    if (existingPermission) {
      const { error } = await supabase
        .from("role_permissions")
        .update({ enabled })
        .eq("id", existingPermission.id)
        .eq("organization_id", organizationId)

      if (error) {
        setError(error.message)
        setSavingPermissionKey(null)
        return
      }
    } else {
      const { error } = await supabase.from("role_permissions").insert({
        organization_id: organizationId,
        role_id: role.id,
        permission_key: permissionKey,
        enabled,
      })

      if (error) {
        setError(error.message)
        setSavingPermissionKey(null)
        return
      }
    }

    setPermissions((current) => {
      const found = current.find(
        (permission) =>
          permission.role_id === role.id && permission.permission_key === permissionKey,
      )

      if (found) {
        return current.map((permission) =>
          permission.id === found.id ? { ...permission, enabled } : permission,
        )
      }

      return [
        ...current,
        {
          id: crypto.randomUUID(),
          organization_id: organizationId,
          role_id: role.id,
          permission_key: permissionKey,
          enabled,
        },
      ]
    })

    setSavingPermissionKey(null)
  }

  return (
    <>
      <Header title="Roles & Permissions" />

      <div className="p-6">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-foreground">Manage Roles</h2>
              <p className="text-sm text-muted-foreground">
                Create roles and choose what each role can access.
              </p>
            </div>

            <Button onClick={openAddDialog}>
              <Plus className="mr-2 h-4 w-4" />
              Add Role
            </Button>
          </div>

          {error && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="pt-6 text-sm text-red-700">
                <strong>Error:</strong> {error}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Organization Roles</CardTitle>
              <CardDescription>
                Platform owner is not listed here. These are organization roles.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Role</TableHead>
                    <TableHead>Users</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[110px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {loading && (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                        <div className="flex items-center justify-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading roles...
                        </div>
                      </TableCell>
                    </TableRow>
                  )}

                  {!loading &&
                    roles.map((role) => (
                      <TableRow key={role.id}>
                        <TableCell className="font-medium">{role.name}</TableCell>
                        <TableCell>{roleCounts[role.id] ?? 0} users</TableCell>
                        <TableCell className="text-muted-foreground">
                          {role.description || "No description"}
                        </TableCell>
                        <TableCell>
                          {role.is_system_role ? (
                            <Badge variant="secondary">System Role</Badge>
                          ) : (
                            <Badge variant="outline">Custom Role</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => openEditDialog(role)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>

                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-red-600"
                              onClick={() => deleteRole(role)}
                              disabled={role.is_system_role || (roleCounts[role.id] ?? 0) > 0}
                              title={
                                (roleCounts[role.id] ?? 0) > 0
                                  ? "Move users out of this role before deleting it"
                                  : "Delete role"
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}

                  {!loading && roles.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                        No custom roles yet. Click Add Role to create one.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5" />
                Permission Matrix
              </CardTitle>
              <CardDescription>
                Check or uncheck permissions for each role. Changes save immediately.
              </CardDescription>
            </CardHeader>

            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading permissions...
                </div>
              ) : roles.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  Create a role first, then permissions will appear here.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[260px]">Permission</TableHead>
                        {roles.map((role) => (
                          <TableHead key={role.id} className="min-w-[150px] text-center">
                            {role.name}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>

                    <TableBody>
                      {permissionGroups.map((group) => (
  <Fragment key={group}>
                          <TableRow key={`${group}-header`} className="bg-muted/50">
                            <TableCell
                              colSpan={roles.length + 1}
                              className="font-semibold text-foreground"
                            >
                              {group}
                            </TableCell>
                          </TableRow>

                          {permissionDefinitions
                            .filter((permission) => permission.group === group)
                            .map((permission) => (
                              <TableRow key={permission.key}>
                                <TableCell>
                                  <div className="flex flex-col gap-1">
                                    <span className="font-medium">{permission.label}</span>
                                    <span className="text-xs text-muted-foreground">
                                      {permission.description}
                                    </span>
                                    <code className="w-fit rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                                      {permission.key}
                                    </code>
                                  </div>
                                </TableCell>

                                {roles.map((role) => {
                                  const saveKey = `${role.id}:${permission.key}`
                                  const isSaving = savingPermissionKey === saveKey

                                  return (
                                    <TableCell key={saveKey} className="text-center">
                                      <div className="flex items-center justify-center">
                                        {isSaving ? (
                                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                        ) : (
                                          <Checkbox
                                            checked={roleHasPermission(role.id, permission.key)}
                                            onCheckedChange={(checked) =>
                                              togglePermission(role, permission.key, checked === true)
                                            }
                                            aria-label={`${role.name} ${permission.label}`}
                                          />
                                        )}
                                      </div>
                                    </TableCell>
                                  )
                                })}
                              </TableRow>
                            ))}
                        </Fragment>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRole ? "Edit Role" : "Add Role"}</DialogTitle>
            <DialogDescription>
              {editingRole
                ? "Update this organization role."
                : "Create a new custom role for this organization."}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="roleName">Role Name</Label>
              <Input
                id="roleName"
                value={roleName}
                onChange={(event) => setRoleName(event.target.value)}
                placeholder="Example: Teacher, Accountant, Volunteer"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="roleDescription">Description</Label>
              <Textarea
                id="roleDescription"
                value={roleDescription}
                onChange={(event) => setRoleDescription(event.target.value)}
                placeholder="Describe what this role is for..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={saveRole} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingRole ? "Save Changes" : "Create Role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
