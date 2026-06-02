"use server"

import { createClient } from "@/lib/supabase/server"
import type { LifecycleRpcResult } from "@/lib/programs/program-lifecycle-types"

function parseLifecycleError(message: string) {
  const match = message.match(/lifecycle:([a-z-]+)/)
  return match?.[1] ?? "unknown"
}

async function callLifecycleRpc<T extends LifecycleRpcResult>(
  rpcName: string,
  params: Record<string, unknown>
): Promise<T> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc(rpcName, params)

  if (error) {
    throw new Error(parseLifecycleError(error.message))
  }

  return data as T
}

export async function cancelEnrollmentRpc(input: {
  organizationId: string
  enrollmentId: string
  cancelReason?: string | null
}) {
  return callLifecycleRpc<LifecycleRpcResult>("cancel_enrollment", {
    p_organization_id: input.organizationId,
    p_enrollment_id: input.enrollmentId,
    p_cancel_reason: input.cancelReason ?? null,
  })
}

export async function advanceEnrollmentStatusRpc(input: {
  organizationId: string
  enrollmentId: string
  targetStatus: string
  reason?: string | null
}) {
  return callLifecycleRpc<LifecycleRpcResult>("advance_enrollment_status", {
    p_organization_id: input.organizationId,
    p_enrollment_id: input.enrollmentId,
    p_target_status: input.targetStatus,
    p_reason: input.reason ?? null,
  })
}

export async function promoteWaitlistRpc(input: {
  organizationId: string
  waitlistId: string
}) {
  return callLifecycleRpc<LifecycleRpcResult>("promote_waitlist", {
    p_organization_id: input.organizationId,
    p_waitlist_id: input.waitlistId,
  })
}

export async function removeWaitlistRpc(input: {
  organizationId: string
  waitlistId: string
  reason?: string | null
}) {
  return callLifecycleRpc<LifecycleRpcResult>("remove_waitlist", {
    p_organization_id: input.organizationId,
    p_waitlist_id: input.waitlistId,
    p_reason: input.reason ?? null,
  })
}

export async function adminOverrideEnrollmentStatusRpc(input: {
  organizationId: string
  enrollmentId: string
  targetStatus: string
  reason: string
}) {
  return callLifecycleRpc<LifecycleRpcResult>("admin_override_enrollment_status", {
    p_organization_id: input.organizationId,
    p_enrollment_id: input.enrollmentId,
    p_target_status: input.targetStatus,
    p_reason: input.reason,
  })
}
