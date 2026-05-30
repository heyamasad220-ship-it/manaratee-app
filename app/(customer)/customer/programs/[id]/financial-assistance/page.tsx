import { redirect, notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

type PageProps = {
  params: {
    id: string
  }
  searchParams?: {
    submitted?: string
  }
}

async function submitFinancialAssistanceApplication(formData: FormData) {
  "use server"

  const supabase = await createClient()

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    redirect("/login")
  }

  const programId = String(formData.get("program_id") || "")
  const organizationId = String(formData.get("organization_id") || "")

  const applicantType = String(formData.get("applicant_type") || "parent_guardian")
  const applicantFirstName = String(formData.get("applicant_first_name") || "")
  const applicantLastName = String(formData.get("applicant_last_name") || "")
  const applicantEmail = String(formData.get("applicant_email") || "")
  const applicantPhone = String(formData.get("applicant_phone") || "")

  const childFirstName = String(formData.get("child_first_name") || "")
  const childLastName = String(formData.get("child_last_name") || "")
  const childAge = String(formData.get("child_age") || "")
  const childGrade = String(formData.get("child_grade") || "")

  const financialAssistanceType = String(formData.get("financial_assistance_type") || "")
  const householdSizeRaw = String(formData.get("household_size") || "")
  const incomeRaw = String(formData.get("annual_household_income") || "")
  const requestedAmountRaw = String(formData.get("requested_amount") || "")
  const reasonForRequest = String(formData.get("reason_for_request") || "")

  const volunteerInterest = formData.get("volunteer_interest") === "yes"
  const volunteerNotes = String(formData.get("volunteer_notes") || "")

  const proofFile = formData.get("proof_of_income")

  const householdSize = householdSizeRaw ? Number(householdSizeRaw) : null
  const annualHouseholdIncome = incomeRaw ? Number(incomeRaw) : null
  const requestedAmount = requestedAmountRaw ? Number(requestedAmountRaw) : null

  if (!programId || !organizationId) {
    throw new Error("Missing program or organization.")
  }

  if (!applicantFirstName || !applicantLastName || !applicantEmail) {
    throw new Error("Applicant first name, last name, and email are required.")
  }

  const { data: program, error: programError } = await supabase
    .from("programs")
    .select(
      "id, organization_id, financial_assistance_enabled, financial_assistance_open, financial_assistance_close_date"
    )
    .eq("id", programId)
    .eq("organization_id", organizationId)
    .single()

  if (programError || !program) {
    throw new Error("Program was not found.")
  }

  if (!program.financial_assistance_enabled || !program.financial_assistance_open) {
    throw new Error("Financial assistance is not open for this program.")
  }

  if (program.financial_assistance_close_date) {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const closeDate = new Date(program.financial_assistance_close_date)
    closeDate.setHours(23, 59, 59, 999)

    if (closeDate < today) {
      throw new Error("Financial assistance applications are closed for this program.")
    }
  }

  const { data: application, error: insertError } = await supabase
    .from("program_financial_assistance")
    .insert({
      organization_id: organizationId,
      program_id: programId,
      submitted_by: user.id,

      applicant_type: applicantType,
      applicant_first_name: applicantFirstName,
      applicant_last_name: applicantLastName,
      applicant_email: applicantEmail,
      applicant_phone: applicantPhone || null,

      child_first_name: childFirstName || null,
      child_last_name: childLastName || null,
      child_age: childAge || null,
      child_grade: childGrade || null,

      financial_assistance_type: financialAssistanceType || null,
      household_size: householdSize,
      annual_household_income: annualHouseholdIncome,
      requested_amount: requestedAmount,
      reason_for_request: reasonForRequest || null,

      volunteer_interest: volunteerInterest,
      volunteer_notes: volunteerNotes || null,

      status: "submitted",
      answers: {},
      submitted_at: new Date().toISOString(),
    })
    .select("id")
    .single()

  if (insertError || !application) {
    throw new Error(insertError?.message || "Could not submit application.")
  }

  await supabase.from("program_financial_assistance_status_history").insert({
    application_id: application.id,
    old_status: null,
    new_status: "submitted",
    changed_by: user.id,
    note: "Application submitted by customer.",
  })

  if (proofFile instanceof File && proofFile.size > 0) {
    const safeFileName = proofFile.name.replace(/[^a-zA-Z0-9.\-_]/g, "-")
    const filePath = `${organizationId}/${programId}/${application.id}/${Date.now()}-${safeFileName}`

    const { error: uploadError } = await supabase.storage
      .from("program-financial-assistance-documents")
      .upload(filePath, proofFile, {
        cacheControl: "3600",
        upsert: false,
      })

    if (uploadError) {
      throw new Error(uploadError.message)
    }

    await supabase.from("program_financial_assistance_documents").insert({
      application_id: application.id,
      organization_id: organizationId,
      program_id: programId,
      uploaded_by: user.id,
      file_name: proofFile.name,
      file_path: filePath,
      file_type: proofFile.type || null,
      file_size: proofFile.size,
    })
  }

  redirect(`/customer/programs/${programId}/financial-assistance?submitted=1`)
}

