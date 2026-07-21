"use client"

import * as React from "react"
import { Header } from "@/components/layout/header"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import {
  AlertTriangle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  GripVertical,
  MapPin,
  MoreHorizontal,
  Pencil,
  Plus,
  Printer,
  Trash2,
  User,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

type ScheduleView = "week" | "day" | "age-group"

type Program = {
  id: string
  name: string
  age_groups: string[] | null
  start_date: string | null
  end_date: string | null
  enrolled: number | null
  capacity: number | null
  department_id: string | null
}

type ScheduleCategory = {
  id: string
  name: string
  color_class: string | null
}

type ScheduleActivity = {
  id: string
  title: string
  day_of_week: string
  start_time: string
  end_time: string
  category_id: string | null
  category_name: string | null
  color_class: string | null
  location: string | null
  staff_name: string | null
  age_group_name: string | null
  program_id: string | null
  enrolled: number | null
  capacity: number | null
  notes: string | null
}

type ActivityFormState = {
  id?: string
  title: string
  category_id: string
  day_of_week: string
  start_time: string
  end_time: string
  location: string
  staff_name: string
  age_group_name: string
  program_id: string
  enrolled: string
  capacity: string
  notes: string
}

type Conflict = {
  activityId: string
  type: "staff" | "location" | "overlap"
  message: string
}

const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]

const timeSlots = [
  "8:00 AM",
  "8:30 AM",
  "9:00 AM",
  "9:30 AM",
  "10:00 AM",
  "10:30 AM",
  "11:00 AM",
  "11:30 AM",
  "12:00 PM",
  "12:30 PM",
  "1:00 PM",
  "1:30 PM",
  "2:00 PM",
  "2:30 PM",
  "3:00 PM",
  "3:30 PM",
  "4:00 PM",
]

const categoryColorFallbacks = [
  "border-sky-500 bg-sky-500/20 text-sky-700 dark:text-sky-300",
  "border-orange-500 bg-orange-500/20 text-orange-700 dark:text-orange-300",
  "border-purple-500 bg-purple-500/20 text-purple-700 dark:text-purple-300",
  "border-emerald-500 bg-emerald-500/20 text-emerald-700 dark:text-emerald-300",
  "border-pink-500 bg-pink-500/20 text-pink-700 dark:text-pink-300",
  "border-amber-500 bg-amber-500/20 text-amber-700 dark:text-amber-300",
  "border-indigo-500 bg-indigo-500/20 text-indigo-700 dark:text-indigo-300",
  "border-zinc-500 bg-zinc-500/20 text-zinc-700 dark:text-zinc-300",
]

function getTimeIndex(time: string) {
  return timeSlots.indexOf(time)
}

function getActivityDuration(startTime: string, endTime: string) {
  const startIdx = getTimeIndex(startTime)
  const endIdx = getTimeIndex(endTime)

  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) return 1

  return endIdx - startIdx
}

function getCategoryClass(activity: ScheduleActivity, categories: ScheduleCategory[]) {
  if (activity.color_class) return activity.color_class

  const category = categories.find((item) => item.id === activity.category_id)
  if (category?.color_class) return category.color_class

  const categoryIndex = categories.findIndex((item) => item.id === activity.category_id)

  return categoryColorFallbacks[Math.max(categoryIndex, 0) % categoryColorFallbacks.length]
}

function getCategoryTextClass(colorClass: string) {
  return colorClass
    .split(" ")
    .filter((item) => item.startsWith("text-"))
    .join(" ")
}

