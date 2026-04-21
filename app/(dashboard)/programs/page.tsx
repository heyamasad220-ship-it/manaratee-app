"use client"

import { useState } from "react"
import Link from "next/link"
import { Header } from "@/components/layout/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  GraduationCap,
  Users,
  Calendar,
  DollarSign,
  TrendingUp,
  Clock,
  ArrowRight,
  Plus,
} from "lucide-react"

// Mock data
const stats = [
  { label: "Active Programs", value: "24", change: "+3 this month", icon: GraduationCap, color: "text-blue-600" },
  { label: "Total Registrations", value: "486", change: "+52 this week", icon: Users, color: "text-green-600" },
  { label: "This Week's Classes", value: "38", change: "12 today", icon: Calendar, color: "text-purple-600" },
  { label: "Monthly Revenue", value: "$18,450", change: "+12% vs last month", icon: DollarSign, color: "text-amber-600" },
]

const popularPrograms = [
  { id: "prog-1", name: "Youth Soccer League", department: "Events", registrations: 64, capacity: 80, status: "Active" },
  { id: "prog-2", name: "Taekwondo Classes", department: "Events", registrations: 45, capacity: 50, status: "Active" },
  { id: "prog-3", name: "Summer Camp 2026", department: "Community Outreach", registrations: 120, capacity: 150, status: "Open" },
  { id: "prog-4", name: "Adult Fitness Aerobics", department: "Events", registrations: 32, capacity: 40, status: "Active" },
  { id: "prog-5", name: "After School Tutoring", department: "Education", registrations: 28, capacity: 30, status: "Active" },
]

const upcomingClasses = [
  { id: "c-1", program: "Youth Soccer League", time: "4:00 PM - 5:30 PM", instructor: "Coach Ahmad", location: "Field A", enrolled: 16 },
  { id: "c-2", program: "Taekwondo Classes", time: "5:00 PM - 6:00 PM", instructor: "Master Kim", location: "Gym", enrolled: 22 },
  { id: "c-3", program: "Adult Fitness Aerobics", time: "6:30 PM - 7:30 PM", instructor: "Sarah Johnson", location: "Studio B", enrolled: 18 },
  { id: "c-4", program: "Weekend Quran Class", time: "10:00 AM - 11:30 AM", instructor: "Imam Hassan", location: "Room 101", enrolled: 25 },
]

const recentRegistrations = [
  { id: "r-1", name: "Ahmed Hassan", program: "Youth Soccer League", date: "Today", amount: "$150" },
  { id: "r-2", name: "Maria Garcia", program: "Adult Fitness Aerobics", date: "Today", amount: "$80" },
  { id: "r-3", name: "John Smith", program: "Summer Camp 2026", date: "Yesterday", amount: "$350" },
  { id: "r-4", name: "Fatima Ali", program: "Taekwondo Classes", date: "Yesterday", amount: "$120" },
]

export default function ProgramsPage() {
  return (
    <>
      <Header title="Programs" />
      <div className="p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Programs Overview</h2>
            <p className="text-sm text-muted-foreground">
              Manage classes, camps, and activities for your community
            </p>
          </div>
          <Button asChild>
            <Link href="/programs/catalog">
              <Plus className="mr-2 h-4 w-4" />
              New Program
            </Link>
          </Button>
        </div>

        {/* Stats */}
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <Card key={stat.label}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                    <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                    <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <TrendingUp className="h-3 w-3 text-green-600" />
                      {stat.change}
                    </p>
                  </div>
                  <div className={`rounded-full bg-muted p-3 ${stat.color}`}>
                    <stat.icon className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Popular Programs */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-base">Popular Programs</CardTitle>
                <CardDescription>Top programs by registration</CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/programs/catalog">
                  View All
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3">
                {popularPrograms.map((program) => (
                  <div
                    key={program.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="flex flex-col gap-1">
                      <Link
                        href={`/programs/catalog/${program.id}`}
                        className="font-medium text-foreground hover:text-primary hover:underline"
                      >
                        {program.name}
                      </Link>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          {program.department}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {program.registrations}/{program.capacity} enrolled
                        </span>
                      </div>
                    </div>
                    <Badge
                      variant={program.status === "Active" ? "default" : "outline"}
                      className="shrink-0"
                    >
                      {program.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Today's Schedule */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-base">Today&apos;s Classes</CardTitle>
                <CardDescription>Upcoming sessions for today</CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/programs/schedule">
                  Full Schedule
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3">
                {upcomingClasses.map((cls) => (
                  <div
                    key={cls.id}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <div className="flex flex-col gap-1">
                      <p className="font-medium text-foreground">{cls.program}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {cls.time}
                        </span>
                        <span>{cls.location}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-foreground">{cls.instructor}</p>
                      <p className="text-xs text-muted-foreground">{cls.enrolled} enrolled</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Recent Registrations */}
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-base">Recent Registrations</CardTitle>
                <CardDescription>Latest program sign-ups</CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/programs/registrations">
                  View All
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {recentRegistrations.map((reg) => (
                  <div
                    key={reg.id}
                    className="flex flex-col gap-1 rounded-lg border p-3"
                  >
                    <p className="font-medium text-foreground">{reg.name}</p>
                    <p className="text-sm text-muted-foreground">{reg.program}</p>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{reg.date}</span>
                      <span className="text-sm font-medium text-green-600">{reg.amount}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}
