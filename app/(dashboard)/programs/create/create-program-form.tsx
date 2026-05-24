"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, CalendarIcon, Check, ChevronDown } from "lucide-react"

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
import { createProgram } from "@/lib/programs/program-actions"
import type { Department } from "@/lib/departments/department-types"

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

const AGES = Array.from({ length: 19 }, (_, index) => index.toString())

export function CreateProgramForm({
  departments,
}: {
  departments: Department[]
}) {
  const router = useRouter()

  const [isSaving, setIsSaving] = React.useState(false)
  const [gradeLevels, setGradeLevels] = React.useState<string[]>([])
  const [gradeDropdownOpen, setGradeDropdownOpen] = React.useState(false)

  function toggleGradeLevel(value: string) {
    setGradeLevels((current) =>
      current.includes(value)
        ? current.filter((grade) => grade !== value)
        : [...current, value]
    )
  }

  function toggleAllGrades() {
    setGradeLevels((current) =>
      current.length === GRADE_LEVELS.length ? [] : GRADE_LEVELS
    )
  }

  function getGradeLabel() {
    if (gradeLevels.length === 0) return "Select grade levels..."
    if (gradeLevels.length === GRADE_LEVELS.length) return "All grades"
    if (gradeLevels.length <= 2) return gradeLevels.join(", ")
    return `${gradeLevels.length} grades selected`
  }

  async function handleSubmit(formData: FormData) {
    setIsSaving(true)

    const minAge = String(formData.get("min_age") || "")
    const maxAge = String(formData.get("max_age") || "")

    const ageGroups =
      minAge && maxAge
        ? [`${minAge}-${maxAge} years`]
        : minAge
          ? [`${minAge}+ years`]
          : maxAge
            ? [`Up to ${maxAge} years`]
            : []

    await createProgram({
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

    router.push("/programs")
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="border-b bg-background/95">
        <div className="flex h-14 items-center gap-4 px-6">
          <Link
            href="/programs"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Programs
          </Link>

          <div className="ml-auto">
            <Badge variant="secondary">New Program</Badge>
          </div>
        </div>
      </div>

      <form action={handleSubmit} className="px-6 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">
            Create Program
          </h1>
          <p className="mt-1 text-muted-foreground">
            Set up a new program, class, camp, or activity.
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

  <CardContent className="space-y-5">
    <div className="grid gap-4 md:grid-cols-3">
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="name">Program Name *</Label>
        <Input
          id="name"
          name="name"
          required
          placeholder="Summer Adventure Camp"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="department_id">Department</Label>
        <select
          id="department_id"
          name="department_id"
          defaultValue=""
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
    </div>

    {departments.length === 0 && (
      <p className="text-xs text-muted-foreground">
        No departments found. Add departments in Settings first.
      </p>
    )}

    <div className="space-y-2">
      <Label htmlFor="description">Description</Label>
      <Textarea
        id="description"
        name="description"
        rows={4}
        placeholder="Describe what participants will experience..."
      />
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

            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="space-y-2">
                  <Label htmlFor="start_date">Start Date</Label>
                  <div className="relative">
                    <CalendarIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="start_date"
                      name="start_date"
                      type="date"
                      className="pl-9"
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
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="enrollment_open_date">
                    Enrollment Open Date
                  </Label>
                  <Input
                    id="enrollment_open_date"
                    name="enrollment_open_date"
                    type="date"
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

            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="space-y-2">
                  <Label htmlFor="min_age">Minimum Age</Label>
                  <select
                    id="min_age"
                    name="min_age"
                    defaultValue=""
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  >
                    <option value="">No minimum</option>
                    {AGES.map((age) => (
                      <option key={age} value={age}>
                        {age}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="max_age">Maximum Age</Label>
                  <select
                    id="max_age"
                    name="max_age"
                    defaultValue=""
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  >
                    <option value="">No maximum</option>
                    {AGES.map((age) => (
                      <option key={age} value={age}>
                        {age}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="relative space-y-2">
                  <Label>Grade Levels</Label>

                  <button
                    type="button"
                    onClick={() => setGradeDropdownOpen((open) => !open)}
                    className="flex h-10 w-full items-center justify-between rounded-md border bg-background px-3 text-left text-sm"
                  >
                    <span className="truncate">{getGradeLabel()}</span>
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  </button>

                  {gradeDropdownOpen && (
  <>
    <button
      type="button"
      className="fixed inset-0 z-10 cursor-default"
      onClick={() => setGradeDropdownOpen(false)}
      aria-label="Close grade levels menu"
    />

    <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-md border bg-background p-2 shadow-md">
                      <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted">
                        <input
                          type="checkbox"
                          checked={gradeLevels.length === GRADE_LEVELS.length}
                          onChange={toggleAllGrades}
                        />
                        <span className="font-medium">Select All</span>
                      </label>

                      <div className="my-1 border-t" />

                      {GRADE_LEVELS.map((grade) => (
                        <label
                          key={grade}
                          className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted"
                        >
                          <input
                            type="checkbox"
                            checked={gradeLevels.includes(grade)}
                            onChange={() => toggleGradeLevel(grade)}
                          />
                          <span>{grade}</span>
                          {gradeLevels.includes(grade) && (
                            <Check className="ml-auto h-3 w-3" />
                          )}
                        </label>
                      ))}
                    </div>
                  </>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="gender">Gender</Label>
                  <select
                    id="gender"
                    name="gender"
                    defaultValue="All"
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  >
                    <option value="All">All Genders</option>
                    <option value="Male">Male Only</option>
                    <option value="Female">Female Only</option>
                  </select>
                </div>
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

            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="space-y-2">
                  <Label htmlFor="capacity">Capacity</Label>
                  <Input
                    id="capacity"
                    name="capacity"
                    type="number"
                    min="0"
                    placeholder="50"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <select
                    id="status"
                    name="status"
                    defaultValue="draft"
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  >
                    <option value="draft">Draft</option>
                    <option value="active">Active</option>
                    <option value="paused">Paused</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95">
          <div className="flex h-16 items-center justify-end gap-3 px-6">
            <Button variant="outline" asChild>
              <Link href="/programs">Cancel</Link>
            </Button>

            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Saving..." : "Create Program"}
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
}