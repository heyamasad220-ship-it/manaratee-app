"use client"

import { useEffect, useState } from "react"
import { PlatformHeader } from "@/components/platform/platform-header"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { Search, Plus, MoreHorizontal } from "lucide-react"

interface PlatformUser {
  id: string
  name: string
  email: string
  role: "Owner" | "Admin" | "Support"
  lastLogin: string
  status: "Active" | "Inactive"
}

const roleStyles: Record<string, string> = {
  "Owner": "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  Admin: "bg-blue-100 text-blue-700 hover:bg-blue-100",
  Support: "bg-zinc-100 text-zinc-700 hover:bg-zinc-100",
}

const statusStyles: Record<string, string> = {
  Active: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  Inactive: "bg-zinc-100 text-zinc-500 hover:bg-zinc-100",
}

export default function PlatformUsersPage() {
  const [platformUsers, setPlatformUsers] = useState<PlatformUser[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [inviteOpen, setInviteOpen] = useState(false)

  useEffect(() => {
    async function loadUsers() {
      setLoading(true)

      try {
        const response = await fetch("/api/platform/users")
        const result = await response.json()

        if (!response.ok) {
          console.error("LOAD USERS ERROR:", result)
          setLoading(false)
          return
        }

        const users = result.users || []

const mapped: PlatformUser[] = users.map((user: any) => ({
  id: user.id,
  name: user.email?.split("@")[0] || "Platform User",
  email: user.email || "No email",
  role: user.is_platform_admin
    ? "Owner"
    : user.role === "admin"
    ? "Admin"
    : "Support",
  lastLogin: user.updated_at
    ? new Date(user.updated_at).toLocaleString()
    : "Never",
  status: "Active",
}))
        setPlatformUsers(mapped)
      } catch (error) {
        console.error("LOAD USERS ERROR:", error)
      } finally {
        setLoading(false)
      }
    }

    loadUsers()
  }, [])

  const filtered = platformUsers.filter((user) => {
    if (!search) return true

    const q = search.toLowerCase()

    return (
      user.name.toLowerCase().includes(q) ||
      user.email.toLowerCase().includes(q)
    )
  })

  return (
    <>
      <PlatformHeader title="Platform Users" />

      <div className="flex flex-col gap-5 p-6">
        <Card className="border border-border shadow-sm">
          <CardContent className="p-0">
            <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
              <div className="relative w-[280px]">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

                <Input
                  placeholder="Search users..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-9 pl-9"
                />
              </div>

              <Button
                className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
                onClick={() => setInviteOpen(true)}
              >
                <Plus className="h-4 w-4" />
                Invite User
              </Button>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Last Login</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[50px]" />
                </TableRow>
              </TableHeader>

              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="h-24 text-center text-muted-foreground"
                    >
                      Loading users...
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="h-24 text-center text-muted-foreground"
                    >
                      No users found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">
                            {user.name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")
                              .slice(0, 2)
                              .toUpperCase()}
                          </div>

                          <span className="font-medium text-foreground">
                            {user.name}
                          </span>
                        </div>
                      </TableCell>

                      <TableCell className="text-muted-foreground">
                        {user.email}
                      </TableCell>

                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={roleStyles[user.role]}
                        >
                          {user.role}
                        </Badge>
                      </TableCell>

                      <TableCell className="text-xs text-muted-foreground">
                        {user.lastLogin}
                      </TableCell>

                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={statusStyles[user.status]}
                        >
                          {user.status}
                        </Badge>
                      </TableCell>

                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>

                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                              Edit Role
                            </DropdownMenuItem>

                            <DropdownMenuItem>
                              Reset Password
                            </DropdownMenuItem>

                            {user.role !== "Owner" ? (
                              user.status === "Active" ? (
                                <DropdownMenuItem className="text-destructive">
                                  Deactivate
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem>
                                  Activate
                                </DropdownMenuItem>
                              )
                            ) : null}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Invite User</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="invite-name">Full Name</Label>
              <Input id="invite-name" placeholder="e.g. Jane Doe" />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="invite-email">Email Address</Label>

              <Input
                id="invite-email"
                type="email"
                placeholder="jane@manaratee.com"
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="invite-role">Role</Label>

              <Select>
                <SelectTrigger id="invite-role">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="support">Support</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setInviteOpen(false)}
            >
              Cancel
            </Button>

            <Button
              className="bg-emerald-600 text-white hover:bg-emerald-700"
              onClick={() => setInviteOpen(false)}
            >
              Send Invite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}