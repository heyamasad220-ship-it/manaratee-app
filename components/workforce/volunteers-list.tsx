"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { HeartHandshake, Loader2, Plus, Search, User } from "lucide-react"
import { createVolunteer } from "@/lib/volunteers/volunteer-actions"
import {
  fetchVolunteersList,
  type VolunteerListRow,
} from "@/lib/workforce/volunteer-queries"
import type { VolunteerStatus } from "@/lib/volunteers/volunteer-types"
import { volunteerStatusStyles } from "@/lib/volunteers/volunteer-utils"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { formatContactDate } from "@/lib/contacts/contact-profile-data"

const STATUS_OPTIONS: { value: VolunteerStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "pending", label: "Pending" },
  { value: "inactive", label: "Inactive" },
]

function getInitials(name: string) {
  return (name?.trim() || "?")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

export function VolunteersList() {
  const router = useRouter()
  const [rows, setRows] = useState<VolunteerListRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<VolunteerStatus | "all">("active")
  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    status: "active" as VolunteerStatus,
    skills: "",
    notes: "",
  })

  const loadRows = useCallback(async () => {
    setLoading(true)
    try {
      const result = await fetchVolunteersList({ search, status: statusFilter })
      setRows(result.rows)
    } catch (error) {
      console.error("Error loading volunteers:", error)
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter])

  useEffect(() => {
    void loadRows()
  }, [loadRows])

  const activeCount = useMemo(
    () => rows.filter((row) => row.status === "active").length,
    [rows]
  )

  async function handleAddVolunteer() {
    if (!form.first_name.trim() || !form.last_name.trim()) {
      alert("First and last name are required")
      return
    }

    setSaving(true)
    try {
      const { contactId } = await createVolunteer({
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        status: form.status,
        join_date: new Date().toISOString().slice(0, 10),
        skills: form.skills
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        availability: [],
        notes: form.notes.trim() || undefined,
      })
      setAddOpen(false)
      await loadRows()
      if (contactId) {
        router.push(`/contacts/${contactId}`)
      } else {
        router.refresh()
      }
    } catch (error: any) {
      alert(error?.message || "Could not add volunteer")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Volunteers</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Volunteer roster with sign-ups, service history, and credentials. Distinct from
            MAS membership and program participants.
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add volunteer
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <HeartHandshake className="h-8 w-8 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">Showing</p>
              <p className="text-2xl font-bold">{rows.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <User className="h-8 w-8 text-emerald-600" />
            <div>
              <p className="text-sm text-muted-foreground">Active in results</p>
              <p className="text-2xl font-bold">{activeCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 p-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search volunteers..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value as VolunteerStatus | "all")}
            >
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading volunteers...
            </div>
          ) : rows.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No volunteers match these filters.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Volunteer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Since</TableHead>
                  <TableHead>Skills</TableHead>
                  <TableHead className="text-right">Profile</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.volunteerId}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>{getInitials(row.name)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{row.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {row.email || row.phone || "—"}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={volunteerStatusStyles[row.status]}>
                        {row.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatContactDate(row.joinDate)}</TableCell>
                    <TableCell>
                      {row.skills.length > 0 ? row.skills.slice(0, 2).join(", ") : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.contactId ? (
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/contacts/${row.contactId}`}>Open</Link>
                        </Button>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add volunteer</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="vol-first">First name</Label>
                <Input
                  id="vol-first"
                  value={form.first_name}
                  onChange={(e) => setForm((c) => ({ ...c, first_name: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="vol-last">Last name</Label>
                <Input
                  id="vol-last"
                  value={form.last_name}
                  onChange={(e) => setForm((c) => ({ ...c, last_name: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="vol-email">Email</Label>
                <Input
                  id="vol-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((c) => ({ ...c, email: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="vol-phone">Phone</Label>
                <Input
                  id="vol-phone"
                  value={form.phone}
                  onChange={(e) => setForm((c) => ({ ...c, phone: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(value) =>
                  setForm((c) => ({ ...c, status: value as VolunteerStatus }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="vol-skills">Skills (comma-separated)</Label>
              <Input
                id="vol-skills"
                value={form.skills}
                onChange={(e) => setForm((c) => ({ ...c, skills: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="vol-notes">Notes</Label>
              <Textarea
                id="vol-notes"
                value={form.notes}
                onChange={(e) => setForm((c) => ({ ...c, notes: e.target.value }))}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleAddVolunteer} disabled={saving}>
              {saving ? "Saving..." : "Add volunteer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
