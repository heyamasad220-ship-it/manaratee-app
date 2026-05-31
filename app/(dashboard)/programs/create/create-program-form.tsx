"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, CalendarIcon } from "lucide-react"

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

function getNumberOrNull(value: FormDataEntryValue | null) {
  const stringValue = String(value || "")
  if (!stringValue) return null
  return Number(stringValue)
}

export function CreateProgramForm({
  departments,
}: {
  departments: Department[]
}) {
  const router = useRouter()

  const [isSaving, setIsSaving] = React.useState(false)
  const [gradeLevels, setGradeLevels] = React.useState<string[]>([])
  const [registrationType, setRegistrationType] = React.useState<
    "full_program" | "sessions"
  >("full_program")

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

  async function handleSubmit(formData: FormData) {
    setIsSaving(true)

    const minAge = getNumberOrNull(formData.get("min_age"))
    const maxAge = getNumberOrNull(formData.get("max_age"))

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
      min_age: minAge,
      max_age: maxAge,
      grade_levels: gradeLevels,
      gender: String(formData.get("gender") || "All"),
      session_registration_enabled: registrationType === "sessions",
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

              {departments.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No departments found. Add departments in Settings first.
                </p>
              ) : null}

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
                Define who can register for this program. Leave fields blank to allow everyone.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
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

                <div className="space-y-2 xl:col-span-2">
                  <Label>Gender</Label>
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

              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <Label>Grade Levels</Label>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Leave all unchecked to allow all grades.
                    </p>
                  </div>

                  <Button type="button" variant="outline" size="sm" onClick={toggleAllGrades}>
                    {gradeLevels.length === GRADE_LEVELS.length
                      ? "Clear grades"
                      : "Select all grades"}
                  </Button>
                </div>

                <div className="grid gap-2 rounded-lg border bg-muted/20 p-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                  {GRADE_LEVELS.map((grade) => (
                    <label
                      key={grade}
                      className="flex cursor-pointer items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm hover:bg-muted"
                    >
                      <input
                        type="checkbox"
                        checked={gradeLevels.includes(grade)}
                        onChange={() => toggleGradeLevel(grade)}
                      />
                      <span>{grade}</span>
                    </label>
                  ))}
                </div>

                <p className="text-xs text-muted-foreground">
                  {gradeLevels.length === 0
                    ? "All grades are allowed."
                    : `${gradeLevels.length} grade${gradeLevels.length === 1 ? "" : "s"} selected.`}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Registration Type</CardTitle>
              <CardDescription>
                Choose how customers register for this program.
              </CardDescription>
            </CardHeader>

            <CardContent>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-4 hover:bg-muted/40">
                  <input
                    type="radio"
                    name="registration_type"
                    value="full_program"
                    checked={registrationType === "full_program"}
                    onChange={() => setRegistrationType("full_program")}
                    className="mt-1"
                  />
                  <div>
                    <p className="font-medium">Full Program Registration</p>
                    <p className="text-sm text-muted-foreground">
                      Customers register once for the entire program. Use this for camps or full-length classes.
                    </p>
                  </div>
                </label>

                <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-4 hover:bg-muted/40">
                  <input
                    type="radio"
                    name="registration_type"
                    value="sessions"
                    checked={registrationType === "sessions"}
                    onChange={() => setRegistrationType("sessions")}
                    className="mt-1"
                  />
                  <div>
                    <p className="font-medium">Session-Based Registration</p>
                    <p className="text-sm text-muted-foreground">
                      Customers can choose one or more sessions. Use this for programs like swimming or multi-session workshops.
                    </p>
                  </div>
                </label>
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
