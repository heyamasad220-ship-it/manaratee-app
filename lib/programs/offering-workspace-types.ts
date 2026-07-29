import type { OfferingBillingScheduleResult } from "@/lib/programs/program-billing-queries"
import type {
  ProgramOfferingDiscountRule,
  ProgramOfferingFeePlan,
  ProgramOfferingFeePlanComponent,
} from "@/lib/programs/program-fee-plan-types"
import type { InvalidFeePlanLink } from "@/lib/programs/program-fee-plan-queries"
import type { ProgramOfferingRegistrationQuestion } from "@/lib/programs/program-registration-question-types"
import type { ProgramRegistrationOption } from "@/lib/programs/program-registration-option-types"
import type { ProgramSession } from "@/lib/programs/program-session-types"
import type { ProgramScheduleItem } from "@/lib/programs/program-schedule-types"
import type { ProgramStaffAssignmentWithDetails } from "@/lib/programs/program-staff-assignment-types"

export type OfferingWorkspaceData = {
  registrationOptions: ProgramRegistrationOption[]
  feePlans: ProgramOfferingFeePlan[]
  feePlanComponents: ProgramOfferingFeePlanComponent[]
  feePlanDiscountRules: ProgramOfferingDiscountRule[]
  invalidFeePlanLinks: InvalidFeePlanLink[]
  sessions: ProgramSession[]
  scheduleItems: ProgramScheduleItem[]
  staffAssignments: ProgramStaffAssignmentWithDetails[]
  billingSchedule: OfferingBillingScheduleResult
  /** Active org discount tags for member/staff pricing rules. */
  discountTags: Array<{ id: string; name: string }>
  registrationQuestions: ProgramOfferingRegistrationQuestion[]
  /** Bookable/active venues for facility linking on schedule items. */
  venues: Array<{ id: string; name: string }>
}

export type OfferingWorkspaceDataMap = Record<string, OfferingWorkspaceData>
