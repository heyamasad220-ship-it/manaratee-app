import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  advanceEnrollmentStatusAction,
  cancelEnrollmentAction,
  markEnrollmentPaymentAction,
} from "@/app/(dashboard)/programs/registrations/actions"
import {
  canCancelEnrollmentStatus,
  forwardEnrollmentActionLabel,
  nextForwardEnrollmentStatus,
} from "@/lib/programs/program-lifecycle-types"

export function RegistrationLifecycleActions({
  enrollmentId,
  status,
  redirectTo,
}: {
  enrollmentId: string
  status: string | null
  redirectTo: string
}) {
  const normalizedStatus = (status || "").toLowerCase()
  const nextStatus = nextForwardEnrollmentStatus(normalizedStatus)
  const showCancel = canCancelEnrollmentStatus(normalizedStatus)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Lifecycle Actions</CardTitle>
        <CardDescription>
          Manage enrollment status. Payment collection will be handled at checkout
          in a later phase.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        {normalizedStatus === "pending_payment" || normalizedStatus === "pending" ? (
          <form action={advanceEnrollmentStatusAction}>
            <input type="hidden" name="enrollment_id" value={enrollmentId} />
            <input type="hidden" name="target_status" value="enrolled" />
            <input type="hidden" name="redirect_to" value={redirectTo} />
            <Button type="submit">Confirm Enrollment</Button>
          </form>
        ) : null}

        {normalizedStatus === "enrolled" ? (
          <form action={advanceEnrollmentStatusAction}>
            <input type="hidden" name="enrollment_id" value={enrollmentId} />
            <input type="hidden" name="target_status" value="active" />
            <input type="hidden" name="redirect_to" value={redirectTo} />
            <Button type="submit">Mark Active</Button>
          </form>
        ) : null}

        {normalizedStatus === "active" ? (
          <form action={advanceEnrollmentStatusAction}>
            <input type="hidden" name="enrollment_id" value={enrollmentId} />
            <input type="hidden" name="target_status" value="completed" />
            <input type="hidden" name="redirect_to" value={redirectTo} />
            <Button type="submit">Mark Completed</Button>
          </form>
        ) : null}

        {nextStatus &&
        !["pending", "pending_payment", "enrolled", "active"].includes(
          normalizedStatus
        ) ? (
          <form action={advanceEnrollmentStatusAction}>
            <input type="hidden" name="enrollment_id" value={enrollmentId} />
            <input type="hidden" name="target_status" value={nextStatus} />
            <input type="hidden" name="redirect_to" value={redirectTo} />
            <Button type="submit">
              {forwardEnrollmentActionLabel(nextStatus)}
            </Button>
          </form>
        ) : null}

        {showCancel ? (
          <form action={cancelEnrollmentAction}>
            <input type="hidden" name="enrollment_id" value={enrollmentId} />
            <input type="hidden" name="redirect_to" value={redirectTo} />
            <Button type="submit" variant="destructive">
              Cancel Registration
            </Button>
          </form>
        ) : null}

        <div className="flex flex-wrap gap-2 border-t pt-3 sm:w-full">
          <form action={markEnrollmentPaymentAction}>
            <input type="hidden" name="enrollment_id" value={enrollmentId} />
            <input type="hidden" name="payment_status" value="paid" />
            <input type="hidden" name="redirect_to" value={redirectTo} />
            <Button type="submit" variant="outline" size="sm">
              Mark Paid
            </Button>
          </form>
          <form action={markEnrollmentPaymentAction}>
            <input type="hidden" name="enrollment_id" value={enrollmentId} />
            <input type="hidden" name="payment_status" value="partial" />
            <input type="hidden" name="redirect_to" value={redirectTo} />
            <Button type="submit" variant="outline" size="sm">
              Mark Partial
            </Button>
          </form>
          <form action={markEnrollmentPaymentAction}>
            <input type="hidden" name="enrollment_id" value={enrollmentId} />
            <input type="hidden" name="payment_status" value="pending" />
            <input type="hidden" name="redirect_to" value={redirectTo} />
            <Button type="submit" variant="outline" size="sm">
              Mark Pending
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  )
}
