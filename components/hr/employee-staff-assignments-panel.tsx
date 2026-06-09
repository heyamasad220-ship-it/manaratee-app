"use client"

import * as React from "react"
import { useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Calendar, MoreHorizontal, Pencil, Trash2, UserPlus } from "lucide-react"

type AssignmentRole = "instructor" | "assistant" | "volunteer" | "childcare"

type Program = {
  id: string
  name: string
}

type StaffAssignment = {
  id: string
  staff_id: string
  program_id: string
  role: AssignmentRole
  start_date: string | null
  end_date: string | null
  schedule: string | null
  program_name: string
}

function getAssignmentRoleBadge(role: AssignmentRole) {
  if (role === "instructor") return <Badge variant="outline">Instructor</Badge>
  if (role === "assistant") return <Badge variant="outline">Assistant</Badge>
  if (role === "childcare") return <Badge variant="outline">Child Care</Badge>
  return <Badge variant="outline">Volunteer</Badge>
}

function formatAssignmentDate(date: string) {
  if (!date) return ""
  const parsedDate = new Date(`${date}T00:00:00`)
  return parsedDate.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  })
}

export function EmployeeStaffAssignmentsPanel({
  organizationId,
  staffId,
}: {
  organizationId: string | null
  staffId: string
}) {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [assignments, setAssignments] = useState<StaffAssignment[]>([])
  const [programs, setPrograms] = useState<Program[]>([])
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [newAssignment, setNewAssignment] = useState({
    program_id: "",
    role: "instructor" as AssignmentRole,
    start_date: "",
    end_date: "",
    start_time: "",
    end_time: "",
    notes: "",
  })

  const timeOptions = useMemo(() => {
    const options: string[] = []
    for (let hour = 7; hour <= 23; hour += 1) {
      for (const minute of [0, 30]) {
        const hour12 = hour > 12 ? hour - 12 : hour
        const period = hour >= 12 ? "PM" : "AM"
        options.push(`${hour12}:${minute === 0 ? "00" : "30"} ${period}`)
      }
    }
    return options
  }, [])

  async function fetchData() {
    if (!organizationId) {
      setAssignments([])
      setPrograms([])
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const [assignmentsResult, programsResult] = await Promise.all([
        supabase
          .from("staff_assignments")
          .select(`
            id,
            staff_id,
            program_id,
            role,
            start_date,
            end_date,
            schedule,
            program:program_id (name)
          `)
          .eq("organization_id", organizationId)
          .eq("staff_id", staffId),
        supabase
          .from("programs")
          .select("id, name")
          .eq("organization_id", organizationId)
          .order("name"),
      ])

      if (assignmentsResult.error) throw assignmentsResult.error
      if (programsResult.error) throw programsResult.error

      setAssignments(
        (assignmentsResult.data || []).map((item: any) => ({
          id: item.id,
          staff_id: item.staff_id,
          program_id: item.program_id,
          role: item.role || "instructor",
          start_date: item.start_date,
          end_date: item.end_date,
          schedule: item.schedule,
          program_name: item.program?.name || "Unknown Program",
        }))
      )
      setPrograms((programsResult.data || []) as Program[])
    } catch (error) {
      console.error("Load employee assignments error:", error)
      setAssignments([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, staffId])

  async function handleAddAssignment() {
    if (!organizationId || !newAssignment.program_id) return

    const { error } = await supabase.from("staff_assignments").insert({
      organization_id: organizationId,
      staff_id: staffId,
      program_id: newAssignment.program_id,
      role: newAssignment.role,
      start_date: newAssignment.start_date || null,
      end_date: newAssignment.end_date || null,
      schedule:
        newAssignment.start_date && newAssignment.start_time && newAssignment.end_time
          ? `${newAssignment.start_date} ${newAssignment.start_time} - ${newAssignment.end_time}`
          : null,
      notes: newAssignment.notes || null,
    })

    if (error) {
      console.error("Add assignment error:", error)
      alert(error.message)
      return
    }

    setNewAssignment({
      program_id: "",
      role: "instructor",
      start_date: "",
      end_date: "",
      start_time: "",
      end_time: "",
      notes: "",
    })
    setIsAddOpen(false)
    await fetchData()
  }

  async function handleDeleteAssignment(id: string) {
    const confirmed = window.confirm("Remove this assignment?")
    if (!confirmed) return

    const { error } = await supabase.from("staff_assignments").delete().eq("id", id)
    if (error) {
      console.error("Delete assignment error:", error)
      alert(error.message)
      return
    }
    await fetchData()
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle>Assignments</CardTitle>
          <CardDescription>
            Program assignments for instructors, assistants, volunteers, and child care staff.
          </CardDescription>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <UserPlus className="mr-2 size-4" />
              Add Assignment
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add Assignment</DialogTitle>
              <DialogDescription>Assign this employee to a program.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Program</Label>
                <Select
                  value={newAssignment.program_id}
                  onValueChange={(value) =>
                    setNewAssignment({ ...newAssignment, program_id: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select program" />
                  </SelectTrigger>
                  <SelectContent>
                    {programs.map((program) => (
                      <SelectItem key={program.id} value={program.id}>
                        {program.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select
                  value={newAssignment.role}
                  onValueChange={(value) =>
                    setNewAssignment({ ...newAssignment, role: value as AssignmentRole })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="instructor">Instructor</SelectItem>
                    <SelectItem value="assistant">Assistant</SelectItem>
                    <SelectItem value="volunteer">Volunteer</SelectItem>
                    <SelectItem value="childcare">Child Care</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>
                    Start Date<span className="text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    <Calendar className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="date"
                      className="h-10 pl-9"
                      value={newAssignment.start_date}
                      onChange={(event) =>
                        setNewAssignment({ ...newAssignment, start_date: event.target.value })
                      }
                    />
                  </div>
                  {newAssignment.start_date && (
                    <p className="text-xs text-muted-foreground">
                      {formatAssignmentDate(newAssignment.start_date)}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <div className="relative">
                    <Calendar className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      type="date"
                      className="h-10 pl-9"
                      value={newAssignment.end_date}
                      onChange={(event) =>
                        setNewAssignment({ ...newAssignment, end_date: event.target.value })
                      }
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label>
                  Time<span className="text-red-500">*</span>
                </Label>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Select
                    value={newAssignment.start_time}
                    onValueChange={(value) =>
                      setNewAssignment({ ...newAssignment, start_time: value })
                    }
                  >
                    <SelectTrigger className="h-10 w-full">
                      <SelectValue placeholder="From 7:00 AM" />
                    </SelectTrigger>
                    <SelectContent>
                      <ScrollArea className="h-60">
                        {timeOptions.map((time) => (
                          <SelectItem key={time} value={time}>
                            {time}
                          </SelectItem>
                        ))}
                      </ScrollArea>
                    </SelectContent>
                  </Select>
                  <Select
                    value={newAssignment.end_time}
                    onValueChange={(value) =>
                      setNewAssignment({ ...newAssignment, end_time: value })
                    }
                  >
                    <SelectTrigger className="h-10 w-full">
                      <SelectValue placeholder="to 7:30 AM" />
                    </SelectTrigger>
                    <SelectContent>
                      <ScrollArea className="h-60">
                        {timeOptions.map((time) => (
                          <SelectItem key={time} value={time}>
                            {time}
                          </SelectItem>
                        ))}
                      </ScrollArea>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddAssignment}>Add Assignment</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Role</TableHead>
              <TableHead>Program</TableHead>
              <TableHead>Schedule</TableHead>
              <TableHead>Dates</TableHead>
              <TableHead className="w-[80px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  Loading assignments...
                </TableCell>
              </TableRow>
            ) : assignments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  No assignments yet.
                </TableCell>
              </TableRow>
            ) : (
              assignments.map((assignment) => (
                <TableRow key={assignment.id}>
                  <TableCell>{getAssignmentRoleBadge(assignment.role)}</TableCell>
                  <TableCell>{assignment.program_name}</TableCell>
                  <TableCell>{assignment.schedule || "-"}</TableCell>
                  <TableCell>
                    {assignment.start_date || "-"}
                    {assignment.end_date ? ` - ${assignment.end_date}` : ""}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem disabled>
                          <Pencil className="mr-2 size-4" />
                          Edit Later
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={() => handleDeleteAssignment(assignment.id)}
                        >
                          <Trash2 className="mr-2 size-4" />
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
      </CardContent>
    </Card>
  )
}
