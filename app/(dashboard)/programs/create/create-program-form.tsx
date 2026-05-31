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
import { GradeLevelsMultiSelect } from "@/components/programs/grade-levels-multi-select"
import { ProgramCapacityGroupEditor } from "@/components/programs/program-capacity-group-editor"
import { RegistrationTypeSelector } from "@/components/programs/registration-type-selector"
import { createProgram } from "@/lib/programs/program-actions"
import { replaceProgramCapacityGroups } from "@/lib/programs/program-capacity-group-actions"
import type { ProgramCapacityGroupInput } from "@/lib/programs/program-capacity-group-types"
import type { Department } from "@/lib/departments/department-types"

type ProgramType = "adult" | "youth" | "family"

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
  const [programType, setProgramType] = React.useState<ProgramType>("youth")
  const [gradeLevels, setGradeLevels] = React.useState<string[]>([])
  const [programGender, setProgramGender] = React.useState<
    "All" | "Male" | "Female"
  >("All")
  const [capacityGroups, setCapacityGroups] = React.useState<
    ProgramCapacityGroupInput[]
  >([])
  const [totalCapacity, setTotalCapacity] = React.useState(0)
  const [fullProgramRegistrationEnabled, setFullProgramRegistrationEnabled] =
    React.useState(true)
  const [sessionRegistrationEnabled, setSessionRegistrationEnabled] =
    React.useState(false)

  const showGradeFields = programType !== "adult"

  function handleProgramTypeChange(value: ProgramType) {
    setProgramType(value)

    if (value === "adult") {
      setGradeLevels([])
      setCapacityGroups([])
    }
  }

  async function handleSubmit(formData: FormData) {
    setIsSaving(true)

    const minAge = getNumberOrNull(formData.get("min_age"))
    const maxAge = getNumberOrNull(formData.get("max_age"))

    const programId = await createProgram({
      name: String(formData.get("name") || ""),
      description: String(formData.get("description") || ""),
      department_id: String(formData.get("department_id") || "") || null,
      program_type: programType,
      start_date: String(formData.get("start_date") || "") || null,
      end_date: String(formData.get("end_date") || "") || null,
      enrollment_open_date:
        String(formData.get("enrollment_open_date") || "") || null,
      enrollment_close_date:
        String(formData.get("enrollment_close_date") || "") || null,
      min_age: minAge,
      max_age: maxAge,
      grade_levels: programType === "adult" ? [] : gradeLevels,
      gender: String(formData.get("gender") || "All"),
      full_program_registration_enabled: fullProgramRegistrationEnabled,
      session_registration_enabled: sessionRegistrationEnabled,
      capacity: totalCapacity,
      status: String(formData.get("status") || "draft"),
    })

    if (capacityGroups.length > 0 && programType !== "adult") {
      await replaceProgramCapacityGroups({
        program_id: programId,
        groups: capacityGroups.filter(
          (group) =>
            (group.grade_levels.length > 0 || group.genders.length > 0) &&
            Number(group.capacity) >= 0
        ),
      })
    }

    router.push(`/programs/${programId}`)
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

            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="name">Program Name *</Label>
                  <Input
                    id="name"
                    name="name"
                    required
                    placeholder="Summer Adventure Camp"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="program_type">Program Type</Label>
                  <select
                    id="program_type"
                    name="program_type"
                    value={programType}
                    onChange={(event) =>
                      handleProgramTypeChange(event.target.value as ProgramType)
                    }
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  >
                    <option value="adult">Adult</option>
                    <option value="youth">Youth</option>
                    <option value="family">Family</option>
                  </select>
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

            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
                  <Label>Grade Levels</Label>
                  {showGradeFields ? (
                    <GradeLevelsMultiSelect
                      selectedGrades={gradeLevels}
                      onChange={setGradeLevels}
                    />
                  ) : (
                    <div className="flex h-10 items-center rounded-md border bg-muted/40 px-3 text-sm text-muted-foreground">
                      Hidden for adult programs
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="gender">Gender</Label>
                  <select
                    id="gender"
                    name="gender"
                    value={programGender}
                    onChange={(event) =>
                      setProgramGender(
                        event.target.value as "All" | "Male" | "Female"
                      )
                    }
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

            <CardContent className="space-y-6">
              {showGradeFields ? (
                <ProgramCapacityGroupEditor
                  selectedGrades={gradeLevels}
                  programGender={programGender}
                  groups={capacityGroups}
                  onChange={setCapacityGroups}
                  totalCapacity={totalCapacity}
                  onTotalCapacityChange={setTotalCapacity}
                />
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-2">
                    <Label htmlFor="capacity">Capacity</Label>
                    <Input
                      id="capacity"
                      type="number"
                      min="0"
                      value={totalCapacity}
                      onChange={(event) =>
                        setTotalCapacity(Number(event.target.value || 0))
                      }
                      placeholder="50"
                    />
                  </div>
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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

          <Card>
            <CardHeader>
              <CardTitle>Registration Type</CardTitle>
              <CardDescription>
                Choose how customers can register. You can enable one or both
                options.
              </CardDescription>
            </CardHeader>

            <CardContent>
              <RegistrationTypeSelector
                fullProgramEnabled={fullProgramRegistrationEnabled}
                sessionRegistrationEnabled={sessionRegistrationEnabled}
                onFullProgramChange={setFullProgramRegistrationEnabled}
                onSessionChange={setSessionRegistrationEnabled}
              />
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
