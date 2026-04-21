"use client"

import { useState } from "react"
import { Header } from "@/components/layout/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { 
  Plus, 
  Search, 
  MoreHorizontal, 
  Pencil, 
  Trash2, 
  Eye, 
  EyeOff, 
  ExternalLink, 
  Phone, 
  Mail, 
  ArrowLeft,
  Calendar,
  DollarSign,
  FileText,
  Wrench,
} from "lucide-react"

interface ServiceHistory {
  id: string
  date: string
  description: string
  amount: number
  invoiceNumber?: string
  notes?: string
}

interface ServiceProvider {
  id: string
  companyName: string
  contactName: string
  phone: string
  email: string
  website: string
  serviceAgreement: string
  accountNumber: string
  username: string
  password: string
  securityCode: string
  serviceType: string
  serviceHistory: ServiceHistory[]
}

// Mock data
const mockProviders: ServiceProvider[] = [
  {
    id: "sp-1",
    companyName: "CleanPro Carpet Services",
    contactName: "John Smith",
    phone: "(555) 123-4567",
    email: "john@cleanpro.com",
    website: "https://cleanpro.com",
    serviceAgreement: "Annual - Expires 12/2024",
    accountNumber: "CP-2024-001",
    username: "masjid_admin",
    password: "secure123",
    securityCode: "4521",
    serviceType: "Carpet Cleaning",
    serviceHistory: [
      { id: "sh-1", date: "2024-01-15", description: "Full carpet cleaning - Main Hall", amount: 450.00, invoiceNumber: "INV-2024-001", notes: "Deep cleaning completed" },
      { id: "sh-2", date: "2023-10-20", description: "Carpet cleaning - Prayer rooms", amount: 275.00, invoiceNumber: "INV-2023-089" },
      { id: "sh-3", date: "2023-06-12", description: "Stain removal - Lobby area", amount: 125.00, invoiceNumber: "INV-2023-045" },
    ],
  },
  {
    id: "sp-2",
    companyName: "CoolAir HVAC",
    contactName: "Sarah Johnson",
    phone: "(555) 234-5678",
    email: "sarah@coolairhvac.com",
    website: "https://coolairhvac.com",
    serviceAgreement: "Monthly - Active",
    accountNumber: "CA-78542",
    username: "manaratee",
    password: "hvac2024",
    securityCode: "9987",
    serviceType: "HVAC / AC",
    serviceHistory: [
      { id: "sh-4", date: "2024-02-01", description: "Monthly maintenance check", amount: 150.00, invoiceNumber: "INV-CA-0201" },
      { id: "sh-5", date: "2024-01-05", description: "AC unit repair - Unit #3", amount: 425.00, invoiceNumber: "INV-CA-0105", notes: "Replaced compressor" },
    ],
  },
  {
    id: "sp-3",
    companyName: "QuickFix Plumbing",
    contactName: "Mike Davis",
    phone: "(555) 345-6789",
    email: "mike@quickfixplumbing.com",
    website: "https://quickfixplumbing.com",
    serviceAgreement: "On-call",
    accountNumber: "QFP-11234",
    username: "masjid_manaratee",
    password: "plumb456",
    securityCode: "1122",
    serviceType: "Plumbing",
    serviceHistory: [
      { id: "sh-8", date: "2024-01-28", description: "Emergency leak repair - Bathroom 2", amount: 350.00, invoiceNumber: "QFP-2024-012", notes: "Pipe burst, replaced section" },
    ],
  },
  {
    id: "sp-4",
    companyName: "BrightSpark Electrical",
    contactName: "Lisa Chen",
    phone: "(555) 456-7890",
    email: "lisa@brightspark.com",
    website: "https://brightspark.com",
    serviceAgreement: "Annual - Expires 06/2025",
    accountNumber: "BSE-99001",
    username: "admin_manaratee",
    password: "electric789",
    securityCode: "3344",
    serviceType: "Electrical",
    serviceHistory: [
      { id: "sh-10", date: "2024-02-10", description: "Light fixture installation - Parking lot", amount: 850.00, invoiceNumber: "BSE-0210" },
    ],
  },
  {
    id: "sp-5",
    companyName: "GreenScape Landscaping",
    contactName: "Carlos Rodriguez",
    phone: "(555) 567-8901",
    email: "carlos@greenscape.com",
    website: "https://greenscape.com",
    serviceAgreement: "Seasonal - Mar-Nov",
    accountNumber: "GS-2024-55",
    username: "manaratee_lawn",
    password: "green2024",
    securityCode: "5566",
    serviceType: "Landscaping",
    serviceHistory: [
      { id: "sh-12", date: "2023-11-01", description: "Fall cleanup and leaf removal", amount: 400.00, invoiceNumber: "GS-1101" },
    ],
  },
]

