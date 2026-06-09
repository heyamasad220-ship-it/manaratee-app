import { Header } from "@/components/layout/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  PERMISSIONS,
  requireAnyPermission,
} from "@/lib/permissions/permissions"

export default async function FacilitiesResourcesPage() {
  await requireAnyPermission(
    PERMISSIONS.SPACES_VIEW,
    PERMISSIONS.SPACES_MANAGE,
    PERMISSIONS.BOOKINGS_VIEW
  )

  return (
    <>
      <Header title="Facilities" />
      <div className="flex flex-col gap-5 p-4 sm:p-6">
        <div>
          <h2 className="text-xl font-semibold">Resources</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Movable equipment and shared resources that can be reserved alongside spaces.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Resource catalog</CardTitle>
            <CardDescription>
              A full resources catalog and reservation workflow will be added in a future
              release. Spaces and the master calendar are available today.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Planned capabilities include equipment inventory, availability rules, and
              linkage to `resource_reservations` for conflict detection across modules.
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
