import Link from "next/link"
import { notFound } from "next/navigation"
import {
  ArrowLeft,
  Bell,
  Calendar,
  Edit,
  GraduationCap,
  Percent,
  Users,
  Utensils,
  ClipboardList,
} from "lucide-react"

import { Header } from "@/components/layout/header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DiscountForm } from "./discounts/discount-form"
import {
  getActiveDiscountTags,
  getProgramDiscounts,
} from "@/lib/programs/program-discount-queries"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"

import { getProgramById } from "@/lib/programs/program-queries"
import { getProgramCapacityGroups } from "@/lib/programs/program-capacity-group-queries"
import {
  getGroupGenderLabel,
  getTotalCapacityFromGroups,
} from "@/lib/programs/program-capacity-group-types"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getProgramScheduleItems } from "@/lib/programs/program-schedule-queries"
import { getProgramStatusLabel } from "@/lib/programs/program-status"
import { ScheduleForm } from "./schedule-form"
import { ScheduleItemCard } from "./schedule-item-card"

const DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
]

function formatDate(value: string | null) {
  if (!value) return "TBD"

  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export default async function ProgramDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const [program, scheduleItems, discountTags, programDiscounts, capacityGroups] =
    await Promise.all([
      getProgramById(id),
      getProgramScheduleItems(id),
      getActiveDiscountTags(),
      getProgramDiscounts(id),
      getProgramCapacityGroups(id),
    ])

  if (!program) {
    notFound()
  }

  const enrolled = program.enrolled ?? 0
  const capacity = program.capacity ?? 0
  const waitlist = program.waitlist ?? 0
  const available = Math.max(capacity - enrolled, 0)
  const filledPercent = capacity > 0 ? Math.round((enrolled / capacity) * 100) : 0
  const capacityGroupsTotal = getTotalCapacityFromGroups(capacityGroups)

  return (
    <>
      <Header title="Programs" />

      <div className="flex flex-col gap-6 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link
              href="/programs"
              className="mb-3 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Programs
            </Link>

            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight">
                {program.name}
              </h1>
              <Badge>{getProgramStatusLabel(program.status)}</Badge>
            </div>

            <p className="mt-2 text-muted-foreground">
              {program.description || "No description provided."}
            </p>
          </div>
          
          <Button asChild>
            <Link href={`/programs/${program.id}/edit`}>
              <Edit className="mr-2 h-4 w-4" />
              Edit Program
            </Link>
          </Button>
          
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="flex w-full flex-wrap justify-start gap-2">
            <TabsTrigger value="overview" className="gap-2">
              <Calendar className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="capacity" className="gap-2">
              <Users className="h-4 w-4" />
              Capacity
            </TabsTrigger>
            <TabsTrigger value="discounts" className="gap-2">
              <Percent className="h-4 w-4" />
              Discounts
            </TabsTrigger>
            <TabsTrigger value="lunch" className="gap-2">
              <Utensils className="h-4 w-4" />
              Lunch Options
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-2">
              <Bell className="h-4 w-4" />
              Notifications
            </TabsTrigger>
            <TabsTrigger value="roster" className="gap-2">
              <ClipboardList className="h-4 w-4" />
              Roster
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Card>
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="rounded-full bg-muted p-3">
                    <Calendar className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Start Date</p>
                    <p className="font-semibold">{formatDate(program.start_date)}</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="rounded-full bg-muted p-3">
                    <Calendar className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">End Date</p>
                    <p className="font-semibold">{formatDate(program.end_date)}</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="rounded-full bg-muted p-3">
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Enrollment</p>
                    <p className="font-semibold">
                      {enrolled}/{capacity}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="rounded-full bg-muted p-3">
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Waitlist</p>
                    <p className="font-semibold">{waitlist}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Program Overview</CardTitle>
                  <CardDescription>
                    Core details and registration window.
                  </CardDescription>
                </CardHeader>

                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-sm text-muted-foreground">Enrollment Opens</p>
                    <p className="font-medium">
                      {formatDate(program.enrollment_open_date)}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground">Enrollment Closes</p>
                    <p className="font-medium">
                      {formatDate(program.enrollment_close_date)}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground">Gender</p>
                    <p className="font-medium">{program.gender || "All"}</p>
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground">Department</p>
                    <p className="font-medium">
                      {program.department?.name || program.department_id || "No department"}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Eligibility</CardTitle>
                  <CardDescription>Age and grade restrictions.</CardDescription>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div>
                    <div className="mb-2 flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <p className="font-medium">Age Groups</p>
                    </div>

                    {program.age_groups?.length ? (
                      <div className="flex flex-wrap gap-2">
                        {program.age_groups.map((ageGroup: string) => (
                          <Badge key={ageGroup} variant="secondary">
                            {ageGroup}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No age groups set.
                      </p>
                    )}
                  </div>

                  <div>
                    <div className="mb-2 flex items-center gap-2">
                      <GraduationCap className="h-4 w-4 text-muted-foreground" />
                      <p className="font-medium">Grade Levels</p>
                    </div>

                    {program.grade_levels?.length ? (
                      <div className="flex flex-wrap gap-2">
                        {program.grade_levels.map((gradeLevel: string) => (
                          <Badge key={gradeLevel} variant="secondary">
                            {gradeLevel}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        No grade levels set.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Schedule</CardTitle>
                <CardDescription>
                  Weekly activities and session times for this program.
                </CardDescription>
              </CardHeader>

              <CardContent>
                <div className="mb-6">
                  <ScheduleForm programId={program.id} />
                </div>

                {scheduleItems.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-8 text-center">
                    <Calendar className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
                    <h3 className="font-medium">No schedule items yet</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Add activities and session times for this program.
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-4 lg:grid-cols-7">
                    {DAYS.map((day) => {
                      const items = scheduleItems.filter(
                        (item) => item.day_of_week === day
                      )

                      return (
                        <Card key={day} className="min-h-[240px]">
                          <CardHeader className="pb-3">
                            <CardTitle className="text-sm capitalize">
                              {day}
                            </CardTitle>
                          </CardHeader>

                          <CardContent className="space-y-2">
                            {items.length === 0 ? (
                              <p className="text-xs text-muted-foreground">
                                No activities
                              </p>
                            ) : (
                              items.map((item) => (
                                <ScheduleItemCard
                                  key={item.id}
                                  programId={program.id}
                                  item={item}
                                />
                              ))
                            )}
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="capacity" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Total Capacity</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{capacity}</p>
                  <p className="text-sm text-muted-foreground">Maximum participants</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Enrolled</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{enrolled}</p>
                  <p className="text-sm text-muted-foreground">{filledPercent}% filled</p>
                  <div className="mt-3 h-2 rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full bg-primary"
                      style={{ width: `${Math.min(filledPercent, 100)}%` }}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Available</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{available}</p>
                  <p className="text-sm text-muted-foreground">Open spots</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Waitlist</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{waitlist}</p>
                  <p className="text-sm text-muted-foreground">Waiting for spots</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle>Capacity Groups</CardTitle>
                  {capacityGroups.length > 0 ? (
                    <Badge variant="secondary">
                      {capacityGroups.length} group
                      {capacityGroups.length === 1 ? "" : "s"} · Total capacity:{" "}
                      {capacityGroupsTotal}
                    </Badge>
                  ) : null}
                </div>
                <CardDescription>
                  Enrollment limits by grade level, gender, or both.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {capacityGroups.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                    No capacity groups yet. Edit the program to add grade or
                    gender groups.
                  </div>
                ) : (
                  <div className="rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Group Name</TableHead>
                          <TableHead>Grades</TableHead>
                          <TableHead>Gender</TableHead>
                          <TableHead className="text-right">Capacity</TableHead>
                          <TableHead className="text-right">Enrolled</TableHead>
                          <TableHead className="text-right">Spots Left</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {capacityGroups.map((group) => {
                          const groupAvailable = Math.max(
                            group.capacity - group.enrolled,
                            0
                          )

                          return (
                            <TableRow key={group.id}>
                              <TableCell className="font-medium whitespace-normal">
                                {group.name}
                              </TableCell>
                              <TableCell className="whitespace-normal">
                                {group.grade_levels.length > 0
                                  ? group.grade_levels.join(", ")
                                  : "All grades"}
                              </TableCell>
                              <TableCell>
                                {getGroupGenderLabel(group.genders)}
                              </TableCell>
                              <TableCell className="text-right">
                                {group.capacity}
                              </TableCell>
                              <TableCell className="text-right">
                                {group.enrolled}
                              </TableCell>
                              <TableCell className="text-right">
                                {groupAvailable}
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                      <TableFooter>
                        <TableRow>
                          <TableCell colSpan={3} className="font-medium">
                            Total capacity ({capacityGroups.length}{" "}
                            {capacityGroups.length === 1 ? "group" : "groups"})
                          </TableCell>
                          <TableCell className="text-right text-base font-semibold">
                            {capacityGroupsTotal}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {capacityGroups.reduce(
                              (sum, group) => sum + group.enrolled,
                              0
                            )}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {capacityGroups.reduce(
                              (sum, group) =>
                                sum +
                                Math.max(group.capacity - group.enrolled, 0),
                              0
                            )}
                          </TableCell>
                        </TableRow>
                      </TableFooter>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="discounts">
            <Card>
              <CardHeader>
                <CardTitle>Discounts</CardTitle>
                <CardDescription>
                  Configure staff, member, scholarship, and other program discounts.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
  <Button>
    Add Discount
  </Button>
<DiscountForm
  programId={program.id}
  organizationId={program.organization_id}
  discountTags={discountTags}
/>
  {programDiscounts.length === 0 ? (
  <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
    No discounts configured yet.
  </div>
) : (
  <div className="rounded-lg border">
    {programDiscounts.map((discount) => (
      <div
        key={discount.id}
        className="flex items-center justify-between border-b p-4 last:border-b-0"
      >
        <div>
          <p className="font-medium">
            {discountTags.find((tag) => tag.id === discount.discount_tag_id)
              ?.name || "Unknown tag"}
          </p>

          <p className="text-sm text-muted-foreground">
            {discount.discount_type === "percent"
              ? `${discount.amount}% Off`
              : `$${Number(discount.amount).toFixed(2)} Off`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant={discount.is_active ? "default" : "secondary"}>
            {discount.is_active ? "Active" : "Inactive"}
          </Badge>

          <DiscountForm
            programId={program.id}
            organizationId={program.organization_id}
            discountTags={discountTags}
            discount={discount}
          />
        </div>
      </div>
    ))}
  </div>
)}
</div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="lunch">
            <Card>
              <CardHeader>
                <CardTitle>Lunch Options</CardTitle>
                <CardDescription>
                  Lunch options will be connected here.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                  No lunch options connected yet.
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications">
            <Card>
              <CardHeader>
                <CardTitle>Notifications</CardTitle>
                <CardDescription>
                  Notification settings will be connected here.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                  No notification settings connected yet.
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="roster">
            <Card>
              <CardHeader>
                <CardTitle>Roster</CardTitle>
                <CardDescription>
                  Enrolled participants will appear here.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                  Roster is not connected yet.
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  )
}