export default function ContactsServiceProvidersPage() {
  const [providers, setProviders] = useState<ServiceProvider[]>(mockProviders)
  const [searchQuery, setSearchQuery] = useState("")
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [selectedProvider, setSelectedProvider] = useState<ServiceProvider | null>(null)
  const [showPasswords, setShowPasswords] = useState(false)

  const filteredProviders = providers.filter(
    (p) =>
      p.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.contactName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.serviceType.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const stats = {
    total: providers.length,
    totalSpent: providers.reduce((acc, p) => acc + p.serviceHistory.reduce((a, s) => a + s.amount, 0), 0),
    serviceTypes: [...new Set(providers.map(p => p.serviceType))].length,
  }

  const handleDeleteProvider = (id: string) => {
    setProviders((prev) => prev.filter((p) => p.id !== id))
    if (selectedProvider?.id === id) {
      setSelectedProvider(null)
    }
  }

  if (selectedProvider) {
    return (
      <>
        <Header title="Service Providers" />
        <div className="p-6">
          <Button
            variant="ghost"
            onClick={() => setSelectedProvider(null)}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Providers
          </Button>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-1">
              <Card>
                <CardHeader>
                  <CardTitle>{selectedProvider.companyName}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1">
                    <span className="text-sm text-muted-foreground">Contact Person</span>
                    <span className="font-medium">{selectedProvider.contactName}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-sm text-muted-foreground">Phone</span>
                    <span className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      {selectedProvider.phone}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-sm text-muted-foreground">Email</span>
                    <span className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      {selectedProvider.email}
                    </span>
                  </div>
                  {selectedProvider.website && (
                    <div className="flex flex-col gap-1">
                      <span className="text-sm text-muted-foreground">Website</span>
                      <a
                        href={selectedProvider.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-primary hover:underline"
                      >
                        <ExternalLink className="h-4 w-4" />
                        {selectedProvider.website.replace(/^https?:\/\//, "")}
                      </a>
                    </div>
                  )}
                  <Separator />
                  <div className="flex flex-col gap-1">
                    <span className="text-sm text-muted-foreground">Service Type</span>
                    <Badge variant="secondary">{selectedProvider.serviceType}</Badge>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-sm text-muted-foreground">Service Agreement</span>
                    <span>{selectedProvider.serviceAgreement}</span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Account Credentials</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowPasswords(!showPasswords)}
                    >
                      {showPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <div className="flex flex-col gap-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Account #</span>
                      <span>{selectedProvider.accountNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Username</span>
                      <span>{showPasswords ? selectedProvider.username : "••••••••"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Password</span>
                      <span>{showPasswords ? selectedProvider.password : "••••••••"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Security Code</span>
                      <span>{showPasswords ? selectedProvider.securityCode : "••••"}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-2">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Service History</CardTitle>
                  <Button size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Service
                  </Button>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Invoice</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedProvider.serviceHistory.map((service) => (
                        <TableRow key={service.id}>
                          <TableCell>{service.date}</TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span>{service.description}</span>
                              {service.notes && (
                                <span className="text-sm text-muted-foreground">{service.notes}</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{service.invoiceNumber || "-"}</TableCell>
                          <TableCell className="text-right font-medium">
                            ${service.amount.toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Header title="Service Providers" />
      <div className="flex flex-col gap-6 p-6">
        {/* Stats Cards */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Providers</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
                <div className="rounded-lg bg-muted p-2">
                  <Wrench className="h-5 w-5 text-muted-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Spent</p>
                  <p className="text-2xl font-bold">${stats.totalSpent.toLocaleString()}</p>
                </div>
                <div className="rounded-lg bg-green-50 p-2">
                  <DollarSign className="h-5 w-5 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Service Types</p>
                  <p className="text-2xl font-bold">{stats.serviceTypes}</p>
                </div>
                <div className="rounded-lg bg-purple-50 p-2">
                  <FileText className="h-5 w-5 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search providers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Provider
          </Button>
        </div>

        {/* Providers Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead className="hidden md:table-cell">Contact</TableHead>
                  <TableHead>Service Type</TableHead>
                  <TableHead className="hidden lg:table-cell">Agreement</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProviders.map((provider) => (
                  <TableRow
                    key={provider.id}
                    className="cursor-pointer"
                    onClick={() => setSelectedProvider(provider)}
                  >
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{provider.companyName}</span>
                        <span className="text-sm text-muted-foreground">{provider.email}</span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="flex flex-col">
                        <span>{provider.contactName}</span>
                        <span className="text-sm text-muted-foreground">{provider.phone}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{provider.serviceType}</Badge>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                      {provider.serviceAgreement}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation()
                            setSelectedProvider(provider)
                          }}>
                            <Eye className="mr-2 h-4 w-4" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => e.stopPropagation()}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteProvider(provider.id)
                            }}
                            className="text-red-600"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
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

      {/* Add Provider Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Service Provider</DialogTitle>
            <DialogDescription>Add a new service provider to your contacts.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="companyName">Company Name</Label>
              <Input id="companyName" placeholder="Enter company name" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="contactName">Contact Person</Label>
              <Input id="contactName" placeholder="Enter contact name" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="Enter email address" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" type="tel" placeholder="Enter phone number" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="serviceType">Service Type</Label>
              <Input id="serviceType" placeholder="e.g., Plumbing, HVAC, Electrical" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="website">Website (Optional)</Label>
              <Input id="website" type="url" placeholder="https://example.com" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => setShowAddDialog(false)}>Add Provider</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
