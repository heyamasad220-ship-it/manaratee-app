"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  CalendarIcon,
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
import {
  getGradeRange,
  getMinMaxGradeFromLevels,
  GradeLevelsMultiSelect,
} from "@/components/programs/grade-levels-multi-select"
import { ProgramCapacityGroupEditor } from "@/components/programs/program-capacity-group-editor"
import {
  getInitialFullProgramRegistrationEnabled,
  RegistrationTypeSelector,
} from "@/components/programs/registration-type-selector"
import { ProgramRegistrationOptionsEditor } from "@/components/programs/program-registration-options-editor"
import {
  ProgramFeePlanEditor,
  type FeePlanEditorState,
} from "@/components/programs/program-fee-plan-editor"
import { ProgramSessionsEditor } from "@/components/programs/program-sessions-editor"
import type { Department } from "@/lib/departments/department-types"
import { replaceProgramCapacityGroups } from "@/lib/programs/program-capacity-group-actions"
import type { ProgramCapacityGroupInput } from "@/lib/programs/program-capacity-group-types"
import { updateProgram } from "@/lib/programs/program-actions"
import { replaceProgramFeeOptions } from "@/lib/programs/program-fee-actions"
import { saveOfferingFeePlans } from "@/lib/programs/program-fee-plan-actions"
import type {
  ProgramOfferingDiscountRule,
  ProgramOfferingFeePlan,
  ProgramOfferingFeePlanComponent,
} from "@/lib/programs/program-fee-plan-types"
import type { ProgramOffering } from "@/lib/programs/program-offering-types"
import type { InvalidFeePlanLink } from "@/lib/programs/program-fee-plan-queries"
import type { ProgramSession } from "@/lib/programs/program-session-types"
import type { ProgramRegistrationOption } from "@/lib/programs/program-registration-option-types"
import type { Program } from "@/lib/programs/program-types"

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
  full_program_registration_enabled?: boolean
  session_registration_enabled?: boolean
}

