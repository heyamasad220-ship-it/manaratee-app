"use client"

import { useState } from "react"
import Link from "next/link"
import { Header } from "@/components/layout/header"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Search, MoreHorizontal, Eye, Mail, XCircle, Download, Users, DollarSign, CheckCircle, Clock } from "lucide-react"

// Mock data
const stats = [
  { label: "Total Registrations", value: "486", icon: Users, color: "text-blue-600" },
  { label: "This Month", value: "68", icon: CheckCircle, color: "text-green-600" },
  { label: "Pending Payment", value: "12", icon: Clock, color: "text-amber-600" },
  { label: "Revenue", value: "$24,350", icon: DollarSign, color: "text-purple-600" },
]

const registrations = [
  {
    id: "reg-1",
    participantName: "Ahmed Hassan",
    parentName: "Mohamed Hassan",
    email: "m.hassan@email.com",
    phone: "(555) 123-4567",
    program: "Youth Soccer League",
    registeredDate: "Mar 1, 2026",
    amount: "$150",
    paymentStatus: "Paid",
    status: "Active",
  },
  {
    id: "reg-2",
    participantName: "Sarah Johnson",
    parentName: "Self",
    email: "sarah.j@email.com",
    phone: "(555) 234-5678",
    program: "Adult Fitness Aerobics",
    registeredDate: "Mar 1, 2026",
    amount: "$80",
    paymentStatus: "Paid",
    status: "Active",
  },
  {
    id: "reg-3",
    participantName: "Omar Ali",
    parentName: "Fatima Ali",
    email: "f.ali@email.com",
    phone: "(555) 345-6789",
    program: "Summer Camp 2026",
    registeredDate: "Feb 28, 2026",
    amount: "$350",
    paymentStatus: "Pending",
    status: "Pending",
  },
  {
    id: "reg-4",
    participantName: "Emily Chen",
    parentName: "David Chen",
    email: "d.chen@email.com",
    phone: "(555) 456-7890",
    program: "Taekwondo Classes",
    registeredDate: "Feb 28, 2026",
    amount: "$120",
    paymentStatus: "Paid",
    status: "Active",
  },
  {
    id: "reg-5",
    participantName: "Aisha Rahman",
    parentName: "Yusuf Rahman",
    email: "y.rahman@email.com",
    phone: "(555) 567-8901",
    program: "Weekend Quran Class",
    registeredDate: "Feb 27, 2026",
    amount: "Free",
    paymentStatus: "N/A",
    status: "Active",
  },
  {
    id: "reg-6",
    participantName: "James Wilson",
    parentName: "Self",
    email: "j.wilson@email.com",
    phone: "(555) 678-9012",
    program: "Basketball Training",
    registeredDate: "Feb 26, 2026",
    amount: "$180",
    paymentStatus: "Paid",
    status: "Active",
  },
  {
    id: "reg-7",
    participantName: "Maria Garcia",
    parentName: "Carlos Garcia",
    email: "c.garcia@email.com",
    phone: "(555) 789-0123",
    program: "Art & Crafts Workshop",
    registeredDate: "Feb 25, 2026",
    amount: "$100",
    paymentStatus: "Partial",
    status: "Active",
  },
  {
    id: "reg-8",
    participantName: "Zain Malik",
    parentName: "Imran Malik",
    email: "i.malik@email.com",
    phone: "(555) 890-1234",
    program: "After School Tutoring",
    registeredDate: "Feb 24, 2026",
    amount: "$200",
    paymentStatus: "Paid",
    status: "Active",
  },
]

const programs = ["All Programs", "Youth Soccer League", "Taekwondo Classes", "Summer Camp 2026", "Adult Fitness Aerobics", "After School Tutoring", "Weekend Quran Class", "Basketball Training", "Art & Crafts Workshop"]
const paymentStatuses = ["All", "Paid", "Pending", "Partial", "N/A"]
const statuses = ["All", "Active", "Pending", "Cancelled", "Completed"]

export default function ProgramsRegistrationsPage() {
  const [search, setSearch] = useState("")
  const [programFilter, setProgramFilter] = useState("All Programs")
  const [paymentFilter, setPaymentFilter] = useState("All")
  const [statusFilter, setStatusFilter] = useState("All")

  const filteredRegistrations = registrations.filter((reg) => {
    const matchesSearch = 
      reg.participantName.toLowerCase().includes(search.toLowerCase()) ||
      reg.parentName.toLowerCase().includes(search.toLowerCase()) ||
      reg.email.toLowerCase().includes(search.toLowerCase())
    const matchesProgram = programFilter === "All Programs" || reg.program === programFilter
    const matchesPayment = paymentFilter === "All" || reg.paymentStatus === paymentFilter
    const matchesStatus = statusFilter === "All" || reg.status === statusFilter
    return matchesSearch && matchesProgram && matchesPayment && matchesStatus
  })

  return (
    <>
      <Header title="Programs" />
      <div className="p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Registrations</h2>
            <p className="text-sm text-muted-foreground">
              View and manage program registrations
            </p>
          </div>
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>

        {/* Stats */}
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <Card key={stat.label}>
              <CardContent className="flex items-center gap-4 p-4">
                <div className={`rounded-full bg-muted p-3 ${stat.color}`}>
                  <stat.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by name or email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={programFilter} onValueChange={setProgramFilter}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="Program" />
                </SelectTrigger>
                <SelectContent>
                  {programs.map((prog) => (
                    <SelectItem key={prog} value={prog}>{prog}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={paymentFilter} onValueChange={setPaymentFilter}>
                <SelectTrigger className="w-full sm:w-[140px]">
                  <SelectValue placeholder="Payment" />
                </SelectTrigger>
                <SelectContent>
                  {paymentStatuses.map((status) => (
                    <SelectItem key={status} value={status}>{status}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {statuses.map((status) => (
                    <SelectItem key={status} value={status}>{status}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Registrations Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Participant</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Program</TableHead>
                  <TableHead>Registered</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRegistrations.map((reg) => (
                  <TableRow key={reg.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-foreground">{reg.participantName}</p>
                        <p className="text-xs text-muted-foreground">
                          {reg.parentName !== "Self" ? `Parent: ${reg.parentName}` : "Adult"}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm text-foreground">{reg.email}</p>
                        <p className="text-xs text-muted-foreground">{reg.phone}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/programs/catalog/prog-1`}
                        className="text-primary hover:underline"
                      >
                        {reg.program}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{reg.registeredDate}</TableCell>
                    <TableCell className="font-medium">{reg.amount}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          reg.paymentStatus === "Paid"
                            ? "default"
                            : reg.paymentStatus === "Pending"
                            ? "destructive"
                            : reg.paymentStatus === "Partial"
                            ? "outline"
                            : "secondary"
                        }
                      >
                        {reg.paymentStatus}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          reg.status === "Active"
                            ? "default"
                            : reg.status === "Pending"
                            ? "outline"
                            : "secondary"
                        }
                      >
                        {reg.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Eye className="mr-2 h-4 w-4" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Mail className="mr-2 h-4 w-4" />
                            Send Email
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-red-600">
                            <XCircle className="mr-2 h-4 w-4" />
                            Cancel Registration
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