export default async function FinancialAssistancePage({
  params,
  searchParams,
}: PageProps) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const { data: program, error } = await supabase
    .from("programs")
    .select(
      `
      id,
      organization_id,
      name,
      title,
      financial_assistance_enabled,
      financial_assistance_open,
      financial_assistance_close_date,
      financial_assistance_instructions
    `
    )
    .eq("id", params.id)
    .single()

  if (error || !program) {
    notFound()
  }

  const programName = program.name || program.title || "Program"

  const isClosedByDate =
    program.financial_assistance_close_date &&
    new Date(program.financial_assistance_close_date) < new Date()

  const canApply =
    program.financial_assistance_enabled &&
    program.financial_assistance_open &&
    !isClosedByDate

  if (searchParams?.submitted === "1") {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <Card>
          <CardHeader>
            <CardTitle>Application submitted</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Your financial assistance application for {programName} has been submitted.
            </p>

            <Button asChild>
              <a href={`/customer/programs/${program.id}`}>Back to program</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Financial Assistance Application</h1>
        <p className="mt-2 text-muted-foreground">{programName}</p>
      </div>

      {!canApply ? (
        <Card>
          <CardHeader>
            <CardTitle>Applications are not open</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Financial assistance applications are currently closed for this program.
            </p>
          </CardContent>
        </Card>
      ) : (
        <form action={submitFinancialAssistanceApplication} className="space-y-6">
          <input type="hidden" name="program_id" value={program.id} />
          <input type="hidden" name="organization_id" value={program.organization_id} />

          {program.financial_assistance_instructions ? (
            <Card>
              <CardHeader>
                <CardTitle>Instructions</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-muted-foreground">
                  {program.financial_assistance_instructions}
                </p>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Applicant Information</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="applicant_type">I am applying as</Label>
                <select
                  id="applicant_type"
                  name="applicant_type"
                  className="h-10 rounded-md border bg-background px-3"
                  defaultValue="parent_guardian"
                >
                  <option value="parent_guardian">Parent / Guardian</option>
                  <option value="adult">Adult applicant</option>
                </select>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="applicant_first_name">First name</Label>
                  <Input id="applicant_first_name" name="applicant_first_name" required />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="applicant_last_name">Last name</Label>
                  <Input id="applicant_last_name" name="applicant_last_name" required />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="applicant_email">Email</Label>
                  <Input
                    id="applicant_email"
                    name="applicant_email"
                    type="email"
                    required
                    defaultValue={user.email || ""}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="applicant_phone">Phone</Label>
                  <Input id="applicant_phone" name="applicant_phone" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Child Information</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <p className="text-sm text-muted-foreground">
                Complete this section if you are applying for a child.
              </p>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="child_first_name">Child first name</Label>
                  <Input id="child_first_name" name="child_first_name" />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="child_last_name">Child last name</Label>
                  <Input id="child_last_name" name="child_last_name" />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="child_age">Child age</Label>
                  <Input id="child_age" name="child_age" />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="child_grade">Child grade</Label>
                  <Input id="child_grade" name="child_grade" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Household and Financial Information</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="financial_assistance_type">
                  Type of assistance requested
                </Label>
                <select
                  id="financial_assistance_type"
                  name="financial_assistance_type"
                  className="h-10 rounded-md border bg-background px-3"
                >
                  <option value="">Select one</option>
                  <option value="partial_discount">Partial discount</option>
                  <option value="full_discount">Full discount</option>
                  <option value="payment_plan">Payment plan</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="grid gap-2">
                  <Label htmlFor="household_size">Household size</Label>
                  <Input
                    id="household_size"
                    name="household_size"
                    type="number"
                    min="1"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="annual_household_income">
                    Annual household income
                  </Label>
                  <Input
                    id="annual_household_income"
                    name="annual_household_income"
                    type="number"
                    min="0"
                    step="0.01"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="requested_amount">Requested amount</Label>
                  <Input
                    id="requested_amount"
                    name="requested_amount"
                    type="number"
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="reason_for_request">Reason for request</Label>
                <Textarea
                  id="reason_for_request"
                  name="reason_for_request"
                  rows={5}
                  placeholder="Please share any information that would help us review your request."
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="proof_of_income">Proof of income</Label>
                <Input
                  id="proof_of_income"
                  name="proof_of_income"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Volunteer Interest</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="volunteer_interest">
                  Are you interested in volunteering?
                </Label>
                <select
                  id="volunteer_interest"
                  name="volunteer_interest"
                  className="h-10 rounded-md border bg-background px-3"
                  defaultValue="no"
                >
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="volunteer_notes">Volunteer notes</Label>
                <Textarea
                  id="volunteer_notes"
                  name="volunteer_notes"
                  rows={3}
                  placeholder="Tell us what kind of volunteer help you may be open to."
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-3">
            <Button variant="outline" asChild>
              <a href={`/customer/programs/${program.id}`}>Cancel</a>
            </Button>

            <Button type="submit">Submit Application</Button>
          </div>
        </form>
      )}
    </div>
  )
}