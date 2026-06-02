"use client"

import { useState } from "react"
import Link from "next/link"
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Search, Plus, MoreHorizontal, Phone, Mail, Clock, Users, CheckCircle2, ExternalLink } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type {
  ChildcareProviderRecord,
  ChildcareProviderStats,
} from "@/lib/hr/childcare-provider-actions"
import { peopleManagementApplicationsUrl } from "@/lib/applications/application-routes"

interface HrChildcarePanelProps {
  providers: ChildcareProviderRecord[]
  stats: ChildcareProviderStats
}

export function HrChildcarePanel({ providers, stats }: HrChildcarePanelProps) {
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [selectedProvider, setSelectedProvider] = useState<ChildcareProviderRecord | null>(null)

  const filtered = providers.filter((provider) => {
    const matchesSearch =
      provider.name.toLowerCase().includes(search.toLowerCase()) ||
      provider.email.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === "all" || provider.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const applicationsUrl = peopleManagementApplicationsUrl({
    pageTab: "submissions",
    applicationType: "childcare_provider",
  })

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="border border-border">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.totalProviders}</p>
              <p className="text-xs text-muted-foreground">Total Providers</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-border">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.activeProviders}</p>
              <p className="text-xs text-muted-foreground">Active Providers</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-border">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
              <Clock className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.totalHours.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Total Hours</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-border">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
              <Users className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.totalEventsWorked}</p>
              <p className="text-xs text-muted-foreground">Total Events Worked</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 sm:w-[280px]"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="Active">Active</SelectItem>
              <SelectItem value="Inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button asChild>
          <Link href={applicationsUrl}>
            <Plus className="mr-2 h-4 w-4" />
            Review Applications
          </Link>
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Provider Name</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Experience</TableHead>
                <TableHead>Age Groups</TableHead>
                <TableHead>Hours</TableHead>
                <TableHead>Events</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-12 text-center text-muted-foreground">
                    {providers.length === 0
                      ? "No approved childcare providers yet. Review applications to add providers to this directory."
                      : "No providers match your search or filters."}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((provider) => (
                  <TableRow key={provider.id}>
                    <TableCell>
                      <button
                        type="button"
                        onClick={() => setSelectedProvider(provider)}
                        className="font-medium text-primary underline-offset-4 hover:underline"
                      >
                        {provider.name}
                      </button>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 text-sm">
                          <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                          {provider.phone}
                        </div>
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <Mail className="h-3.5 w-3.5" />
                          {provider.email}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{provider.experience}</TableCell>
                    <TableCell>{provider.ageGroups}</TableCell>
                    <TableCell className="tabular-nums font-medium">{provider.totalHours}</TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">{provider.eventsWorked}</TableCell>
                    <TableCell>
                      <Badge
                        variant={provider.status === "Active" ? "default" : "secondary"}
                        className={
                          provider.status === "Active"
                            ? "bg-green-100 text-green-800 hover:bg-green-100"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-100"
                        }
                      >
                        {provider.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setSelectedProvider(provider)}>
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/applications/${provider.applicationId}`}>
                              <ExternalLink className="mr-2 h-4 w-4" />
                              View Application
                            </Link>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!selectedProvider} onOpenChange={() => setSelectedProvider(null)}>
        <DialogContent className="max-w-2xl">
          {selectedProvider && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  {selectedProvider.name}
                  <Badge
                    variant={selectedProvider.status === "Active" ? "default" : "secondary"}
                    className={
                      selectedProvider.status === "Active"
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-100 text-gray-600"
                    }
                  >
                    {selectedProvider.status}
                  </Badge>
                </DialogTitle>
                <DialogDescription>
                  {selectedProvider.experience} experience
                  {selectedProvider.certifications !== "—"
                    ? ` | ${selectedProvider.certifications}`
                    : ""}
                </DialogDescription>
              </DialogHeader>

              <Tabs defaultValue="info" className="mt-4">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="info">Info</TabsTrigger>
                  <TabsTrigger value="history">History ({selectedProvider.history.length})</TabsTrigger>
                </TabsList>

                <TabsContent value="info" className="mt-4">
                  <div className="flex flex-col gap-6">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-muted-foreground">Phone</span>
                        <span className="text-sm font-medium">{selectedProvider.phone}</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-muted-foreground">Email</span>
                        <span className="text-sm font-medium">{selectedProvider.email}</span>
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="rounded-lg border border-border p-4 text-center">
                        <p className="text-2xl font-bold text-foreground">{selectedProvider.totalHours}</p>
                        <p className="text-xs text-muted-foreground">Total Hours</p>
                      </div>
                      <div className="rounded-lg border border-border p-4 text-center">
                        <p className="text-2xl font-bold text-foreground">{selectedProvider.eventsWorked}</p>
                        <p className="text-xs text-muted-foreground">Events Worked</p>
                      </div>
                      <div className="rounded-lg border border-border p-4 text-center">
                        <p className="text-2xl font-bold text-primary">—</p>
                        <p className="text-xs text-muted-foreground">Positive Reviews</p>
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-muted-foreground">Age Groups</span>
                        <span className="text-sm font-medium">{selectedProvider.ageGroups}</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-muted-foreground">Availability</span>
                        <span className="text-sm font-medium">{selectedProvider.availability}</span>
                      </div>
                    </div>

                    {selectedProvider.certifications !== "—" && (
                      <div className="flex flex-col gap-2">
                        <span className="text-sm font-medium">Certifications</span>
                        <div className="flex flex-wrap gap-2">
                          {selectedProvider.certifications.split(", ").map((cert) => (
                            <Badge key={cert} variant="secondary">
                              {cert}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedProvider.notes && (
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-muted-foreground">Notes</span>
                        <p className="text-sm">{selectedProvider.notes}</p>
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="history" className="mt-4">
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    Event participation history will appear here once providers are assigned to events.
                  </p>
                </TabsContent>
              </Tabs>

              <DialogFooter>
                <Button variant="outline" onClick={() => setSelectedProvider(null)}>
                  Close
                </Button>
                <Button asChild>
                  <Link href={`/applications/${selectedProvider.applicationId}`}>
                    View Application
                  </Link>
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
