"use client"

import { useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Header } from "@/components/layout/header"
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
} from "lucide-react"

type OrgRole = {
  id: string
  name: string
  description: string | null
}

type OrgMemberRow = {
  id: string
  user_id: string
  organization_id: string
  role: string
  role_id: string | null
  created_at: string | null
}

type ProfileRow = {
  id: string
  first_name: string | null
  last_name: string | null
  email: string | null
  created_at: string | null
  updated_at: string | null
}

type OrgUser = {
  membershipId: string
  userId: string
  name: string
  email: string
  systemRole: string
  roleId: string | null
  roleName: string
  status: string
  lastLogin: string | null
  createdAt: string | null
}

function formatSystemRole(value: string | null | undefined) {
  if (!value) return "Member"

  return value
    .replace(/_/g, " ")
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

export function UsersSettingsClient({
  organizationId,
}: {
  organizationId: string
}) {
  const supabase = createClient()

  const [users, setUsers] = useState<OrgUser[]>([])
  const [roles, setRoles] = useState<OrgRole[]>([])
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
  const [selectedUser, setSelectedUser] = useState<OrgUser | null>(null)
  const [selectedRoleId, setSelectedRoleId] = useState("")
  const [savingRole, setSavingRole] = useState(false)

  async function loadUsers() {
    setLoading(true)
    setError(null)

    const rolesResult = await supabase
      .from("organization_roles")
      .select("id, name, description")
      .eq("organization_id", organizationId)
      .order("name", { ascending: true })

    if (rolesResult.error) {
      setError(rolesResult.error.message)
      setRoles([])
      setUsers([])
      setLoading(false)
      return
    }

    const roleRows = (rolesResult.data ?? []) as OrgRole[]
    setRoles(roleRows)

    if (!inviteRoleId && roleRows.length > 0) {
      const adminRole = roleRows.find((role) => role.name.toLowerCase() === "admin")
      setInviteRoleId(adminRole?.id ?? roleRows[0].id)
    }

    const membersResult = await supabase
      .from("organization_members")
      .select("id, user_id, organization_id, role, role_id, created_at")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })

    if (membersResult.error) {
      setError(membersResult.error.message)
      setUsers([])
      setLoading(false)
      return
    }

    const members = (membersResult.data ?? []) as OrgMemberRow[]
    const userIds = members.map((member) => member.user_id)

    let profiles: ProfileRow[] = []

    if (userIds.length > 0) {
      const profilesResult = await supabase
        .from("profiles")
        .select("id, first_name, last_name, email, created_at, updated_at")
        .in("id", userIds)

      if (profilesResult.error) {
        setError(profilesResult.error.message)
        setUsers([])
        setLoading(false)
        return
      }

      profiles = (profilesResult.data ?? []) as ProfileRow[]
    }

    const roleById = new Map(roleRows.map((role) => [role.id, role]))
    const profileById = new Map(profiles.map((profile) => [profile.id, profile]))

    const formattedUsers: OrgUser[] = members.map((member) => {
      const profile = profileById.get(member.user_id)
      const customRole = member.role_id ? roleById.get(member.role_id) : null
      const email = profile?.email ?? "No email found"
      const name =
        `${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`.trim() ||
        email

      return {
        membershipId: member.id,
        userId: member.user_id,
        name,
        email,
        systemRole: member.role,
        roleId: member.role_id,
        roleName: customRole?.name ?? formatSystemRole(member.role),
        status: "Active",
        lastLogin: profile?.updated_at ?? null,
        createdAt: profile?.created_at ?? member.created_at,
      }
    })

    setUsers(formattedUsers)
    setLoading(false)
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
        alert(result.error || "Failed to send invitation.")
        return
      }

      alert("Invitation email sent successfully.")

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

  function openChangeRoleDialog(user: OrgUser) {
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

    const { error } = await supabase
      .from("organization_members")
      .update({
        role_id: selectedRoleId,
      })
      .eq("id", selectedUser.membershipId)
      .eq("organization_id", organizationId)

    if (error) {
      setError(error.message)
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

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
                    Users are loaded from organization_members and roles are loaded from organization_roles.
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
