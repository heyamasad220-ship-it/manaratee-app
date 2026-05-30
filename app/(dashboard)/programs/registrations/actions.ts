"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"

type EnrollmentLookup = {
  id: string
  program_id: string | null
  status: string | null
}

type ProgramCounterLookup = {
  enrolled: number | null
  waitlist?: number | null
}

type WaitlistLookup = {
  id: string
  program_id: string | null
}

type WaitlistMoveLookup = {
  id: string
  organization_id: string | null
  program_id: string | null
  child_name: string
  child_age: number | null
  parent_name: string | null
  parent_email: string | null
  parent_phone: string | null
  preferred_weeks: string[] | null
  notes: string | null
}

type ProgramMoveLookup = {
  id: string
  department_id: string | null
  enrolled: number | null
  waitlist: number | null
  capacity: number | null
}

function refreshAndRedirect(path: string): never {
  revalidatePath("/programs/registrations")
  revalidatePath(path)
  redirect(path)
}

export async function markEnrollmentPaymentAction(formData: FormData) {
  const enrollmentId = String(formData.get("enrollment_id") || "")
  const paymentStatus = String(formData.get("payment_status") || "")
  const redirectTo = String(
    formData.get("redirect_to") || "/programs/registrations"
  )

  const allowedStatuses = ["pending", "paid", "partial", "waived", "refunded"]

  if (!enrollmentId || !allowedStatuses.includes(paymentStatus)) {
    refreshAndRedirect(redirectTo)
  }

  const supabase = await createClient()

  const updatePayload: {
    payment_status: string
    updated_at: string
    amount_paid?: number
  } = {
    payment_status: paymentStatus,
    updated_at: new Date().toISOString(),
  }

  if (paymentStatus === "paid") {
    const { data: enrollmentData, error: enrollmentError } = await supabase
      .from("program_enrollments")
      .select("total_amount")
      .eq("id", enrollmentId)
      .maybeSingle()

    if (enrollmentError) {
      throw new Error(enrollmentError.message)
    }

    const enrollment = enrollmentData as { total_amount: number | null } | null
    updatePayload.amount_paid = Number(enrollment?.total_amount || 0)
  }

  const { error } = await supabase
    .from("program_enrollments")
    .update(updatePayload)
    .eq("id", enrollmentId)

  if (error) {
    throw new Error(error.message)
  }

  refreshAndRedirect(redirectTo)
}

export async function updateEnrollmentStatusAction(formData: FormData) {
  const enrollmentId = String(formData.get("enrollment_id") || "")
  const status = String(formData.get("status") || "")
  const redirectTo = String(
    formData.get("redirect_to") || "/programs/registrations"
  )

  const allowedStatuses = [
    "enrolled",
    "active",
    "pending",
    "completed",
    "cancelled",
  ]

  if (!enrollmentId || !allowedStatuses.includes(status)) {
    refreshAndRedirect(redirectTo)
  }

  const supabase = await createClient()

  const { data: enrollmentData, error: enrollmentError } = await supabase
    .from("program_enrollments")
    .select("id, program_id, status")
    .eq("id", enrollmentId)
    .maybeSingle()

  if (enrollmentError) {
    throw new Error(enrollmentError.message)
  }

  const enrollment = enrollmentData as EnrollmentLookup | null

  if (!enrollment) {
    refreshAndRedirect(redirectTo)
  }

  const previousStatus = String(enrollment.status || "").toLowerCase()
  const nextStatus = status.toLowerCase()

  const { error } = await supabase
    .from("program_enrollments")
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", enrollmentId)

  if (error) {
    throw new Error(error.message)
  }

  const wasCounted = previousStatus !== "cancelled"
  const shouldBeCounted = nextStatus !== "cancelled"

  if (enrollment.program_id && wasCounted !== shouldBeCounted) {
    const { data: programData, error: programError } = await supabase
      .from("programs")
      .select("enrolled")
      .eq("id", enrollment.program_id)
      .maybeSingle()

    if (programError) {
      throw new Error(programError.message)
    }

    const program = programData as ProgramCounterLookup | null
    const currentEnrolled = Number(program?.enrolled || 0)

    const { error: updateProgramError } = await supabase
      .from("programs")
      .update({
        enrolled: shouldBeCounted
          ? currentEnrolled + 1
          : Math.max(currentEnrolled - 1, 0),
        updated_at: new Date().toISOString(),
      })
      .eq("id", enrollment.program_id)

    if (updateProgramError) {
      throw new Error(updateProgramError.message)
    }
  }

  refreshAndRedirect(redirectTo)
}

