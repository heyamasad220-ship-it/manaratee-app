"use client"

import { useEffect, useMemo, useState } from "react"
import { Header } from "@/components/layout/header"
import {
  fetchOrganizationUsersForSettings,
  updateOrganizationMemberRole,
  type OrganizationSettingsRole,
  type OrganizationSettingsUser,
} from "@/lib/organizations/organization-users-actions"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Search,
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Shield,
  Mail,
  Users,
  UserCheck,
  UserX,
  Loader2,
  ExternalLink,
} from "lucide-react"
import { OrganizationJoinLinkCard } from "@/components/settings/organization-join-link-card"
import { enterCustomerPortalAsUser } from "@/lib/organizations/org-user-access-actions"
import { isOrganizationSystemAdmin } from "@/lib/organizations/organization-system-admin"

export function UsersSettingsClient({
  organizationId,
  organizationName,
  organizationSlug,
}: {
  organizationId: string | null
  organizationName: string
  organizationSlug: string | null
}) {
  const [users, setUsers] = useState<OrganizationSettingsUser[]>([])
  const [roles, setRoles] = useState<OrganizationSettingsRole[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState("All")
  const [statusFilter, setStatusFilter] = useState("All")

  const [showAddDialog, setShowAddDialog] = useState(false)
  const [inviteFirstName, setInviteFirstName] = useState("")
  const [inviteLastName, setInviteLastName] = useState("")
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRoleId, setInviteRoleId] = useState("")
  const [sendingInvite, setSendingInvite] = useState(false)

  const [showRoleDialog, setShowRoleDialog] = useState(false)
  const [selectedUser, setSelectedUser] = useState<OrganizationSettingsUser | null>(null)
  const [selectedRoleId, setSelectedRoleId] = useState("")
  const [savingRole, setSavingRole] = useState(false)

  async function loadUsers() {
    if (!organizationId) {
      setUsers([])
      setRoles([])
      setError("No organization selected.")
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const payload = await fetchOrganizationUsersForSettings()
      setRoles(payload.roles)
      setUsers(payload.users)

      if (!inviteRoleId && payload.roles.length > 0) {
        const adminRole = payload.roles.find((role) => role.name.toLowerCase() === "admin")
        setInviteRoleId(adminRole?.id ?? payload.roles[0].id)
      }
    } catch (loadError) {
      console.error(loadError)
      setRoles([])
      setUsers([])
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load organization users."
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUsers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId])

  function resetInviteForm() {
    setInviteFirstName("")
    setInviteLastName("")
    setInviteEmail("")

    const adminRole = roles.find((role) => role.name.toLowerCase() === "admin")
    setInviteRoleId(adminRole?.id ?? roles[0]?.id ?? "")
  }

  async function handleInviteUser() {
    const cleanEmail = inviteEmail.trim().toLowerCase()

    if (!cleanEmail) {
      alert("Enter an email address.")
      return
    }

    if (!inviteRoleId) {
      alert("Select a role.")
      return
    }

    const selectedRole = roles.find((role) => role.id === inviteRoleId)

    if (!selectedRole) {
      alert("Selected role was not found.")
      return
    }

    setSendingInvite(true)

    try {
      const response = await fetch("/api/organizations/invite-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: cleanEmail,
          organizationId,
          roleId: inviteRoleId,
          roleName: selectedRole.name,
          firstName: inviteFirstName.trim() || null,
          lastName: inviteLastName.trim() || null,
        }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        const message = [
          result.error,
          result.details,
          result.fix,
        ]
          .filter(Boolean)
          .join(" — ")
        alert(message || "Failed to send invitation.")
        return
      }

      alert(result.message || "Invitation email sent successfully.")

      resetInviteForm()
      setShowAddDialog(false)
      await loadUsers()
    } catch (error) {
      console.error("Invite error:", error)
      alert("Unexpected error sending invitation.")
    } finally {
      setSendingInvite(false)
    }
  }

  function openChangeRoleDialog(user: OrganizationSettingsUser) {
    setSelectedUser(user)
    setSelectedRoleId(user.roleId ?? "")
    setShowRoleDialog(true)
  }

  async function saveUserRole() {
    if (!selectedUser) return

    if (!selectedRoleId) {
      alert("Select a role.")
      return
    }

    setSavingRole(true)
    setError(null)

    try {
      await updateOrganizationMemberRole({
        membershipId: selectedUser.membershipId,
        roleId: selectedRoleId,
      })
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Could not update user role."
      )
      setSavingRole(false)
      return
    }

    setShowRoleDialog(false)
    setSelectedUser(null)
    setSelectedRoleId("")
    await loadUsers()
    setSavingRole(false)
  }

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const matchesSearch =
        user.name.toLowerCase().includes(search.toLowerCase()) ||
        user.email.toLowerCase().includes(search.toLowerCase())

      const matchesRole = roleFilter === "All" || user.roleName === roleFilter
      const matchesStatus = statusFilter === "All" || user.status === statusFilter

      return matchesSearch && matchesRole && matchesStatus
    })
  }, [users, search, roleFilter, statusFilter])

  const totalUsers = users.length
  const activeUsers = users.filter((u) => u.status === "Active").length
  const adminUsers = users.filter((u) =>
    ["admin", "super admin"].includes(u.roleName.toLowerCase()),
  ).length

  return (
    <>
      <Header title="Settings" />

      <main className="flex-1 overflow-auto bg-background p-4 md:p-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-6">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Users</h2>
            <p className="text-sm text-muted-foreground">
              Manage user accounts and organization roles.
            </p>
          </div>

          {error && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="pt-6 text-sm text-red-700">
                <strong>Error:</strong> {error}
              </CardContent>
            </Card>
          )}

          {organizationSlug && (
            <OrganizationJoinLinkCard
              organizationName={organizationName}
              organizationSlug={organizationSlug}
            />
          )}

          <div className="flex flex-wrap gap-4 [&>*]:w-fit">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{loading ? "—" : totalUsers}</p>
                    <p className="text-xs text-muted-foreground">Total Users</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
                    <UserCheck className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{loading ? "—" : activeUsers}</p>
                    <p className="text-xs text-muted-foreground">Active Users</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
                    <Shield className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{loading ? "—" : adminUsers}</p>
                    <p className="text-xs text-muted-foreground">Admins</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/10">
                    <UserX className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      {loading ? "—" : totalUsers - activeUsers}
                    </p>
                    <p className="text-xs text-muted-foreground">Inactive Users</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>All Users</CardTitle>
                  <CardDescription>
                    Staff accounts for this organization, including invited Super Admins.
                  </CardDescription>
                </div>

                <Button onClick={() => setShowAddDialog(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add User
                </Button>
              </div>
            </CardHeader>

            <CardContent>
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search users..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>

                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="Role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All Roles</SelectItem>
                    {roles.map((role) => (
                      <SelectItem key={role.id} value={role.name}>
                        {role.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-[150px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All Status</SelectItem>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Login</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="w-[60px]" />
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                          <div className="flex items-center justify-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading users...
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : filteredUsers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                          No users found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredUsers.map((user) => (
                        <TableRow key={user.membershipId}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
                                <span className="text-sm font-medium text-primary">
                                  {user.name
                                    .split(" ")
                                    .map((n) => n[0])
                                    .join("")
                                    .slice(0, 2)
                                    .toUpperCase()}
                                </span>
                              </div>
                              <div>
                                <p className="font-medium">{user.name}</p>
                                <p className="text-sm text-muted-foreground">{user.email}</p>
                              </div>
                            </div>
                          </TableCell>

                          <TableCell>
                            <Badge
                              variant={
                                ["admin", "super admin"].includes(user.roleName.toLowerCase())
                                  ? "default"
                                  : "secondary"
                              }
                            >
                              {user.roleName}
                            </Badge>
                          </TableCell>

                          <TableCell>
                            <Badge
                              variant={user.status === "Active" ? "default" : "outline"}
                              className={
                                user.status === "Active"
                                  ? "bg-green-100 text-green-800 hover:bg-green-100"
                                  : ""
                              }
                            >
                              {user.status}
                            </Badge>
                          </TableCell>

                          <TableCell className="text-muted-foreground">
                            {user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : "—"}
                          </TableCell>

                          <TableCell className="text-muted-foreground">
                            {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "—"}
                          </TableCell>

                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>

                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openChangeRoleDialog(user)}>
                                  <Shield className="mr-2 h-4 w-4" />
                                  Change Role
                                </DropdownMenuItem>

                                {organizationId &&
                                !isOrganizationSystemAdmin(user.systemRole) ? (
                                  <DropdownMenuItem asChild>
                                    <form
                                      action={enterCustomerPortalAsUser.bind(
                                        null,
                                        organizationId,
                                        user.userId
                                      )}
                                    >
                                      <button
                                        type="submit"
                                        className="flex w-full cursor-default items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                                      >
                                        <ExternalLink className="mr-2 h-4 w-4" />
                                        Open portal as user
                                      </button>
                                    </form>
                                  </DropdownMenuItem>
                                ) : null}

                                <DropdownMenuItem disabled>
                                  <Pencil className="mr-2 h-4 w-4" />
                                  Edit Profile
                                </DropdownMenuItem>

                                <DropdownMenuItem disabled>
                                  <Mail className="mr-2 h-4 w-4" />
                                  Send Reset Email
                                </DropdownMenuItem>

                                <DropdownMenuItem disabled className="text-red-600">
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add User</DialogTitle>
            <DialogDescription>
              Send an invitation email to add a user to this organization.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="first-name">First Name</Label>
                <Input
                  id="first-name"
                  value={inviteFirstName}
                  onChange={(e) => setInviteFirstName(e.target.value)}
                  placeholder="Enter first name"
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="last-name">Last Name</Label>
                <Input
                  id="last-name"
                  value={inviteLastName}
                  onChange={(e) => setInviteLastName(e.target.value)}
                  placeholder="Enter last name"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="Enter email address"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="role">Role</Label>
              <Select value={inviteRoleId} onValueChange={setInviteRoleId}>
                <SelectTrigger id="role">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2 rounded-md bg-muted/50 p-3">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                An invitation email will be sent to the user with login instructions.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                resetInviteForm()
                setShowAddDialog(false)
              }}
              disabled={sendingInvite}
            >
              Cancel
            </Button>

            <Button onClick={handleInviteUser} disabled={sendingInvite}>
              {sendingInvite ? "Sending..." : "Send Invitation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showRoleDialog} onOpenChange={setShowRoleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Role</DialogTitle>
            <DialogDescription>
              {selectedUser ? `Update role for ${selectedUser.name}.` : "Update user role."}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2 py-4">
            <Label htmlFor="change-role">Role</Label>
            <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
              <SelectTrigger id="change-role">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                {roles.map((role) => (
                  <SelectItem key={role.id} value={role.id}>
                    {role.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRoleDialog(false)} disabled={savingRole}>
              Cancel
            </Button>

            <Button onClick={saveUserRole} disabled={savingRole}>
              {savingRole && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
