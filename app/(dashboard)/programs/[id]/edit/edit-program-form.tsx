"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  CalendarIcon,
  CheckCircle2,
  Layers,
} from "lucide-react"

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
import { replaceProgramFeeOptions } from "@/lib/programs/program-fee-actions"
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

const AGE_OPTIONS = Array.from({ length: 100 }, (_, index) => index)

type ProgramFeeOption = {
  id?: string
  organization_id: string
  program_id: string
  name: string
  description: string | null
  fee_type: "required" | "optional"
  amount: number
  is_active: boolean
  sort_order: number
}

type ProgramType = "adult" | "youth" | "family"
type BillingType =
  | "free"
  | "one_time"
  | "deposit_balance"
  | "monthly"
  | "installments"
type VisibilityType = "public" | "private" | "members_only"

type ProgramWithExtraFields = Program & {
  visibility?: VisibilityType
  session_registration_enabled?: boolean
}

function getGradeRange(minGrade: string | null, maxGrade: string | null) {
  if (!minGrade || !maxGrade) return []

  const minIndex = GRADE_LEVELS.indexOf(minGrade)
  const maxIndex = GRADE_LEVELS.indexOf(maxGrade)

  if (minIndex === -1 || maxIndex === -1) return []
  if (minIndex > maxIndex) return []

  return GRADE_LEVELS.slice(minIndex, maxIndex + 1)
}

function getAgeGroups(minAge: number | null, maxAge: number | null) {
  if (minAge === null && maxAge === null) return []
  if (minAge !== null && maxAge !== null) return [`Ages ${minAge}-${maxAge}`]
  if (minAge !== null) return [`Ages ${minAge}+`]
  if (maxAge !== null) return [`Ages up to ${maxAge}`]
  return []
}

function getNumberOrNull(value: FormDataEntryValue | null) {
  const stringValue = String(value || "")
  if (!stringValue) return null
  return Number(stringValue)
}

function getNumberOrZero(value: FormDataEntryValue | null) {
  const stringValue = String(value || "")
  if (!stringValue) return 0
  return Number(stringValue)
}