function formatProgramDateRange(program: Program | undefined) {
  if (!program?.start_date && !program?.end_date) return ""

  const formatDate = (value: string | null) => {
    if (!value) return "TBD"

    return new Date(value).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  return `${formatDate(program.start_date)} - ${formatDate(program.end_date)}`
}

function emptyForm(
  selectedProgramId: string,
  selectedAgeGroupName: string,
  categories: ScheduleCategory[],
  programs: Program[]
): ActivityFormState {
  const selectedProgram = programs.find((program) => program.id === selectedProgramId)

  return {
    title: selectedProgram?.name || "",
    category_id: categories[0]?.id || "",
    day_of_week: "Monday",
    start_time: "9:00 AM",
    end_time: "10:00 AM",
    location: "",
    staff_name: "",
    age_group_name: selectedAgeGroupName,
    program_id: selectedProgramId,
    enrolled: selectedProgram?.enrolled?.toString() || "",
    capacity: selectedProgram?.capacity?.toString() || "",
    notes: "",
  }
}

export function ProgramsScheduleClient() {
  const supabase = createClient()

  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [tablesAvailable, setTablesAvailable] = React.useState(true)

  const [programs, setPrograms] = React.useState<Program[]>([])
  const [categories, setCategories] = React.useState<ScheduleCategory[]>([])
  const [activities, setActivities] = React.useState<ScheduleActivity[]>([])

  const [selectedProgramId, setSelectedProgramId] = React.useState("")
  const [selectedAgeGroupName, setSelectedAgeGroupName] = React.useState("")
  const [selectedDay, setSelectedDay] = React.useState("Monday")
  const [view, setView] = React.useState<ScheduleView>("week")

  const [editingActivity, setEditingActivity] = React.useState<ScheduleActivity | null>(null)
  const [isDialogOpen, setIsDialogOpen] = React.useState(false)
  const [formData, setFormData] = React.useState<ActivityFormState>(
    emptyForm("", "", [], [])
  )
  const [draggedActivity, setDraggedActivity] = React.useState<ScheduleActivity | null>(null)
  const [isPrintMode, setIsPrintMode] = React.useState(false)

  React.useEffect(() => {
    void fetchScheduleData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function fetchScheduleData() {
    setLoading(true)

    try {
      const [programsResult, categoriesResult, activitiesResult] = await Promise.all([
        supabase
          .from("programs")
          .select("id, name, age_groups, start_date, end_date, enrolled, capacity, department_id")
          .order("name"),
        supabase.from("schedule_categories").select("id, name, color_class").order("name"),
        supabase
          .from("schedule_activities")
          .select(`
            id,
            title,
            day_of_week,
            start_time,
            end_time,
            category_id,
            category_name,
            color_class,
            location,
            staff_name,
            age_group_name,
            program_id,
            enrolled,
            capacity,
            notes
          `)
          .order("day_of_week")
          .order("start_time"),
      ])

      const possibleMissingTableErrors = [
        programsResult.error,
        categoriesResult.error,
        activitiesResult.error,
      ].filter((error) => error?.code === "42P01" || error?.code === "42703")

      setTablesAvailable(possibleMissingTableErrors.length === 0)

      if (programsResult.error) {
        console.warn("programs could not be loaded:", programsResult.error.message)
        setPrograms([])
      } else {
        const nextPrograms = (programsResult.data || []) as Program[]
        setPrograms(nextPrograms)

        setSelectedProgramId((current) => current || nextPrograms[0]?.id || "")
        setSelectedAgeGroupName((current) => {
          if (current) return current
          return nextPrograms[0]?.age_groups?.[0] || ""
        })
      }

      if (categoriesResult.error) {
        console.warn("schedule_categories could not be loaded:", categoriesResult.error.message)
        setCategories([])
      } else {
        setCategories((categoriesResult.data || []) as ScheduleCategory[])
      }

      if (activitiesResult.error) {
        console.warn("schedule_activities could not be loaded:", activitiesResult.error.message)
        setActivities([])
      } else {
        setActivities((activitiesResult.data || []) as ScheduleActivity[])
      }
    } catch (error) {
      console.error("Schedule page error:", error)
      setTablesAvailable(false)
    } finally {
      setLoading(false)
    }
  }

  const selectedProgram = React.useMemo(() => {
    return programs.find((program) => program.id === selectedProgramId)
  }, [programs, selectedProgramId])

  const availableAgeGroups = React.useMemo(() => {
    return Array.from(new Set(programs.flatMap((program) => program.age_groups || []))).sort()
  }, [programs])

  const selectedProgramAgeGroups = React.useMemo(() => {
    return selectedProgram?.age_groups || availableAgeGroups
  }, [availableAgeGroups, selectedProgram])

  React.useEffect(() => {
    if (!selectedProgramId) return

    const program = programs.find((item) => item.id === selectedProgramId)
    const firstProgramAgeGroup = program?.age_groups?.[0]

    if (firstProgramAgeGroup && !program.age_groups?.includes(selectedAgeGroupName)) {
      setSelectedAgeGroupName(firstProgramAgeGroup)
    }
  }, [programs, selectedAgeGroupName, selectedProgramId])

  const conflicts = React.useMemo(() => {
    const nextConflicts: Conflict[] = []

    activities.forEach((activity) => {
      const activityStart = getTimeIndex(activity.start_time)
      const activityEnd = getTimeIndex(activity.end_time)

      if (activityStart === -1 || activityEnd === -1) return

      const staffConflict = activities.find((other) => {
        if (other.id === activity.id || !activity.staff_name || !other.staff_name) return false
        if (other.staff_name !== activity.staff_name || other.day_of_week !== activity.day_of_week) return false

        const otherStart = getTimeIndex(other.start_time)
        const otherEnd = getTimeIndex(other.end_time)

        return otherStart < activityEnd && otherEnd > activityStart
      })

      if (staffConflict) {
        nextConflicts.push({
          activityId: activity.id,
          type: "staff",
          message: `${activity.staff_name} is double-booked`,
        })
      }

      const locationConflict = activities.find((other) => {
        if (other.id === activity.id || !activity.location || !other.location) return false
        if (other.location !== activity.location || other.day_of_week !== activity.day_of_week) return false

        const otherStart = getTimeIndex(other.start_time)
        const otherEnd = getTimeIndex(other.end_time)

        return otherStart < activityEnd && otherEnd > activityStart
      })

      if (locationConflict) {
        nextConflicts.push({
          activityId: activity.id,
          type: "location",
          message: `${activity.location} has overlapping bookings`,
        })
      }
    })

    return nextConflicts.filter(
      (conflict, index, array) =>
        array.findIndex(
          (item) => item.activityId === conflict.activityId && item.message === conflict.message
        ) === index
    )
  }, [activities])

  const filteredActivities = React.useMemo(() => {
    return activities.filter((activity) => {
      const matchesProgram =
        !selectedProgramId || !activity.program_id || activity.program_id === selectedProgramId

      if (!matchesProgram) return false

      if (view === "week") {
        return !selectedAgeGroupName || !activity.age_group_name || activity.age_group_name === selectedAgeGroupName
      }

      if (view === "day") {
        const matchesAgeGroup =
          !selectedAgeGroupName || !activity.age_group_name || activity.age_group_name === selectedAgeGroupName

        return matchesAgeGroup && activity.day_of_week === selectedDay
      }

      return activity.day_of_week === selectedDay
    })
  }, [activities, selectedProgramId, selectedAgeGroupName, selectedDay, view])

  const visibleCategories = React.useMemo(() => {
    if (categories.length === 0) return []

    const usedCategoryIds = new Set(filteredActivities.map((activity) => activity.category_id).filter(Boolean))

    if (usedCategoryIds.size === 0) return categories

    return categories.filter((category) => usedCategoryIds.has(category.id))
  }, [categories, filteredActivities])

  const staffOptions = React.useMemo(() => {
    return Array.from(
      new Set(activities.map((activity) => activity.staff_name).filter(Boolean) as string[])
    ).sort()
  }, [activities])

  const locationOptions = React.useMemo(() => {
    return Array.from(
      new Set(activities.map((activity) => activity.location).filter(Boolean) as string[])
    ).sort()
  }, [activities])

  function openAddDialog() {
    setEditingActivity(null)
    setFormData(emptyForm(selectedProgramId, selectedAgeGroupName, categories, programs))
    setIsDialogOpen(true)
  }

  function openEditDialog(activity: ScheduleActivity) {
    setEditingActivity(activity)
    setFormData({
      id: activity.id,
      title: activity.title,
      category_id: activity.category_id || "",
      day_of_week: activity.day_of_week,
      start_time: activity.start_time,
      end_time: activity.end_time,
      location: activity.location || "",
      staff_name: activity.staff_name || "",
      age_group_name: activity.age_group_name || selectedAgeGroupName,
      program_id: activity.program_id || selectedProgramId,
      enrolled: activity.enrolled?.toString() || "",
      capacity: activity.capacity?.toString() || "",
      notes: activity.notes || "",
    })
    setIsDialogOpen(true)
  }

  async function handleSaveActivity(event: React.FormEvent) {
    event.preventDefault()
    if (!formData.title.trim()) return

    setSaving(true)

    const selectedCategory = categories.find((category) => category.id === formData.category_id)
    const selectedProgramForForm = programs.find((program) => program.id === formData.program_id)

    const payload = {
      title: formData.title.trim() || selectedProgramForForm?.name || "Scheduled Activity",
      day_of_week: formData.day_of_week,
      start_time: formData.start_time,
      end_time: formData.end_time,
      category_id: formData.category_id || null,
      category_name: selectedCategory?.name || null,
      color_class: selectedCategory?.color_class || null,
      location: formData.location.trim() || null,
      staff_name: formData.staff_name.trim() || null,
      age_group_name: formData.age_group_name || null,
      program_id: formData.program_id || null,
      enrolled: formData.enrolled ? Number(formData.enrolled) : selectedProgramForForm?.enrolled || null,
      capacity: formData.capacity ? Number(formData.capacity) : selectedProgramForForm?.capacity || null,
      notes: formData.notes.trim() || null,
    }

    try {
      if (editingActivity) {
        const { error } = await supabase
          .from("schedule_activities")
          .update(payload)
          .eq("id", editingActivity.id)

        if (error) throw error
      } else {
        const { error } = await supabase.from("schedule_activities").insert(payload)

        if (error) throw error
      }

      setIsDialogOpen(false)
      setEditingActivity(null)
      await fetchScheduleData()
    } catch (error: any) {
      console.error("Save activity error:", error)
      alert(
        error?.message ||
          "Could not save this activity. Confirm that schedule_activities has a program_id column."
      )
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteActivity(id: string) {
    const confirmed = window.confirm("Delete this activity?")
    if (!confirmed) return

    const { error } = await supabase.from("schedule_activities").delete().eq("id", id)

    if (error) {
      console.error("Delete activity error:", error)
      alert(error.message)
      return
    }

    await fetchScheduleData()
  }

  async function handleDuplicateActivity(activity: ScheduleActivity) {
    const { id, ...copy } = activity

    const { error } = await supabase.from("schedule_activities").insert({
      ...copy,
      title: `${activity.title} Copy`,
    })

    if (error) {
      console.error("Duplicate activity error:", error)
      alert(error.message)
      return
    }

    await fetchScheduleData()
  }

  function handleDragStart(activity: ScheduleActivity) {
    setDraggedActivity(activity)
  }

  function handleDragOver(event: React.DragEvent) {
    event.preventDefault()
  }

  async function handleDrop(day: string, timeSlot: string) {
    if (!draggedActivity) return

    const duration = getActivityDuration(draggedActivity.start_time, draggedActivity.end_time)
    const newStartIdx = getTimeIndex(timeSlot)
    const newEndIdx = Math.min(newStartIdx + duration, timeSlots.length - 1)

    if (newStartIdx === -1) return

    const { error } = await supabase
      .from("schedule_activities")
      .update({
        day_of_week: day,
        start_time: timeSlots[newStartIdx],
        end_time: timeSlots[newEndIdx],
      })
      .eq("id", draggedActivity.id)

    setDraggedActivity(null)

    if (error) {
      console.error("Move activity error:", error)
      alert(error.message)
      return
    }

    await fetchScheduleData()
  }

  function handlePrint() {
    setIsPrintMode(true)
    setTimeout(() => {
      window.print()
      setIsPrintMode(false)
    }, 100)
  }

  function getActivityConflict(activityId: string) {
    return conflicts.find((conflict) => conflict.activityId === activityId)
  }

  return (
    <>
      <Header title="Programs" />

      <TooltipProvider>
        <div className={cn("flex flex-col gap-6 p-6", isPrintMode && "print:p-0")}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Schedule Builder</h1>
              <p className="text-muted-foreground">
                Create and manage weekly schedules using your existing programs.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handlePrint}>
                <Printer className="mr-2 size-4" />
                Print
              </Button>
              <Button size="sm" className="bg-black text-white hover:bg-black/90" onClick={openAddDialog}>
                <Plus className="mr-2 size-4" />
                Add Activity
              </Button>
            </div>
          </div>

          {!tablesAvailable && (
            <Card className="border-amber-500/50 bg-amber-500/10 print:hidden">
              <CardContent className="flex items-start gap-3 p-4">
                <AlertTriangle className="size-5 shrink-0 text-amber-500" />
                <div>
                  <p className="font-medium text-amber-700 dark:text-amber-300">
                    Schedule tables are not connected yet
                  </p>
                  <p className="mt-1 text-sm text-amber-600 dark:text-amber-400">
                    This page needs your existing programs table plus schedule_categories and schedule_activities.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between print:hidden">
            <div className="flex flex-wrap items-center gap-3">
              <Select value={selectedProgramId} onValueChange={setSelectedProgramId}>
                <SelectTrigger className="w-[260px]">
                  <SelectValue placeholder="Select program" />
                </SelectTrigger>
                <SelectContent>
                  {programs.length === 0 ? (
                    <SelectItem value="no-programs" disabled>
                      No programs found
                    </SelectItem>
                  ) : (
                    programs.map((program) => (
                      <SelectItem key={program.id} value={program.id}>
                        {program.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>

              {view !== "age-group" && (
                <Select value={selectedAgeGroupName} onValueChange={setSelectedAgeGroupName}>
                  <SelectTrigger className="w-[170px]">
                    <SelectValue placeholder="Age group" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedProgramAgeGroups.length === 0 ? (
                      <SelectItem value="no-age-groups" disabled>
                        No age groups found
                      </SelectItem>
                    ) : (
                      selectedProgramAgeGroups.map((ageGroup) => (
                        <SelectItem key={ageGroup} value={ageGroup}>
                          {ageGroup}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              )}

              {view !== "week" && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      const idx = days.indexOf(selectedDay)
                      if (idx > 0) setSelectedDay(days[idx - 1])
                    }}
                    disabled={days.indexOf(selectedDay) === 0}
                  >
                    <ChevronLeft className="size-4" />
                  </Button>

                  <Select value={selectedDay} onValueChange={setSelectedDay}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {days.map((day) => (
                        <SelectItem key={day} value={day}>
                          {day}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      const idx = days.indexOf(selectedDay)
                      if (idx < days.length - 1) setSelectedDay(days[idx + 1])
                    }}
                    disabled={days.indexOf(selectedDay) === days.length - 1}
                  >
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              )}
            </div>

            <Tabs value={view} onValueChange={(value) => setView(value as ScheduleView)}>
              <TabsList>
                <TabsTrigger value="week">Week</TabsTrigger>
                <TabsTrigger value="day">Day</TabsTrigger>
                <TabsTrigger value="age-group">By Age Group</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {selectedProgram && (
            <Card className="print:hidden">
              <CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium">{selectedProgram.name}</p>
                  <p className="text-xs text-muted-foreground">{formatProgramDateRange(selectedProgram)}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(selectedProgram.age_groups || []).map((ageGroup) => (
                    <Badge key={ageGroup} variant="secondary">
                      {ageGroup}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {conflicts.length > 0 && (
            <Card className="border-amber-500/50 bg-amber-500/10 print:hidden">
              <CardContent className="flex items-start gap-3 p-4">
                <AlertTriangle className="size-5 shrink-0 text-amber-500" />
                <div>
                  <p className="font-medium text-amber-700 dark:text-amber-300">
                    {conflicts.length} scheduling conflict{conflicts.length === 1 ? "" : "s"} detected
                  </p>
                  <ul className="mt-1 text-sm text-amber-600 dark:text-amber-400">
                    {conflicts.slice(0, 3).map((conflict, index) => (
                      <li key={`${conflict.activityId}-${index}`}>{conflict.message}</li>
                    ))}
                    {conflicts.length > 3 && <li>And {conflicts.length - 3} more...</li>}
                  </ul>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex flex-wrap gap-3 print:hidden">
            {visibleCategories.map((category, index) => {
              const colorClass =
                category.color_class ||
                categoryColorFallbacks[index % categoryColorFallbacks.length]

              return (
                <div key={category.id} className="flex items-center gap-2">
                  <div className={cn("size-3 rounded-sm border-2", colorClass)} />
                  <span className="text-xs text-muted-foreground">{category.name}</span>
                </div>
              )
            })}
          </div>

          <div className="hidden print:block">
            <h1 className="text-xl font-bold">
              {selectedProgram?.name || "Schedule"} {selectedAgeGroupName ? `- ${selectedAgeGroupName}` : ""}
            </h1>
            <p className="text-sm text-muted-foreground">Weekly Schedule</p>
          </div>

          {loading ? (
            <div className="flex min-h-[420px] items-center justify-center text-sm text-muted-foreground">
              Loading schedule...
            </div>
          ) : activities.length === 0 ? (
            <EmptyScheduleState onAddActivity={openAddDialog} />
          ) : view === "week" ? (
            <WeekView
              activities={filteredActivities}
              categories={categories}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onEdit={openEditDialog}
              onDelete={handleDeleteActivity}
              onDuplicate={handleDuplicateActivity}
              getConflict={getActivityConflict}
            />
          ) : view === "day" ? (
            <DayView
              activities={filteredActivities}
              categories={categories}
              day={selectedDay}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onEdit={openEditDialog}
              onDelete={handleDeleteActivity}
              onDuplicate={handleDuplicateActivity}
              getConflict={getActivityConflict}
            />
          ) : (
            <AgeGroupView
              activities={filteredActivities}
              categories={categories}
              ageGroups={availableAgeGroups}
              onEdit={openEditDialog}
              onDelete={handleDeleteActivity}
              getConflict={getActivityConflict}
            />
          )}

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{editingActivity ? "Edit Activity" : "Add Activity"}</DialogTitle>
                <DialogDescription>
                  {editingActivity
                    ? "Update the activity details below."
                    : "Schedule an activity from your existing programs."}
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleSaveActivity} className="space-y-4">
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label>Program</Label>
                    <Select
                      value={formData.program_id}
                      onValueChange={(value) => {
                        const program = programs.find((item) => item.id === value)
                        setFormData({
                          ...formData,
                          program_id: value,
                          title: program?.name || formData.title,
                          age_group_name: program?.age_groups?.[0] || formData.age_group_name,
                          enrolled: program?.enrolled?.toString() || formData.enrolled,
                          capacity: program?.capacity?.toString() || formData.capacity,
                        })
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select program" />
                      </SelectTrigger>
                      <SelectContent>
                        {programs.length === 0 ? (
                          <SelectItem value="no-programs" disabled>
                            No programs found
                          </SelectItem>
                        ) : (
                          programs.map((program) => (
                            <SelectItem key={program.id} value={program.id}>
                              {program.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="title">Activity Name</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(event) => setFormData({ ...formData, title: event.target.value })}
                      placeholder="e.g., Morning Swim"
                      required
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="category">Activity Type</Label>
                    <Select
                      value={formData.category_id}
                      onValueChange={(value) => setFormData({ ...formData, category_id: value })}
                    >
                      <SelectTrigger id="category">
                        <SelectValue placeholder="Select activity type" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.length === 0 ? (
                          <SelectItem value="no-categories" disabled>
                            No categories found
                          </SelectItem>
                        ) : (
                          categories.map((category) => (
                            <SelectItem key={category.id} value={category.id}>
                              {category.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label>Start Time</Label>
                      <Select
                        value={formData.start_time}
                        onValueChange={(value) => setFormData({ ...formData, start_time: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {timeSlots.map((time) => (
                            <SelectItem key={time} value={time}>
                              {time}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid gap-2">
                      <Label>End Time</Label>
                      <Select
                        value={formData.end_time}
                        onValueChange={(value) => setFormData({ ...formData, end_time: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {timeSlots.map((time) => (
                            <SelectItem key={time} value={time}>
                              {time}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label>Day</Label>
                    <Select
                      value={formData.day_of_week}
                      onValueChange={(value) => setFormData({ ...formData, day_of_week: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {days.map((day) => (
                          <SelectItem key={day} value={day}>
                            {day}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <Label>Age Group</Label>
                    <Select
                      value={formData.age_group_name}
                      onValueChange={(value) => setFormData({ ...formData, age_group_name: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select age group" />
                      </SelectTrigger>
                      <SelectContent>
                        {(programs.find((program) => program.id === formData.program_id)?.age_groups || availableAgeGroups).length === 0 ? (
                          <SelectItem value="no-age-groups" disabled>
                            No age groups found
                          </SelectItem>
                        ) : (
                          (programs.find((program) => program.id === formData.program_id)?.age_groups || availableAgeGroups).map((ageGroup) => (
                            <SelectItem key={ageGroup} value={ageGroup}>
                              {ageGroup}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="location">Location</Label>
                    <Input
                      id="location"
                      list="location-options"
                      value={formData.location}
                      onChange={(event) => setFormData({ ...formData, location: event.target.value })}
                      placeholder="e.g., Gymnasium"
                    />
                    <datalist id="location-options">
                      {locationOptions.map((location) => (
                        <option key={location} value={location} />
                      ))}
                    </datalist>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="staff_name">Instructor / Staff</Label>
                    <Input
                      id="staff_name"
                      list="staff-options"
                      value={formData.staff_name}
                      onChange={(event) => setFormData({ ...formData, staff_name: event.target.value })}
                      placeholder="e.g., Sarah Johnson"
                    />
                    <datalist id="staff-options">
                      {staffOptions.map((staffName) => (
                        <option key={staffName} value={staffName} />
                      ))}
                    </datalist>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="enrolled">Enrolled</Label>
                      <Input
                        id="enrolled"
                        type="number"
                        min="0"
                        value={formData.enrolled}
                        onChange={(event) => setFormData({ ...formData, enrolled: event.target.value })}
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label htmlFor="capacity">Capacity</Label>
                      <Input
                        id="capacity"
                        type="number"
                        min="0"
                        value={formData.capacity}
                        onChange={(event) => setFormData({ ...formData, capacity: event.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? "Saving..." : editingActivity ? "Save Changes" : "Add Activity"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </TooltipProvider>
    </>
  )
}

function EmptyScheduleState({ onAddActivity }: { onAddActivity: () => void }) {
  return (
    <Card>
      <CardContent className="flex min-h-[420px] flex-col items-center justify-center gap-3 text-center">
        <CalendarDays className="size-10 text-muted-foreground" />
        <div>
          <h2 className="font-medium">No scheduled activities yet</h2>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            Choose one of your existing programs, then add an activity to place it on the schedule.
          </p>
        </div>
        <Button onClick={onAddActivity}>
          <Plus className="mr-2 size-4" />
          Add Activity
        </Button>
      </CardContent>
    </Card>
  )
}

function WeekView({
  activities,
  categories,
  onDragStart,
  onDragOver,
  onDrop,
  onEdit,
  onDelete,
  onDuplicate,
  getConflict,
}: {
  activities: ScheduleActivity[]
  categories: ScheduleCategory[]
  onDragStart: (activity: ScheduleActivity) => void
  onDragOver: (event: React.DragEvent) => void
  onDrop: (day: string, timeSlot: string) => void
  onEdit: (activity: ScheduleActivity) => void
  onDelete: (id: string) => void
  onDuplicate: (activity: ScheduleActivity) => void
  getConflict: (id: string) => Conflict | undefined
}) {
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[900px]">
        <div className="grid grid-cols-[80px_repeat(5,1fr)] border-b">
          <div className="p-2 text-xs font-medium text-muted-foreground">Time</div>
          {days.map((day) => (
            <div key={day} className="border-l p-2 text-center text-sm font-medium">
              {day}
            </div>
          ))}
        </div>

        <div className="relative">
          {timeSlots.map((time, index) => (
            <div key={time} className="grid min-h-[40px] grid-cols-[80px_repeat(5,1fr)] border-b">
              <div className="border-r p-2 text-xs text-muted-foreground">
                {index % 2 === 0 ? time : ""}
              </div>
              {days.map((day) => (
                <div
                  key={`${day}-${time}`}
                  className="relative min-h-[40px] border-l transition-colors hover:bg-muted/30"
                  onDragOver={onDragOver}
                  onDrop={() => onDrop(day, time)}
                />
              ))}
            </div>
          ))}

          {activities.map((activity) => {
            const dayIdx = days.indexOf(activity.day_of_week)
            const startIdx = getTimeIndex(activity.start_time)
            const duration = getActivityDuration(activity.start_time, activity.end_time)
            const conflict = getConflict(activity.id)

            if (dayIdx === -1 || startIdx === -1) return null

            return (
              <ActivityBlock
                key={activity.id}
                activity={activity}
                style={{
                  position: "absolute",
                  top: `${startIdx * 40}px`,
                  left: `calc(80px + ${dayIdx * 20}%)`,
                  width: "calc((100% - 80px) / 5 - 4px)",
                  height: `${duration * 40 - 4}px`,
                  marginLeft: "2px",
                  marginTop: "2px",
                }}
                colorClass={getCategoryClass(activity, categories)}
                conflict={conflict}
                onDragStart={() => onDragStart(activity)}
                onEdit={() => onEdit(activity)}
                onDelete={() => onDelete(activity.id)}
                onDuplicate={() => onDuplicate(activity)}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}

function DayView({
  activities,
  categories,
  day,
  onDragStart,
  onDragOver,
  onDrop,
  onEdit,
  onDelete,
  onDuplicate,
  getConflict,
}: {
  activities: ScheduleActivity[]
  categories: ScheduleCategory[]
  day: string
  onDragStart: (activity: ScheduleActivity) => void
  onDragOver: (event: React.DragEvent) => void
  onDrop: (day: string, timeSlot: string) => void
  onEdit: (activity: ScheduleActivity) => void
  onDelete: (id: string) => void
  onDuplicate: (activity: ScheduleActivity) => void
  getConflict: (id: string) => Conflict | undefined
}) {
  const dayActivities = activities.filter((activity) => activity.day_of_week === day)

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <Card>
        <CardContent className="p-0">
          <div className="relative">
            {timeSlots.map((time, index) => (
              <div
                key={time}
                className="grid min-h-[50px] grid-cols-[80px_1fr] border-b"
                onDragOver={onDragOver}
                onDrop={() => onDrop(day, time)}
              >
                <div className="border-r bg-muted/30 p-3 text-sm text-muted-foreground">
                  {index % 2 === 0 ? time : ""}
                </div>
                <div className="relative min-h-[50px] transition-colors hover:bg-muted/20" />
              </div>
            ))}

            {dayActivities.map((activity) => {
              const startIdx = getTimeIndex(activity.start_time)
              const duration = getActivityDuration(activity.start_time, activity.end_time)
              const conflict = getConflict(activity.id)

              if (startIdx === -1) return null

              return (
                <ActivityBlock
                  key={activity.id}
                  activity={activity}
                  style={{
                    position: "absolute",
                    top: `${startIdx * 50}px`,
                    left: "84px",
                    right: "4px",
                    height: `${duration * 50 - 4}px`,
                    marginTop: "2px",
                  }}
                  colorClass={getCategoryClass(activity, categories)}
                  conflict={conflict}
                  onDragStart={() => onDragStart(activity)}
                  onEdit={() => onEdit(activity)}
                  onDelete={() => onDelete(activity.id)}
                  onDuplicate={() => onDuplicate(activity)}
                  expanded
                />
              )
            })}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{day} Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total Activities</span>
              <span className="font-medium">{dayActivities.length}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Staff</span>
              <span className="font-medium">
                {new Set(dayActivities.map((activity) => activity.staff_name).filter(Boolean)).size}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Locations</span>
              <span className="font-medium">
                {new Set(dayActivities.map((activity) => activity.location).filter(Boolean)).size}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Activity Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {categories.map((category, index) => {
              const count = dayActivities.filter((activity) => activity.category_id === category.id).length
              if (count === 0) return null

              const colorClass = category.color_class || categoryColorFallbacks[index % categoryColorFallbacks.length]

              return (
                <div key={category.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={cn("size-2.5 rounded-sm border", colorClass)} />
                    <span className="text-sm">{category.name}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">{count}</span>
                </div>
              )
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function AgeGroupView({
  activities,
  categories,
  ageGroups,
  onEdit,
  onDelete,
  getConflict,
}: {
  activities: ScheduleActivity[]
  categories: ScheduleCategory[]
  ageGroups: string[]
  onEdit: (activity: ScheduleActivity) => void
  onDelete: (id: string) => void
  getConflict: (id: string) => Conflict | undefined
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {ageGroups.map((ageGroup) => {
        const groupActivities = activities.filter((activity) => activity.age_group_name === ageGroup)

        return (
          <Card key={ageGroup}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-base">
                {ageGroup}
                <Badge variant="secondary" className="font-normal">
                  {groupActivities.length} activities
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {groupActivities.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  No activities scheduled
                </p>
              ) : (
                groupActivities
                  .sort((a, b) => getTimeIndex(a.start_time) - getTimeIndex(b.start_time))
                  .map((activity) => {
                    const colorClass = getCategoryClass(activity, categories)
                    const conflict = getConflict(activity.id)

                    return (
                      <div
                        key={activity.id}
                        className={cn(
                          "cursor-pointer rounded-lg border-l-4 p-3 transition-colors hover:bg-muted/50",
                          colorClass,
                          conflict && "ring-2 ring-amber-500"
                        )}
                        onClick={() => onEdit(activity)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className={cn("truncate text-sm font-medium", getCategoryTextClass(colorClass))}>
                              {activity.title}
                            </p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {activity.start_time} - {activity.end_time}
                            </p>
                          </div>
                          {conflict && (
                            <Tooltip>
                              <TooltipTrigger>
                                <AlertTriangle className="size-4 shrink-0 text-amber-500" />
                              </TooltipTrigger>
                              <TooltipContent>{conflict.message}</TooltipContent>
                            </Tooltip>
                          )}
                        </div>

                        <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                          {activity.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="size-3" />
                              {activity.location}
                            </span>
                          )}
                          {activity.staff_name && (
                            <span className="flex items-center gap-1">
                              <User className="size-3" />
                              {activity.staff_name.split(" ")[0]}
                            </span>
                          )}
                        </div>

                        <div className="mt-2 flex justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={(event) => {
                              event.stopPropagation()
                              onDelete(activity.id)
                            }}
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    )
                  })
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

function ActivityBlock({
  activity,
  style,
  colorClass,
  conflict,
  onDragStart,
  onEdit,
  onDelete,
  onDuplicate,
  expanded = false,
}: {
  activity: ScheduleActivity
  style: React.CSSProperties
  colorClass: string
  conflict?: Conflict
  onDragStart: () => void
  onEdit: () => void
  onDelete: () => void
  onDuplicate: () => void
  expanded?: boolean
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      style={style}
      className={cn(
        "group cursor-grab overflow-hidden rounded-md border-l-4 p-2 active:cursor-grabbing print:border-l-2",
        colorClass,
        conflict && "ring-2 ring-amber-500"
      )}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <GripVertical className="size-3 shrink-0 text-muted-foreground print:hidden" />
            <p className={cn("truncate text-xs font-medium", getCategoryTextClass(colorClass))}>
              {activity.title}
            </p>
          </div>

          {expanded ? (
            <div className="mt-1 space-y-0.5">
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="size-3" />
                {activity.start_time} - {activity.end_time}
              </p>
              {activity.location && (
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="size-3" />
                  {activity.location}
                </p>
              )}
              {activity.staff_name && (
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <User className="size-3" />
                  {activity.staff_name}
                </p>
              )}
            </div>
          ) : (
            <p className="truncate text-[10px] text-muted-foreground">
              {activity.start_time} - {activity.end_time}
            </p>
          )}
        </div>

        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 print:hidden">
          {conflict && (
            <Tooltip>
              <TooltipTrigger>
                <AlertTriangle className="size-3.5 text-amber-500" />
              </TooltipTrigger>
              <TooltipContent>{conflict.message}</TooltipContent>
            </Tooltip>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-6">
                <MoreHorizontal className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="mr-2 size-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDuplicate}>
                <Copy className="mr-2 size-4" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onDelete} className="text-destructive">
                <Trash2 className="mr-2 size-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  )
}