export async function removeWaitlistEntryAction(formData: FormData) {
  const waitlistId = String(formData.get("waitlist_id") || "")

  if (!waitlistId) {
    refreshAndRedirect("/programs/registrations")
  }

  const supabase = await createClient()

  const { data: waitlistData, error: waitlistError } = await supabase
    .from("program_waitlist")
    .select("id, program_id")
    .eq("id", waitlistId)
    .maybeSingle()

  if (waitlistError) {
    throw new Error(waitlistError.message)
  }

  const waitlistEntry = waitlistData as WaitlistLookup | null

  if (!waitlistEntry) {
    refreshAndRedirect("/programs/registrations")
  }

  const { error } = await supabase
    .from("program_waitlist")
    .delete()
    .eq("id", waitlistId)

  if (error) {
    throw new Error(error.message)
  }

  if (waitlistEntry.program_id) {
    const { data: programData, error: programError } = await supabase
      .from("programs")
      .select("waitlist")
      .eq("id", waitlistEntry.program_id)
      .maybeSingle()

    if (programError) {
      throw new Error(programError.message)
    }

    const program = programData as ProgramCounterLookup | null

    const { error: updateProgramError } = await supabase
      .from("programs")
      .update({
        waitlist: Math.max(Number(program?.waitlist || 0) - 1, 0),
        updated_at: new Date().toISOString(),
      })
      .eq("id", waitlistEntry.program_id)

    if (updateProgramError) {
      throw new Error(updateProgramError.message)
    }
  }

  revalidatePath("/programs/registrations")
  redirect("/programs/registrations")
}

export async function moveWaitlistToEnrollmentAction(formData: FormData) {
  const waitlistId = String(formData.get("waitlist_id") || "")
  const redirectTo = String(
    formData.get("redirect_to") || "/programs/registrations"
  )

  if (!waitlistId) {
    refreshAndRedirect(redirectTo)
  }

  const supabase = await createClient()

  const { data: waitlistData, error: waitlistError } = await supabase
    .from("program_waitlist")
    .select(
      `
      id,
      organization_id,
      program_id,
      child_name,
      child_age,
      parent_name,
      parent_email,
      parent_phone,
      preferred_weeks,
      notes
    `
    )
    .eq("id", waitlistId)
    .maybeSingle()

  if (waitlistError) {
    throw new Error(waitlistError.message)
  }

  const waitlistEntry = waitlistData as WaitlistMoveLookup | null

  if (!waitlistEntry || !waitlistEntry.program_id) {
    refreshAndRedirect(redirectTo)
  }

  const { data: programData, error: programError } = await supabase
    .from("programs")
    .select("id, department_id, enrolled, waitlist, capacity")
    .eq("id", waitlistEntry.program_id)
    .maybeSingle()

  if (programError) {
    throw new Error(programError.message)
  }

  const program = programData as ProgramMoveLookup | null

  if (!program) {
    refreshAndRedirect(redirectTo)
  }

  const capacity = Number(program.capacity || 0)
  const enrolled = Number(program.enrolled || 0)

  if (capacity > 0 && enrolled >= capacity) {
    refreshAndRedirect(redirectTo)
  }

  const today = new Date().toISOString().slice(0, 10)

  const { data: newEnrollmentData, error: insertError } = await supabase
    .from("program_enrollments")
    .insert({
      organization_id: waitlistEntry.organization_id,
      program_id: waitlistEntry.program_id,
      department_id: program.department_id,
      child_name: waitlistEntry.child_name,
      child_age: waitlistEntry.child_age,
      parent_name: waitlistEntry.parent_name,
      parent_email: waitlistEntry.parent_email,
      parent_phone: waitlistEntry.parent_phone,
      session_name: null,
      weeks: waitlistEntry.preferred_weeks,
      enrollment_date: today,
      status: "enrolled",
      payment_status: "pending",
      amount_paid: 0,
      total_amount: 0,
      before_care: false,
      after_care: false,
      lunch_type: null,
      notes: waitlistEntry.notes,
    })
    .select("id")
    .single()

  if (insertError) {
    throw new Error(insertError.message)
  }

  const newEnrollment = newEnrollmentData as { id: string }

  const { error: deleteError } = await supabase
    .from("program_waitlist")
    .delete()
    .eq("id", waitlistId)

  if (deleteError) {
    throw new Error(deleteError.message)
  }

  const { error: updateProgramError } = await supabase
    .from("programs")
    .update({
      enrolled: enrolled + 1,
      waitlist: Math.max(Number(program.waitlist || 0) - 1, 0),
      updated_at: new Date().toISOString(),
    })
    .eq("id", waitlistEntry.program_id)

  if (updateProgramError) {
    throw new Error(updateProgramError.message)
  }

  revalidatePath("/programs/registrations")
  revalidatePath(`/programs/registrations/waitlist/${waitlistId}`)
  redirect(`/programs/registrations/enrollment/${newEnrollment.id}`)
}
