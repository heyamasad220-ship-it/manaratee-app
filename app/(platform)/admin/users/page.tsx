"use client"

import { useState } from "react"
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
  role: "Super Admin" | "Admin" | "Support"
  lastLogin: string
  status: "Active" | "Inactive"
}

const platformUsers: PlatformUser[] = [
  { id: "u-1", name: "Ahmed Hassan", email: "ahmed@manaratee.com", role: "Super Admin", lastLogin: "Feb 23, 2026 - 9:15 AM", status: "Active" },
  { id: "u-2", name: "Sarah Martinez", email: "sarah@manaratee.com", role: "Admin", lastLogin: "Feb 23, 2026 - 8:30 AM", status: "Active" },
  { id: "u-3", name: "Omar Khalil", email: "omar@manaratee.com", role: "Admin", lastLogin: "Feb 22, 2026 - 4:45 PM", status: "Active" },
  { id: "u-4", name: "Fatima Ali", email: "fatima@manaratee.com", role: "Support", lastLogin: "Feb 22, 2026 - 2:00 PM", status: "Active" },
  { id: "u-5", name: "David Chen", email: "david@manaratee.com", role: "Support", lastLogin: "Feb 20, 2026 - 11:00 AM", status: "Active" },
  { id: "u-6", name: "Aisha Patel", email: "aisha@manaratee.com", role: "Admin", lastLogin: "Feb 10, 2026 - 3:20 PM", status: "Inactive" },
]

const roleStyles: Record<string, string> = {
  "Super Admin": "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  Admin: "bg-blue-100 text-blue-700 hover:bg-blue-100",
  Support: "bg-zinc-100 text-zinc-700 hover:bg-zinc-100",
}

const statusStyles: Record<string, string> = {
  Active: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  Inactive: "bg-zinc-100 text-zinc-500 hover:bg-zinc-100",
}

export default function PlatformUsersPage() {
  const [search, setSearch] = useState("")
  const [inviteOpen, setInviteOpen] = useState(false)

  const filtered = platformUsers.filter((u) => {
    if (!search) return true
    const q = search.toLowerCase()
    return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
  })

  return (
    <>
      <PlatformHeader title="Platform Users" />
      <div className="flex flex-col gap-5 p-6">
        <Card className="border border-border shadow-sm">
          <CardContent className="p-0">
            <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-border">
              <div className="relative w-[280px]">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search users..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
              <Button className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => setInviteOpen(true)}>
                <Plus className="h-4 w-4" />
                Invite User
              </Button>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-medium text-muted-foreground">Name</TableHead>
                  <TableHead className="font-medium text-muted-foreground">Email</TableHead>
                  <TableHead className="font-medium text-muted-foreground">Role</TableHead>
                  <TableHead className="font-medium text-muted-foreground">Last Login</TableHead>
                  <TableHead className="font-medium text-muted-foreground">Status</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">
                          {user.name.split(" ").map((n) => n[0]).join("")}
                        </div>
                        <span className="font-medium text-foreground">{user.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{user.email}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={roleStyles[user.role] || ""}>
                        {user.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">{user.lastLogin}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={statusStyles[user.status] || ""}>
                        {user.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Actions</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>Edit Role</DropdownMenuItem>
                          <DropdownMenuItem>Reset Password</DropdownMenuItem>
                          {user.status === "Active" ? (
                            <DropdownMenuItem className="text-destructive">Deactivate</DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem>Activate</DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Invite User Dialog */}
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
              <Input id="invite-email" type="email" placeholder="jane@manaratee.com" />
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
            <Button variant="outline" onClick={() => setInviteOpen(false)}>
              Cancel
            </Button>
            <Button className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => setInviteOpen(false)}>
              Send Invite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
