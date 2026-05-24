"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, CalendarIcon, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { Department } from "@/lib/departments/department-types"
import { updateProgram } from "@/lib/programs/program-actions"
import type { Program } from "@/lib/programs/program-types"

const GRADE_LEVELS = [
  "Pre-K",
  "Kindergarten",
  "1st Grade",
  "2nd Grade",
  "3rd Grade",
  "4th Grade",
  "5th Grade",
  "6th Grade",
  "7th Grade",
  "8th Grade",
  "9th Grade",
  "10th Grade",
  "11th Grade",
  "12th Grade",
]

export function EditProgramForm({
  program,
  departments,
}: {
  program: Program
  departments: Department[]
}) {
  const router = useRouter()

  const [isSaving, setIsSaving] = React.useState(false)
  const [ageGroupInput, setAgeGroupInput] = React.useState("")
  const [ageGroups, setAgeGroups] = React.useState<string[]>(
    program.age_groups || []
  )
  const [gradeLevels, setGradeLevels] = React.useState<string[]>(
    program.grade_levels || []
  )

  function addAgeGroup() {
    const value = ageGroupInput.trim()
    if (!value || ageGroups.includes(value)) return

    setAgeGroups([...ageGroups, value])
    setAgeGroupInput("")
  }

  function removeAgeGroup(value: string) {
    setAgeGroups(ageGroups.filter((ageGroup) => ageGroup !== value))
  }

  function toggleGradeLevel(value: string) {
    setGradeLevels((current) =>
      current.includes(value)
        ? current.filter((grade) => grade !== value)
        : [...current, value]
    )
  }

  async function handleSubmit(formData: FormData) {
    setIsSaving(true)

    await updateProgram({
      id: program.id,
      name: String(formData.get("name") || ""),
      description: String(formData.get("description") || ""),
      department_id: String(formData.get("department_id") || "") || null,
      start_date: String(formData.get("start_date") || "") || null,
      end_date: String(formData.get("end_date") || "") || null,
      enrollment_open_date:
        String(formData.get("enrollment_open_date") || "") || null,
      enrollment_close_date:
        String(formData.get("enrollment_close_date") || "") || null,
      age_groups: ageGroups,
      grade_levels: gradeLevels,
      gender: String(formData.get("gender") || "All"),
      capacity: Number(formData.get("capacity") || 0),
      status: String(formData.get("status") || "draft"),
    })

    router.push(`/programs/${program.id}`)
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="border-b bg-background/95">
        <div className="flex h-14 items-center gap-4 px-6">
          <Link
            href={`/programs/${program.id}`}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Program
          </Link>

          <div className="ml-auto">
            <Badge variant="secondary">Editing</Badge>
          </div>
        </div>
      </div>

      <form action={handleSubmit} className="px-6 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">
            Edit Program
          </h1>
          <p className="mt-1 text-muted-foreground">
            Update program details, eligibility, capacity, and status.
          </p>
        </div>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Program Information</CardTitle>
              <CardDescription>
                Basic details about your program.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name">Program Name *</Label>
                <Input
                  id="name"
                  name="name"
                  required
                  defaultValue={program.name}
                  placeholder="Summer Adventure Camp"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  name="description"
                  rows={5}
                  defaultValue={program.description || ""}
                  placeholder="Describe what participants will experience..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="department_id">Department</Label>
                <select
                  id="department_id"
                  name="department_id"
                  defaultValue={program.department_id || ""}
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                >
                  <option value="">No department</option>
                  {departments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Dates</CardTitle>
              <CardDescription>
                Program dates and enrollment window.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="start_date">Start Date</Label>
                  <div className="relative">
                    <CalendarIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="start_date"
                      name="start_date"
                      type="date"
                      className="pl-9"
                      defaultValue={program.start_date || ""}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="end_date">End Date</Label>
                  <div className="relative">
                    <CalendarIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="end_date"
                      name="end_date"
                      type="date"
                      className="pl-9"
                      defaultValue={program.end_date || ""}
                    />
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="enrollment_open_date">
                    Enrollment Open Date
                  </Label>
                  <Input
                    id="enrollment_open_date"
                    name="enrollment_open_date"
                    type="date"
                    defaultValue={program.enrollment_open_date || ""}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="enrollment_close_date">
                    Enrollment Close Date
                  </Label>
                  <Input
                    id="enrollment_close_date"
                    name="enrollment_close_date"
                    type="date"
                    defaultValue={program.enrollment_close_date || ""}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Eligibility</CardTitle>
              <CardDescription>
                Define who can register for this program.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Age Groups</Label>

                <div className="flex gap-2">
                  <Input
                    value={ageGroupInput}
                    onChange={(event) => setAgeGroupInput(event.target.value)}
                    placeholder="Example: 6-12 years"
                  />
                  <Button type="button" variant="outline" onClick={addAgeGroup}>
                    Add
                  </Button>
                </div>

                {ageGroups.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-2">
                    {ageGroups.map((ageGroup) => (
                      <Badge
                        key={ageGroup}
                        variant="secondary"
                        className="gap-1"
                      >
                        {ageGroup}
                        <button
                          type="button"
                          onClick={() => removeAgeGroup(ageGroup)}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Grade Levels</Label>

                <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                  {GRADE_LEVELS.map((grade) => (
                    <label
                      key={grade}
                      className="flex items-center gap-2 rounded-md border p-3 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={gradeLevels.includes(grade)}
                        onChange={() => toggleGradeLevel(grade)}
                      />
                      {grade}
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="gender">Gender</Label>
                <select
                  id="gender"
                  name="gender"
                  defaultValue={program.gender || "All"}
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                >
                  <option value="All">All Genders</option>
                  <option value="Male">Male Only</option>
                  <option value="Female">Female Only</option>
                </select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Enrollment</CardTitle>
              <CardDescription>
                Capacity and publishing settings.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="capacity">Capacity</Label>
                <Input
                  id="capacity"
                  name="capacity"
                  type="number"
                  min="0"
                  defaultValue={program.capacity}
                  placeholder="50"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <select
                  id="status"
                  name="status"
                  defaultValue={program.status}
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                >
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95">
          <div className="flex h-16 items-center justify-end gap-3 px-6">
            <Button variant="outline" asChild>
              <Link href={`/programs/${program.id}`}>Cancel</Link>
            </Button>

            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
}