function getInitialGradeLevels(program: Program) {
  if (program.grade_levels?.length) {
    return program.grade_levels
  }

  return getGradeRange(program.min_grade || null, program.max_grade || null)
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
  capacityGroups: initialCapacityGroups,
  sessions,
  registrationOptions,
  defaultOffering,
  feePlans,
  feePlanComponents,
  feePlanDiscountRules,
  invalidFeePlanLinks,
}: {
  program: Program
  departments: Department[]
  feeOptions: ProgramFeeOption[]
  capacityGroups: ProgramCapacityGroupInput[]
  sessions: ProgramSession[]
  registrationOptions: ProgramRegistrationOption[]
  defaultOffering: ProgramOffering | null
  feePlans: ProgramOfferingFeePlan[]
  feePlanComponents: ProgramOfferingFeePlanComponent[]
  feePlanDiscountRules: ProgramOfferingDiscountRule[]
  invalidFeePlanLinks: InvalidFeePlanLink[]
}) {
  const router = useRouter()
  const typedProgram = program as ProgramWithExtraFields

  const initialProgramType = (program.program_type || "youth") as ProgramType
  const initialBillingType = (program.billing_type || "free") as BillingType
  const initialVisibility = (typedProgram.visibility || "public") as VisibilityType
  const initialSessionRegistrationEnabled =
    typedProgram.session_registration_enabled || false
  const initialFullProgramRegistrationEnabled =
    getInitialFullProgramRegistrationEnabled(typedProgram)

  const [isSaving, setIsSaving] = React.useState(false)
  const [programType, setProgramType] =
    React.useState<ProgramType>(initialProgramType)
  const [billingType, setBillingType] =
    React.useState<BillingType>(initialBillingType)
  const [sessionRegistrationEnabled, setSessionRegistrationEnabled] =
    React.useState(initialSessionRegistrationEnabled)
  const [singleSessionEnabled, setSingleSessionEnabled] = React.useState(
    registrationOptions.some(
      (option) => option.option_type === "single_session" && option.is_active
    )
  )
  const [dropInEnabled, setDropInEnabled] = React.useState(
    registrationOptions.some(
      (option) => option.option_type === "drop_in" && option.is_active
    )
  )
  const [fullProgramRegistrationEnabled, setFullProgramRegistrationEnabled] =
    React.useState(initialFullProgramRegistrationEnabled)
  const [programGender, setProgramGender] = React.useState<
    "All" | "Male" | "Female"
  >((program.gender as "All" | "Male" | "Female") || "All")
  const [gradeLevels, setGradeLevels] = React.useState<string[]>(
    getInitialGradeLevels(program)
  )
  const [capacityGroups, setCapacityGroups] =
    React.useState<ProgramCapacityGroupInput[]>(
      initialCapacityGroups.map((group) => ({
        id: group.id,
        name: group.name,
        grade_levels: group.grade_levels || [],
        genders: group.genders || [],
        capacity: group.capacity,
      }))
    )
  const [totalCapacity, setTotalCapacity] = React.useState(program.capacity ?? 0)
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
  const feePlanStateRef = React.useRef<FeePlanEditorState | null>(null)
  const handleFeePlanChange = React.useCallback((state: FeePlanEditorState) => {
    feePlanStateRef.current = state
  }, [])

  const showGradeFields = programType !== "adult"

  function handleProgramTypeChange(value: ProgramType) {
    setProgramType(value)

    if (value === "adult") {
      setGradeLevels([])
      setCapacityGroups([])
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

    const finalGradeLevels =
      selectedProgramType === "adult" ? [] : gradeLevels
    const { minGrade: finalMinGrade, maxGrade: finalMaxGrade } =
      selectedProgramType === "adult"
        ? { minGrade: null, maxGrade: null }
        : getMinMaxGradeFromLevels(finalGradeLevels)
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
      require_guardian: selectedProgramType !== "adult",
      require_grade: false,
      require_emergency_contact: true,

      full_program_registration_enabled: fullProgramRegistrationEnabled,
      session_registration_enabled: sessionRegistrationEnabled,
      single_session_registration_enabled: singleSessionEnabled,
      drop_in_registration_enabled: dropInEnabled,

      capacity: totalCapacity,
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

    await replaceProgramCapacityGroups({
      program_id: program.id,
      groups:
        selectedProgramType === "adult"
          ? []
          : capacityGroups.filter(
              (group) =>
                (group.grade_levels.length > 0 || group.genders.length > 0) &&
                Number(group.capacity) >= 0
            ),
    })

    await replaceProgramFeeOptions({
      organization_id: program.organization_id,
      program_id: program.id,
      fees,
    })

    if (defaultOffering && feePlanStateRef.current) {
      await saveOfferingFeePlans({
        programId: program.id,
        offeringId: defaultOffering.id,
        plans: feePlanStateRef.current.plans,
        discountRules: feePlanStateRef.current.discountRules,
        optionFeePlanLinks: feePlanStateRef.current.optionFeePlanLinks,
      })
    }

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

            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
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

            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
                    <option value="All">All genders</option>
                    <option value="Male">Male only</option>
                    <option value="Female">Female only</option>
                  </select>
                </div>
              </div>
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

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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

            <CardContent className="space-y-4">
              <RegistrationTypeSelector
                fullProgramEnabled={fullProgramRegistrationEnabled}
                sessionRegistrationEnabled={sessionRegistrationEnabled}
                onFullProgramChange={setFullProgramRegistrationEnabled}
                onSessionChange={setSessionRegistrationEnabled}
              />

              <ProgramRegistrationOptionsEditor
                options={registrationOptions}
                singleSessionEnabled={singleSessionEnabled}
                dropInEnabled={dropInEnabled}
                onSingleSessionChange={setSingleSessionEnabled}
                onDropInChange={setDropInEnabled}
              />
            </CardContent>
          </Card>

          {defaultOffering ? (
            <>
              {invalidFeePlanLinks.length > 0 ? (
                <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                  <p className="font-medium">Invalid fee plan links</p>
                  <p className="mt-1 text-amber-900">
                    The following registration options reference fee plans that
                    are missing or inactive. Customer registration will fail until
                    fixed.
                  </p>
                  <ul className="mt-2 list-disc pl-5">
                    {invalidFeePlanLinks.map((link) => (
                      <li key={link.optionId}>
                        {link.optionName} ({link.optionType}) → {link.feePlanId}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <ProgramFeePlanEditor
              programId={program.id}
              offeringId={defaultOffering.id}
              organizationId={program.organization_id}
              plans={feePlans}
              components={feePlanComponents}
              discountRules={feePlanDiscountRules}
              registrationOptions={registrationOptions}
              onChange={handleFeePlanChange}
            />
            </>
          ) : null}

          {sessionRegistrationEnabled ? (
            <ProgramSessionsEditor
              programId={program.id}
              sessions={sessions}
            />
          ) : null}

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
