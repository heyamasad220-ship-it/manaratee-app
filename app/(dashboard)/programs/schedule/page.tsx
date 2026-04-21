"use client"

import { useState } from "react"
import { Header } from "@/components/layout/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ChevronLeft, ChevronRight, Clock, MapPin, Users } from "lucide-react"
import { cn } from "@/lib/utils"

// Mock schedule data
const weekDays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

const scheduleData: Record<string, Array<{
  id: string
  program: string
  time: string
  endTime: string
  instructor: string
  location: string
  enrolled: number
  capacity: number
  department: string
}>> = {
  Sunday: [
    { id: "s-1", program: "Youth Soccer League", time: "10:00 AM", endTime: "11:30 AM", instructor: "Coach Ahmad", location: "Field A", enrolled: 16, capacity: 20, department: "Events" },
    { id: "s-2", program: "Weekend Quran Class", time: "10:00 AM", endTime: "11:30 AM", instructor: "Imam Hassan", location: "Room 101", enrolled: 25, capacity: 30, department: "Education" },
    { id: "s-3", program: "Art & Crafts Workshop", time: "2:00 PM", endTime: "3:30 PM", instructor: "Ms. Rivera", location: "Art Room", enrolled: 18, capacity: 20, department: "Community Outreach" },
  ],
  Monday: [
    { id: "m-1", program: "After School Tutoring", time: "3:30 PM", endTime: "5:00 PM", instructor: "Various", location: "Library", enrolled: 28, capacity: 30, department: "Education" },
    { id: "m-2", program: "Taekwondo Classes", time: "5:00 PM", endTime: "6:00 PM", instructor: "Master Kim", location: "Gym", enrolled: 22, capacity: 25, department: "Events" },
  ],
  Tuesday: [
    { id: "t-1", program: "After School Tutoring", time: "3:30 PM", endTime: "5:00 PM", instructor: "Various", location: "Library", enrolled: 28, capacity: 30, department: "Education" },
    { id: "t-2", program: "Adult Fitness Aerobics", time: "6:30 PM", endTime: "7:30 PM", instructor: "Sarah Johnson", location: "Studio B", enrolled: 18, capacity: 25, department: "Events" },
  ],
  Wednesday: [
    { id: "w-1", program: "After School Tutoring", time: "3:30 PM", endTime: "5:00 PM", instructor: "Various", location: "Library", enrolled: 28, capacity: 30, department: "Education" },
    { id: "w-2", program: "Basketball Training", time: "4:00 PM", endTime: "5:30 PM", instructor: "Coach Williams", location: "Court", enrolled: 22, capacity: 30, department: "Events" },
    { id: "w-3", program: "Taekwondo Classes", time: "5:00 PM", endTime: "6:00 PM", instructor: "Master Kim", location: "Gym", enrolled: 22, capacity: 25, department: "Events" },
  ],
  Thursday: [
    { id: "th-1", program: "After School Tutoring", time: "3:30 PM", endTime: "5:00 PM", instructor: "Various", location: "Library", enrolled: 28, capacity: 30, department: "Education" },
    { id: "th-2", program: "Adult Fitness Aerobics", time: "6:30 PM", endTime: "7:30 PM", instructor: "Sarah Johnson", location: "Studio B", enrolled: 18, capacity: 25, department: "Events" },
  ],
  Friday: [
    { id: "f-1", program: "Taekwondo Classes", time: "5:00 PM", endTime: "6:00 PM", instructor: "Master Kim", location: "Gym", enrolled: 22, capacity: 25, department: "Events" },
    { id: "f-2", program: "Basketball Training", time: "4:00 PM", endTime: "5:30 PM", instructor: "Coach Williams", location: "Court", enrolled: 22, capacity: 30, department: "Events" },
  ],
  Saturday: [
    { id: "sa-1", program: "Youth Soccer League", time: "4:00 PM", endTime: "5:30 PM", instructor: "Coach Ahmad", location: "Field A", enrolled: 16, capacity: 20, department: "Events" },
    { id: "sa-2", program: "Weekend Quran Class", time: "10:00 AM", endTime: "11:30 AM", instructor: "Imam Hassan", location: "Room 101", enrolled: 25, capacity: 30, department: "Education" },
    { id: "sa-3", program: "Art & Crafts Workshop", time: "2:00 PM", endTime: "3:30 PM", instructor: "Ms. Rivera", location: "Art Room", enrolled: 18, capacity: 20, department: "Community Outreach" },
  ],
}

const departmentColors: Record<string, string> = {
  "Administration": "bg-gray-100 border-gray-300 text-gray-800",
  "Education": "bg-purple-100 border-purple-300 text-purple-800",
  "Operations": "bg-sky-100 border-sky-300 text-sky-800",
  "Technology": "bg-teal-100 border-teal-300 text-teal-800",
  "Events": "bg-green-100 border-green-300 text-green-800",
  "Finance": "bg-amber-100 border-amber-300 text-amber-800",
  "Marketing": "bg-pink-100 border-pink-300 text-pink-800",
  "Community Outreach": "bg-blue-100 border-blue-300 text-blue-800",
}

export default function ProgramsSchedulePage() {
  const [currentWeek, setCurrentWeek] = useState("This Week")
  const [departmentFilter, setDepartmentFilter] = useState("All")
  const [locationFilter, setLocationFilter] = useState("All Locations")

  const locations = ["All Locations", "Field A", "Gym", "Court", "Studio B", "Library", "Room 101", "Art Room"]
  const departments = ["All", "Administration", "Education", "Operations", "Technology", "Events", "Finance", "Marketing", "Community Outreach"]

  return (
    <>
      <Header title="Programs" />
      <div className="p-6">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Schedule</h2>
            <p className="text-sm text-muted-foreground">
              Weekly class and activity schedule
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[120px] text-center text-sm font-medium">{currentWeek}</span>
            <Button variant="outline" size="icon">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                {departments.map((dept) => (
                  <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={locationFilter} onValueChange={setLocationFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Location" />
              </SelectTrigger>
              <SelectContent>
                {locations.map((loc) => (
                  <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex flex-wrap gap-2 sm:ml-auto">
              {Object.keys(departmentColors).map((dept) => (
                <Badge key={dept} className={cn("text-xs", departmentColors[dept])}>
                  {dept}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Weekly Schedule Grid */}
        <div className="grid gap-4 lg:grid-cols-7">
          {weekDays.map((day) => {
            const daySchedule = scheduleData[day] || []
            const filteredSchedule = daySchedule.filter((item) => {
              const matchesDepartment = departmentFilter === "All" || item.department === departmentFilter
              const matchesLocation = locationFilter === "All Locations" || item.location === locationFilter
              return matchesDepartment && matchesLocation
            })

            return (
              <Card key={day} className="min-h-[300px]">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">{day}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-2 p-2">
                  {filteredSchedule.length === 0 ? (
                    <p className="py-4 text-center text-xs text-muted-foreground">No classes</p>
                  ) : (
                    filteredSchedule.map((item) => (
                      <div
                        key={item.id}
                        className={cn(
                          "rounded-md border p-2 text-xs",
                          departmentColors[item.department]
                        )}
                      >
                        <p className="font-medium leading-tight">{item.program}</p>
                        <div className="mt-1 flex flex-col gap-0.5 opacity-80">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {item.time} - {item.endTime}
                          </span>
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {item.location}
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {item.enrolled}/{item.capacity}
                          </span>
                        </div>
                        <p className="mt-1 truncate text-[10px]">{item.instructor}</p>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </>
  )
}
