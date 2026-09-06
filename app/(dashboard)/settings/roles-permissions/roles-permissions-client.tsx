"use client"

import { useEffect, useMemo, useState } from "react"
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Plus, Trash2, Loader2, ChevronRight } from "lucide-react"
import {
  permissionGroupsForDefinitions,
  type PermissionDefinition,
} from "@/lib/permissions/permission-definitions"
import { filterOrganizationRolesForOrganization } from "@/lib/permissions/facilities-access"
import { setOrganizationRolePermissionAction } from "@/lib/organizations/role-permission-actions"
import {
  createOrganizationRoleAction,
  deleteOrganizationRoleAction,
  loadOrganizationRolesWorkspaceAction,
  updateOrganizationRoleAction,
} from "@/lib/organizations/organization-role-actions"

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

export function RolesPermissionsClient({
  organizationId,
  enabledModuleSlugs,
  permissionDefinitions,
  initialRoles,
  initialMembers,
  initialPermissions,
  initialError,
}: {
  organizationId: string
  enabledModuleSlugs: string[]
  permissionDefinitions: PermissionDefinition[]
  initialRoles: OrganizationRole[]
  initialMembers: OrganizationMember[]
  initialPermissions: RolePermission[]
  initialError: string | null
}) {
  const permissionGroups = useMemo(
    () => permissionGroupsForDefinitions(permissionDefinitions),
    [permissionDefinitions]
  )

  const [roles, setRoles] = useState<OrganizationRole[]>(initialRoles)
  const [members, setMembers] = useState<OrganizationMember[]>(initialMembers)
  const [permissions, setPermissions] = useState<RolePermission[]>(initialPermissions)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savingPermissionKey, setSavingPermissionKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(initialError)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [roleName, setRoleName] = useState("")
  const [roleDescription, setRoleDescription] = useState("")

  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null)
  const [sheetName, setSheetName] = useState("")
  const [sheetDescription, setSheetDescription] = useState("")
  const [savingRoleDetails, setSavingRoleDetails] = useState(false)

  async function loadData() {
    setLoading(true)
    setError(null)

    const result = await loadOrganizationRolesWorkspaceAction()
    if (!result.success) {
      setError(result.error)
      setRoles([])
      setMembers([])
      setPermissions([])
      setLoading(false)
      return
    }

    setRoles(result.roles as OrganizationRole[])
    setMembers(result.members as OrganizationMember[])
    setPermissions(result.permissions as RolePermission[])
    setLoading(false)
  }

  useEffect(() => {
    setRoles(initialRoles)
    setMembers(initialMembers)
    setPermissions(initialPermissions)
    setError(initialError)
  }, [initialRoles, initialMembers, initialPermissions, initialError])

  const visibleRoles = useMemo(
    () => filterOrganizationRolesForOrganization(roles, enabledModuleSlugs),
    [roles, enabledModuleSlugs]
  )

  const selectedRole = useMemo(
    () => visibleRoles.find((role) => role.id === selectedRoleId) ?? null,
    [visibleRoles, selectedRoleId]
  )

  const roleCounts = useMemo(() => {
    return visibleRoles.reduce<Record<string, number>>((acc, role) => {
      acc[role.id] = members.filter((member) => member.role_id === role.id).length
      return acc
    }, {})
  }, [visibleRoles, members])

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

  function enabledPermissionCount(roleId: string) {
    return permissionDefinitions.filter((permission) =>
      roleHasPermission(roleId, permission.key)
    ).length
  }

  function openAddDialog() {
    setRoleName("")
    setRoleDescription("")
    setDialogOpen(true)
  }

  function openRoleSheet(role: OrganizationRole) {
    setSelectedRoleId(role.id)
    setSheetName(role.name)
    setSheetDescription(role.description ?? "")
  }

  function closeRoleSheet() {
    setSelectedRoleId(null)
    setSheetName("")
    setSheetDescription("")
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

    const result = await createOrganizationRoleAction({
      name: cleanName,
      description: cleanDescription || null,
    })

    if (!result.success) {
      setError(result.error)
      setSaving(false)
      return
    }

    setDialogOpen(false)
    setRoleName("")
    setRoleDescription("")
    await loadData()
    setSaving(false)
    if (result.roleId) {
      setSelectedRoleId(result.roleId)
      setSheetName(cleanName)
      setSheetDescription(cleanDescription)
    }
  }

  async function saveRoleDetails() {
    if (!selectedRole || selectedRole.is_system_role) return

    const cleanName = sheetName.trim()
    const cleanDescription = sheetDescription.trim()
    if (!cleanName) {
      setError("Role name is required.")
      return
    }

    setSavingRoleDetails(true)
    setError(null)

    const result = await updateOrganizationRoleAction({
      roleId: selectedRole.id,
      name: cleanName,
      description: cleanDescription || null,
    })

    if (!result.success) {
      setError(result.error)
      setSavingRoleDetails(false)
      return
    }

    setRoles((current) =>
      current.map((role) =>
        role.id === selectedRole.id
          ? { ...role, name: cleanName, description: cleanDescription || null }
          : role
      )
    )
    setSavingRoleDetails(false)
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

    const result = await deleteOrganizationRoleAction({ roleId: role.id })
    if (!result.success) {
      setError(result.error)
      setSaving(false)
      return
    }

    if (selectedRoleId === role.id) {
      closeRoleSheet()
    }
    await loadData()
    setSaving(false)
  }

  async function togglePermission(role: OrganizationRole, permissionKey: string, enabled: boolean) {
    const saveKey = `${role.id}:${permissionKey}`
    setSavingPermissionKey(saveKey)
    setError(null)

    const result = await setOrganizationRolePermissionAction({
      roleId: role.id,
      permissionKey,
      enabled,
    })

    if (!result.success) {
      setError(result.error)
      setSavingPermissionKey(null)
      return
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

  async function toggleGroupPermissions(
    role: OrganizationRole,
    group: string,
    enabled: boolean
  ) {
    const groupPermissions = permissionDefinitions.filter(
      (permission) => permission.group === group
    )
    for (const permission of groupPermissions) {
      if (roleHasPermission(role.id, permission.key) === enabled) continue
      await togglePermission(role, permission.key, enabled)
    }
  }

  const detailsDirty =
    Boolean(selectedRole) &&
    !selectedRole?.is_system_role &&
    (sheetName.trim() !== selectedRole.name ||
      (sheetDescription.trim() || "") !== (selectedRole.description ?? ""))

  return (
    <>
      <Header title="Roles & Permissions" />

      <div className="p-6">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-foreground">Manage Roles</h2>
              <p className="text-sm text-muted-foreground">
                Open a role to choose what it can access. Changes save immediately.
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
                    <TableHead>Access</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[72px] text-right"> </TableHead>
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
                    visibleRoles.map((role) => {
                      const enabledCount = enabledPermissionCount(role.id)
                      return (
                        <TableRow
                          key={role.id}
                          className="cursor-pointer"
                          onClick={() => openRoleSheet(role)}
                        >
                          <TableCell>
                            <div className="flex flex-col gap-0.5">
                              <span className="font-medium">{role.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {role.description || "No description"}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>{roleCounts[role.id] ?? 0} users</TableCell>
                          <TableCell className="text-muted-foreground">
                            {enabledCount} of {permissionDefinitions.length}
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
                                className="h-8 w-8 text-muted-foreground hover:text-red-600"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  void deleteRole(role)
                                }}
                                disabled={role.is_system_role || (roleCounts[role.id] ?? 0) > 0}
                                title={
                                  (roleCounts[role.id] ?? 0) > 0
                                    ? "Move users out of this role before deleting it"
                                    : "Delete role"
                                }
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}

                  {!loading && visibleRoles.length === 0 && (
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
        </div>
      </div>

      <Sheet
        open={Boolean(selectedRole)}
        onOpenChange={(open) => {
          if (!open) closeRoleSheet()
        }}
      >
        <SheetContent
          side="right"
          className="w-full gap-0 overflow-y-auto p-0 sm:max-w-xl"
        >
          {selectedRole ? (
            <>
              <SheetHeader className="border-b p-6">
                <SheetTitle>{selectedRole.name}</SheetTitle>
                <SheetDescription>
                  Choose what this role can do. Checkboxes save as you click them.
                </SheetDescription>
              </SheetHeader>

              <div className="flex flex-col gap-6 p-6">
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="sheetRoleName">Role name</Label>
                    <Input
                      id="sheetRoleName"
                      value={sheetName}
                      onChange={(event) => setSheetName(event.target.value)}
                      disabled={selectedRole.is_system_role}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="sheetRoleDescription">Description</Label>
                    <Textarea
                      id="sheetRoleDescription"
                      value={sheetDescription}
                      onChange={(event) => setSheetDescription(event.target.value)}
                      disabled={selectedRole.is_system_role}
                      rows={2}
                    />
                  </div>
                  {!selectedRole.is_system_role ? (
                    <div>
                      <Button
                        size="sm"
                        onClick={() => void saveRoleDetails()}
                        disabled={!detailsDirty || savingRoleDetails}
                      >
                        {savingRoleDetails && (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        Save role details
                      </Button>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      System role names cannot be changed. You can still edit permissions.
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-6">
                  {permissionGroups.map((group) => {
                    const groupPermissions = permissionDefinitions.filter(
                      (permission) => permission.group === group
                    )
                    const enabledInGroup = groupPermissions.filter((permission) =>
                      roleHasPermission(selectedRole.id, permission.key)
                    ).length
                    const allEnabled = enabledInGroup === groupPermissions.length
                    const someEnabled = enabledInGroup > 0 && !allEnabled

                    return (
                      <div key={group} className="flex flex-col gap-3">
                        <div className="flex items-center justify-between gap-3 border-b pb-2">
                          <div>
                            <p className="font-semibold">{group}</p>
                            <p className="text-xs text-muted-foreground">
                              {enabledInGroup} of {groupPermissions.length}
                            </p>
                          </div>
                          <label className="flex items-center gap-2 text-sm">
                            <Checkbox
                              checked={allEnabled ? true : someEnabled ? "indeterminate" : false}
                              onCheckedChange={(checked) =>
                                void toggleGroupPermissions(
                                  selectedRole,
                                  group,
                                  checked === true
                                )
                              }
                              aria-label={`All ${group} permissions`}
                            />
                            All
                          </label>
                        </div>

                        <div className="flex flex-col gap-3">
                          {groupPermissions.map((permission) => {
                            const saveKey = `${selectedRole.id}:${permission.key}`
                            const isSaving = savingPermissionKey === saveKey
                            return (
                              <label
                                key={permission.key}
                                className="flex items-start gap-3 rounded-md p-2 hover:bg-muted/50"
                              >
                                <div className="mt-0.5 flex h-4 w-4 items-center justify-center">
                                  {isSaving ? (
                                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                  ) : (
                                    <Checkbox
                                      checked={roleHasPermission(
                                        selectedRole.id,
                                        permission.key
                                      )}
                                      onCheckedChange={(checked) =>
                                        void togglePermission(
                                          selectedRole,
                                          permission.key,
                                          checked === true
                                        )
                                      }
                                      aria-label={permission.label}
                                    />
                                  )}
                                </div>
                                <span className="flex flex-col gap-0.5">
                                  <span className="text-sm font-medium leading-none">
                                    {permission.label}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    {permission.description}
                                  </span>
                                </span>
                              </label>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Role</DialogTitle>
            <DialogDescription>
              Create a custom role, then choose its permissions.
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
              Create Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