export function EditProgramForm({
  program,
  departments,
  feeOptions,
}: {
  program: Program
  departments: Department[]
  feeOptions: ProgramFeeOption[]
}) {
  const router = useRouter()
  const typedProgram = program as ProgramWithExtraFields

  const initialProgramType = (program.program_type || "youth") as ProgramType
  const initialBillingType = (program.billing_type || "free") as BillingType
  const initialVisibility = (typedProgram.visibility || "public") as VisibilityType
  const initialSessionRegistrationEnabled =
    typedProgram.session_registration_enabled || false

  const [isSaving, setIsSaving] = React.useState(false)
  const [programType, setProgramType] =
    React.useState<ProgramType>(initialProgramType)
  const [billingType, setBillingType] =
    React.useState<BillingType>(initialBillingType)
  const [sessionRegistrationEnabled, setSessionRegistrationEnabled] =
    React.useState(initialSessionRegistrationEnabled)
  const [minGrade, setMinGrade] = React.useState<string>(
    program.min_grade || ""
  )
  const [maxGrade, setMaxGrade] = React.useState<string>(
    program.max_grade || ""
  )
  const [fees, setFees] = React.useState<ProgramFeeOption[]>(
    feeOptions.length > 0
      ? feeOptions
      : [
          {
            organization_id: program.organization_id,
            program_id: program.id,
            name: "Lunch",
            description: "",
            fee_type: "optional",
            amount: 0,
            is_active: false,
            sort_order: 0,
          },
          {
            organization_id: program.organization_id,
            program_id: program.id,
            name: "Aftercare",
            description: "",
            fee_type: "optional",
            amount: 0,
            is_active: false,
            sort_order: 1,
          },
          {
            organization_id: program.organization_id,
            program_id: program.id,
            name: "Book Fee",
            description: "",
            fee_type: "required",
            amount: 0,
            is_active: false,
            sort_order: 2,
          },
          {
            organization_id: program.organization_id,
            program_id: program.id,
            name: "Materials Fee",
            description: "",
            fee_type: "required",
            amount: 0,
            is_active: false,
            sort_order: 3,
          },
        ]
  )

  const showGradeFields = programType !== "adult"
  const selectedGradeLevels = showGradeFields
    ? getGradeRange(minGrade || null, maxGrade || null)
    : []

  function handleProgramTypeChange(value: ProgramType) {
    setProgramType(value)

    if (value === "adult") {
      setMinGrade("")
      setMaxGrade("")
    }
  }

  function updateFee(
    index: number,
    field: keyof ProgramFeeOption,
    value: string | number | boolean | null
  ) {
    setFees((current) =>
      current.map((fee, feeIndex) =>
        feeIndex === index ? { ...fee, [field]: value } : fee
      )
    )
  }

  function addFee() {
    setFees((current) => [
      ...current,
      {
        organization_id: program.organization_id,
        program_id: program.id,
        name: "",
        description: "",
        fee_type: "optional",
        amount: 0,
        is_active: true,
        sort_order: current.length,
      },
    ])
  }

  function removeFee(index: number) {
    setFees((current) => current.filter((_, feeIndex) => feeIndex !== index))
  }

  async function handleSubmit(formData: FormData) {
    setIsSaving(true)

    const minAge = getNumberOrNull(formData.get("min_age"))
    const maxAge = getNumberOrNull(formData.get("max_age"))
    const selectedProgramType = String(
      formData.get("program_type") || "youth"
    ) as ProgramType
    const selectedBillingType = String(
      formData.get("billing_type") || "free"
    ) as BillingType
    const selectedVisibility = String(
      formData.get("visibility") || "public"
    ) as VisibilityType
    const selectedGender = String(formData.get("gender") || "All")

    const finalMinGrade =
      selectedProgramType === "adult" ? null : minGrade || null
    const finalMaxGrade =
      selectedProgramType === "adult" ? null : maxGrade || null
    const finalGradeLevels =
      selectedProgramType === "adult"
        ? []
        : getGradeRange(finalMinGrade, finalMaxGrade)
    const finalAgeGroups = getAgeGroups(minAge, maxAge)

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

      program_type: selectedProgramType,
      min_age: minAge,
      max_age: maxAge,
      min_grade: finalMinGrade,
      max_grade: finalMaxGrade,
      age_groups: finalAgeGroups,
      grade_levels: finalGradeLevels,
      gender: selectedGender,
      require_guardian:
        selectedProgramType === "adult"
          ? false
          : formData.get("require_guardian") === "on",
      require_grade:
        selectedProgramType === "adult"
          ? false
          : formData.get("require_grade") === "on",
      require_emergency_contact:
        formData.get("require_emergency_contact") === "on",

      session_registration_enabled:
        formData.get("session_registration_enabled") === "on",

      capacity: Number(formData.get("capacity") || 0),
      enable_waitlist: formData.get("enable_waitlist") === "on",
      waitlist_capacity: getNumberOrNull(formData.get("waitlist_capacity")),
      status: String(formData.get("status") || "draft"),
      visibility: selectedVisibility,

      billing_type: selectedBillingType,
      tuition_amount: getNumberOrZero(formData.get("tuition_amount")),
      deposit_amount: getNumberOrZero(formData.get("deposit_amount")),
      monthly_amount: getNumberOrZero(formData.get("monthly_amount")),
      installment_count: getNumberOrNull(formData.get("installment_count")),
      payment_due_day: getNumberOrNull(formData.get("payment_due_day")),

      financial_assistance_enabled:
        formData.get("financial_assistance_enabled") === "on",
      financial_assistance_open:
        formData.get("financial_assistance_open") === "on",
      financial_assistance_close_date:
        String(formData.get("financial_assistance_close_date") || "") || null,
      financial_assistance_instructions:
        String(formData.get("financial_assistance_instructions") || "") || null,
    })

    await replaceProgramFeeOptions({
      organization_id: program.organization_id,
      program_id: program.id,
      fees,
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
            Update program details, eligibility, billing, fees, and registration
            settings.
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
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
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
                Control who can register and what information is required.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              <div className="grid gap-4 lg:grid-cols-5">
                <div className="space-y-2">
                  <Label htmlFor="min_age">Minimum Age</Label>
                  <select
                    id="min_age"
                    name="min_age"
                    defaultValue={program.min_age ?? ""}
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  >
                    <option value="">No minimum</option>
                    {AGE_OPTIONS.map((age) => (
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
                    defaultValue={program.max_age ?? ""}
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  >
                    <option value="">No maximum</option>
                    {AGE_OPTIONS.map((age) => (
                      <option key={age} value={age}>
                        {age}
                      </option>
                    ))}
                  </select>
                </div>

                {showGradeFields ? (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="min_grade">Minimum Grade</Label>
                      <select
                        id="min_grade"
                        name="min_grade"
                        value={minGrade}
                        onChange={(event) => setMinGrade(event.target.value)}
                        className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                      >
                        <option value="">No minimum</option>
                        {GRADE_LEVELS.map((grade) => (
                          <option key={grade} value={grade}>
                            {grade}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="max_grade">Maximum Grade</Label>
                      <select
                        id="max_grade"
                        name="max_grade"
                        value={maxGrade}
                        onChange={(event) => setMaxGrade(event.target.value)}
                        className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                      >
                        <option value="">No maximum</option>
                        {GRADE_LEVELS.map((grade) => (
                          <option key={grade} value={grade}>
                            {grade}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                ) : (
                  <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm text-muted-foreground lg:col-span-2">
                    Grade fields are hidden for adult programs.
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="gender">Gender</Label>
                  <select
                    id="gender"
                    name="gender"
                    defaultValue={program.gender || "All"}
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  >
                    <option value="All">All genders</option>
                    <option value="Male">Male only</option>
                    <option value="Female">Female only</option>
                  </select>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <label className="flex items-start gap-3 rounded-lg border p-4">
                  <input
                    type="checkbox"
                    name="require_guardian"
                    defaultChecked={
                      programType === "adult" ? false : program.require_guardian
                    }
                    disabled={programType === "adult"}
                    className="mt-1"
                  />
                  <div>
                    <p className="font-medium">Require Guardian</p>
                    <p className="text-sm text-muted-foreground">
                      Required for youth and family programs.
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-3 rounded-lg border p-4">
                  <input
                    type="checkbox"
                    name="require_grade"
                    defaultChecked={
                      programType === "adult" ? false : program.require_grade
                    }
                    disabled={programType === "adult"}
                    className="mt-1"
                  />
                  <div>
                    <p className="font-medium">Require Grade</p>
                    <p className="text-sm text-muted-foreground">
                      Ask for participant grade during registration.
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-3 rounded-lg border p-4">
                  <input
                    type="checkbox"
                    name="require_emergency_contact"
                    defaultChecked={program.require_emergency_contact}
                    className="mt-1"
                  />
                  <div>
                    <p className="font-medium">Require Emergency Contact</p>
                    <p className="text-sm text-muted-foreground">
                      Useful for youth programs and long-running classes.
                    </p>
                  </div>
                </label>
              </div>

              {selectedGradeLevels.length > 0 ? (
                <div className="rounded-md border bg-muted/40 p-4 text-sm text-muted-foreground">
                  Grade range saved as: {selectedGradeLevels.join(", ")}
                </div>
              ) : (
                <div className="rounded-md border bg-muted/40 p-4 text-sm text-muted-foreground">
                  Empty age or grade fields mean the program is open to all for
                  that rule.
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Registration Type</CardTitle>
              <CardDescription>
                Decide whether customers register for the full program or choose
                one or more sessions.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              <input
                type="hidden"
                name="session_registration_enabled"
                value={sessionRegistrationEnabled ? "on" : ""}
              />

              <div className="grid gap-4 md:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setSessionRegistrationEnabled(false)}
                  className={`rounded-lg border p-4 text-left transition hover:bg-muted ${
                    !sessionRegistrationEnabled
                      ? "border-primary bg-primary/5"
                      : "bg-background"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`mt-0.5 rounded-full border p-1 ${
                        !sessionRegistrationEnabled
                          ? "border-primary text-primary"
                          : "text-transparent"
                      }`}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                    </div>

                    <div>
                      <p className="font-medium">Full Program Registration</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Customers register once for the entire program dates.
                        Use this for camps, full-season programs, and fixed
                        courses.
                      </p>
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setSessionRegistrationEnabled(true)}
                  className={`rounded-lg border p-4 text-left transition hover:bg-muted ${
                    sessionRegistrationEnabled
                      ? "border-primary bg-primary/5"
                      : "bg-background"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`mt-0.5 rounded-full border p-1 ${
                        sessionRegistrationEnabled
                          ? "border-primary text-primary"
                          : "text-transparent"
                      }`}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                    </div>

                    <div>
                      <p className="font-medium">Session-Based Registration</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Customers can select one or more sessions. Use this for
                        swimming lessons, workshops, and programs with separate
                        weeks or sections.
                      </p>
                    </div>
                  </div>
                </button>
              </div>

              {sessionRegistrationEnabled ? (
                <div className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
                  <div className="flex gap-3">
                    <Layers className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>
                      After saving, manage session dates, prices, and capacity
                      from the sessions section connected to this program.
                    </p>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Enrollment</CardTitle>
              <CardDescription>
                Capacity, waitlist, publishing, and visibility settings.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
                  <Label htmlFor="waitlist_capacity">Waitlist Capacity</Label>
                  <Input
                    id="waitlist_capacity"
                    name="waitlist_capacity"
                    type="number"
                    min="0"
                    defaultValue={program.waitlist_capacity ?? ""}
                    placeholder="Optional"
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

                <div className="space-y-2">
                  <Label htmlFor="visibility">Visibility</Label>
                  <select
                    id="visibility"
                    name="visibility"
                    defaultValue={initialVisibility}
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                  >
                    <option value="public">Public</option>
                    <option value="members_only">Members Only</option>
                    <option value="private">Private</option>
                  </select>
                </div>
              </div>

              <label className="flex items-start gap-3 rounded-lg border p-4">
                <input
                  type="checkbox"
                  name="enable_waitlist"
                  defaultChecked={program.enable_waitlist}
                  className="mt-1"
                />
                <div>
                  <p className="font-medium">Enable Waitlist</p>
                  <p className="text-sm text-muted-foreground">
                    When the program reaches capacity, customers can join the
                    waitlist if this is enabled.
                  </p>
                </div>
              </label>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Billing</CardTitle>
              <CardDescription>
                Configure how customers pay for this program.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="billing_type">Billing Type</Label>
                <select
                  id="billing_type"
                  name="billing_type"
                  value={billingType}
                  onChange={(event) =>
                    setBillingType(event.target.value as BillingType)
                  }
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                >
                  <option value="free">Free</option>
                  <option value="one_time">One-Time Payment</option>
                  <option value="deposit_balance">Deposit + Balance</option>
                  <option value="monthly">Monthly</option>
                  <option value="installments">Installments</option>
                </select>
              </div>

              {billingType === "free" ? (
                <div className="rounded-md border bg-muted/40 p-4 text-sm text-muted-foreground">
                  This program does not require payment at registration.
                </div>
              ) : null}

              {billingType === "one_time" ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="tuition_amount">Tuition Amount</Label>
                    <Input
                      id="tuition_amount"
                      name="tuition_amount"
                      type="number"
                      min="0"
                      step="0.01"
                      defaultValue={program.tuition_amount || 0}
                    />
                  </div>
                </div>
              ) : null}

              {billingType === "deposit_balance" ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="tuition_amount">Total Tuition</Label>
                    <Input
                      id="tuition_amount"
                      name="tuition_amount"
                      type="number"
                      min="0"
                      step="0.01"
                      defaultValue={program.tuition_amount || 0}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="deposit_amount">Deposit Amount</Label>
                    <Input
                      id="deposit_amount"
                      name="deposit_amount"
                      type="number"
                      min="0"
                      step="0.01"
                      defaultValue={program.deposit_amount || 0}
                    />
                  </div>
                </div>
              ) : null}

              {billingType === "monthly" ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="monthly_amount">Monthly Amount</Label>
                    <Input
                      id="monthly_amount"
                      name="monthly_amount"
                      type="number"
                      min="0"
                      step="0.01"
                      defaultValue={program.monthly_amount || 0}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="payment_due_day">Payment Due Day</Label>
                    <Input
                      id="payment_due_day"
                      name="payment_due_day"
                      type="number"
                      min="1"
                      max="31"
                      defaultValue={program.payment_due_day ?? ""}
                      placeholder="Example: 1"
                    />
                  </div>
                </div>
              ) : null}

              {billingType === "installments" ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="tuition_amount">Total Tuition</Label>
                    <Input
                      id="tuition_amount"
                      name="tuition_amount"
                      type="number"
                      min="0"
                      step="0.01"
                      defaultValue={program.tuition_amount || 0}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="installment_count">
                      Installment Count
                    </Label>
                    <Input
                      id="installment_count"
                      name="installment_count"
                      type="number"
                      min="1"
                      defaultValue={program.installment_count ?? ""}
                      placeholder="Example: 4"
                    />
                  </div>
                </div>
              ) : null}

              {billingType !== "one_time" ? (
                <input
                  type="hidden"
                  name="tuition_amount"
                  value={program.tuition_amount || 0}
                />
              ) : null}
              {billingType !== "deposit_balance" ? (
                <input
                  type="hidden"
                  name="deposit_amount"
                  value={program.deposit_amount || 0}
                />
              ) : null}
              {billingType !== "monthly" ? (
                <input
                  type="hidden"
                  name="monthly_amount"
                  value={program.monthly_amount || 0}
                />
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Program Fees</CardTitle>
              <CardDescription>
                Add optional or required fees such as lunch, aftercare, books,
                or materials.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
              {fees.map((fee, index) => (
                <div key={index} className="space-y-4 rounded-lg border p-4">
                  <div className="flex items-center justify-between gap-3">
                    <label className="flex items-center gap-2 text-sm font-medium">
                      <input
                        type="checkbox"
                        checked={fee.is_active}
                        onChange={(event) =>
                          updateFee(index, "is_active", event.target.checked)
                        }
                      />
                      Active
                    </label>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removeFee(index)}
                    >
                      Remove
                    </Button>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <Label>Fee Name</Label>
                      <Input
                        value={fee.name}
                        onChange={(event) =>
                          updateFee(index, "name", event.target.value)
                        }
                        placeholder="Lunch"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Fee Type</Label>
                      <select
                        value={fee.fee_type}
                        onChange={(event) =>
                          updateFee(
                            index,
                            "fee_type",
                            event.target.value as "required" | "optional"
                          )
                        }
                        className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                      >
                        <option value="optional">Optional</option>
                        <option value="required">Required</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <Label>Amount</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={fee.amount}
                        onChange={(event) =>
                          updateFee(
                            index,
                            "amount",
                            Number(event.target.value || 0)
                          )
                        }
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Input
                      value={fee.description || ""}
                      onChange={(event) =>
                        updateFee(index, "description", event.target.value)
                      }
                      placeholder="Optional description shown during registration"
                    />
                  </div>
                </div>
              ))}

              <Button type="button" variant="outline" onClick={addFee}>
                Add Fee
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Financial Assistance</CardTitle>
              <CardDescription>
                Control whether customers can apply for financial assistance
                during registration.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6">
              <label className="flex items-start gap-3 rounded-lg border p-4">
                <input
                  type="checkbox"
                  name="financial_assistance_enabled"
                  defaultChecked={program.financial_assistance_enabled || false}
                  className="mt-1"
                />

                <div>
                  <p className="font-medium">Enable financial assistance</p>

                  <p className="text-sm text-muted-foreground">
                    Customers can apply for scholarships or payment assistance
                    for this program.
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-3 rounded-lg border p-4">
                <input
                  type="checkbox"
                  name="financial_assistance_open"
                  defaultChecked={program.financial_assistance_open || false}
                  className="mt-1"
                />

                <div>
                  <p className="font-medium">Open applications</p>

                  <p className="text-sm text-muted-foreground">
                    Turn this off when applications are closed.
                  </p>
                </div>
              </label>

              <div className="space-y-2">
                <Label htmlFor="financial_assistance_close_date">
                  Application Close Date
                </Label>

                <Input
                  id="financial_assistance_close_date"
                  name="financial_assistance_close_date"
                  type="date"
                  defaultValue={program.financial_assistance_close_date || ""}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="financial_assistance_instructions">
                  Customer Instructions
                </Label>

                <Textarea
                  id="financial_assistance_instructions"
                  name="financial_assistance_instructions"
                  rows={5}
                  defaultValue={program.financial_assistance_instructions || ""}
                  placeholder="Explain requirements, deadlines, proof of income expectations, etc."
                />
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
