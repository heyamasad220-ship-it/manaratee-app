"use client"

import { useState } from "react"
import { Header } from "@/components/layout/header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
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
  Save,
  X
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
      { id: "sh-6", date: "2023-12-01", description: "Monthly maintenance check", amount: 150.00, invoiceNumber: "INV-CA-1201" },
      { id: "sh-7", date: "2023-11-15", description: "Heating system inspection", amount: 200.00, invoiceNumber: "INV-CA-1115" },
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
      { id: "sh-9", date: "2023-09-10", description: "Water heater maintenance", amount: 175.00, invoiceNumber: "QFP-2023-087" },
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
      { id: "sh-11", date: "2023-12-20", description: "Annual electrical inspection", amount: 300.00, invoiceNumber: "BSE-1220" },
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
      { id: "sh-13", date: "2023-08-15", description: "Tree trimming", amount: 550.00, invoiceNumber: "GS-0815" },
      { id: "sh-14", date: "2023-05-20", description: "Spring planting and mulching", amount: 625.00, invoiceNumber: "GS-0520" },
    ],
  },
]

export default function ServiceProvidersPage() {
  const [providers, setProviders] = useState<ServiceProvider[]>(mockProviders)
  const [searchQuery, setSearchQuery] = useState("")
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showAddServiceDialog, setShowAddServiceDialog] = useState(false)
  const [selectedProvider, setSelectedProvider] = useState<ServiceProvider | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState<ServiceProvider | null>(null)
  const [showPasswords, setShowPasswords] = useState(false)
  const [newProvider, setNewProvider] = useState({
    companyName: "",
    contactName: "",
    phone: "",
    email: "",
    website: "",
    serviceAgreement: "",
    accountNumber: "",
    username: "",
    password: "",
    securityCode: "",
    serviceType: "",
  })
  const [newService, setNewService] = useState({
    date: "",
    description: "",
    amount: "",
    invoiceNumber: "",
    notes: "",
  })

  const filteredProviders = providers.filter(
    (p) =>
      p.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.contactName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.serviceType.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleAddProvider = () => {
    if (newProvider.companyName && newProvider.contactName) {
      setProviders((prev) => [
        ...prev,
        {
          id: `sp-${Date.now()}`,
          ...newProvider,
          serviceHistory: [],
        },
      ])
      setNewProvider({
        companyName: "",
        contactName: "",
        phone: "",
        email: "",
        website: "",
        serviceAgreement: "",
        accountNumber: "",
        username: "",
        password: "",
        securityCode: "",
        serviceType: "",
      })
      setShowAddDialog(false)
    }
  }

  const handleDeleteProvider = (id: string) => {
    setProviders((prev) => prev.filter((p) => p.id !== id))
    if (selectedProvider?.id === id) {
      setSelectedProvider(null)
    }
  }

  const handleSaveEdit = () => {
    if (editForm) {
      setProviders((prev) =>
        prev.map((p) => (p.id === editForm.id ? editForm : p))
      )
      setSelectedProvider(editForm)
      setIsEditing(false)
      setEditForm(null)
    }
  }

  const handleAddService = () => {
    if (selectedProvider && newService.date && newService.description && newService.amount) {
      const updatedProvider = {
        ...selectedProvider,
        serviceHistory: [
          {
            id: `sh-${Date.now()}`,
            date: newService.date,
            description: newService.description,
            amount: parseFloat(newService.amount),
            invoiceNumber: newService.invoiceNumber || undefined,
            notes: newService.notes || undefined,
          },
          ...selectedProvider.serviceHistory,
        ],
      }
      setProviders((prev) =>
        prev.map((p) => (p.id === selectedProvider.id ? updatedProvider : p))
      )
      setSelectedProvider(updatedProvider)
      setNewService({ date: "", description: "", amount: "", invoiceNumber: "", notes: "" })
      setShowAddServiceDialog(false)
    }
  }

  const totalSpent = selectedProvider?.serviceHistory.reduce((sum, s) => sum + s.amount, 0) || 0

  // Detail View
  if (selectedProvider) {
    return (
      <>
        <Header title="Service Providers" />
        <div className="flex flex-col gap-6 p-6">
          {/* Back Button */}
          <Button
            variant="ghost"
            className="w-fit gap-2"
            onClick={() => {
              setSelectedProvider(null)
              setIsEditing(false)
              setEditForm(null)
            }}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Providers
          </Button>

          {/* Provider Header */}
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold">{selectedProvider.companyName}</h2>
              <div className="mt-1 flex items-center gap-2">
                <Badge variant="outline">{selectedProvider.serviceType}</Badge>
                <span className="text-sm text-muted-foreground">{selectedProvider.serviceAgreement}</span>
              </div>
            </div>
            <div className="flex gap-2">
              {isEditing ? (
                <>
                  <Button variant="outline" onClick={() => { setIsEditing(false); setEditForm(null); }}>
                    <X className="mr-2 h-4 w-4" />
                    Cancel
                  </Button>
                  <Button onClick={handleSaveEdit}>
                    <Save className="mr-2 h-4 w-4" />
                    Save Changes
                  </Button>
                </>
              ) : (
                <Button variant="outline" onClick={() => { setIsEditing(true); setEditForm(selectedProvider); }}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit Provider
                </Button>
              )}
            </div>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="info" className="w-full">
            <TabsList>
              <TabsTrigger value="info">Provider Info</TabsTrigger>
              <TabsTrigger value="history">Service History ({selectedProvider.serviceHistory.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="info" className="mt-4">
              <Card>
                <CardContent className="pt-6">
                  {isEditing && editForm ? (
                    <div className="grid grid-cols-2 gap-6">
                      <div className="flex flex-col gap-1.5">
                        <Label>Company Name</Label>
                        <Input
                          value={editForm.companyName}
                          onChange={(e) => setEditForm({ ...editForm, companyName: e.target.value })}
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label>Contact Name</Label>
                        <Input
                          value={editForm.contactName}
                          onChange={(e) => setEditForm({ ...editForm, contactName: e.target.value })}
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label>Phone</Label>
                        <Input
                          value={editForm.phone}
                          onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label>Email</Label>
                        <Input
                          value={editForm.email}
                          onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label>Website</Label>
                        <Input
                          value={editForm.website}
                          onChange={(e) => setEditForm({ ...editForm, website: e.target.value })}
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label>Service Type</Label>
                        <Input
                          value={editForm.serviceType}
                          onChange={(e) => setEditForm({ ...editForm, serviceType: e.target.value })}
                        />
                      </div>
                      <div className="col-span-2 flex flex-col gap-1.5">
                        <Label>Service Agreement</Label>
                        <Input
                          value={editForm.serviceAgreement}
                          onChange={(e) => setEditForm({ ...editForm, serviceAgreement: e.target.value })}
                        />
                      </div>
                      
                      <Separator className="col-span-2 my-2" />
                      <p className="col-span-2 text-sm font-semibold">Account Credentials</p>
                      
                      <div className="flex flex-col gap-1.5">
                        <Label>Account #</Label>
                        <Input
                          value={editForm.accountNumber}
                          onChange={(e) => setEditForm({ ...editForm, accountNumber: e.target.value })}
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label>Username</Label>
                        <Input
                          value={editForm.username}
                          onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label>Password</Label>
                        <Input
                          type="password"
                          value={editForm.password}
                          onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <Label>Security Code</Label>
                        <Input
                          value={editForm.securityCode}
                          onChange={(e) => setEditForm({ ...editForm, securityCode: e.target.value })}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* Contact Info */}
                      <div>
                        <p className="text-sm font-semibold mb-4">Contact Information</p>
                        <div className="grid grid-cols-2 gap-6">
                          <div>
                            <p className="text-xs text-muted-foreground">Contact Name</p>
                            <p className="font-medium">{selectedProvider.contactName}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Phone</p>
                            <p className="font-medium flex items-center gap-1.5">
                              <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                              {selectedProvider.phone}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Email</p>
                            <p className="font-medium flex items-center gap-1.5">
                              <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                              {selectedProvider.email}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Website</p>
                            <a
                              href={selectedProvider.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 font-medium text-primary hover:underline"
                            >
                              Visit Site <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>
                        </div>
                      </div>

                      <Separator />

                      {/* Account Credentials */}
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <p className="text-sm font-semibold">Account Credentials</p>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowPasswords(!showPasswords)}
                          >
                            {showPasswords ? (
                              <>
                                <EyeOff className="mr-2 h-4 w-4" />
                                Hide
                              </>
                            ) : (
                              <>
                                <Eye className="mr-2 h-4 w-4" />
                                Show
                              </>
                            )}
                          </Button>
                        </div>
                        <div className="grid grid-cols-2 gap-6">
                          <div>
                            <p className="text-xs text-muted-foreground">Account #</p>
                            <p className="font-medium font-mono">{selectedProvider.accountNumber}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Username</p>
                            <p className="font-medium font-mono">{selectedProvider.username}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Password</p>
                            <p className="font-medium font-mono">
                              {showPasswords ? selectedProvider.password : "••••••••"}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Security Code</p>
                            <p className="font-medium font-mono">
                              {showPasswords ? selectedProvider.securityCode : "••••"}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="history" className="mt-4">
              {/* Stats */}
              <div className="grid grid-cols-3 gap-4 mb-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Total Services
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">{selectedProvider.serviceHistory.length}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      Total Spent
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">${totalSpent.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Last Service
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">
                      {selectedProvider.serviceHistory.length > 0
                        ? selectedProvider.serviceHistory[0].date
                        : "N/A"}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Add Service Button */}
              <div className="flex justify-end mb-4">
                <Button onClick={() => setShowAddServiceDialog(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Service Record
                </Button>
              </div>

              {/* Service History Table */}
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Invoice #</TableHead>
                        <TableHead>Notes</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedProvider.serviceHistory.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                            No service history recorded.
                          </TableCell>
                        </TableRow>
                      ) : (
                        selectedProvider.serviceHistory.map((service) => (
                          <TableRow key={service.id}>
                            <TableCell className="font-medium">{service.date}</TableCell>
                            <TableCell>{service.description}</TableCell>
                            <TableCell className="text-muted-foreground">{service.invoiceNumber || "—"}</TableCell>
                            <TableCell className="text-muted-foreground text-sm">{service.notes || "—"}</TableCell>
                            <TableCell className="text-right font-medium">
                              ${service.amount.toFixed(2)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Add Service Dialog */}
        <Dialog open={showAddServiceDialog} onOpenChange={setShowAddServiceDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add Service Record</DialogTitle>
              <DialogDescription>
                Record a service performed by {selectedProvider.companyName}.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4 py-4">
              <div className="flex flex-col gap-1.5">
                <Label>Date *</Label>
                <Input
                  type="date"
                  value={newService.date}
                  onChange={(e) => setNewService((prev) => ({ ...prev, date: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Description *</Label>
                <Input
                  value={newService.description}
                  onChange={(e) => setNewService((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="What service was performed?"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label>Amount *</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={newService.amount}
                    onChange={(e) => setNewService((prev) => ({ ...prev, amount: e.target.value }))}
                    placeholder="0.00"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Invoice #</Label>
                  <Input
                    value={newService.invoiceNumber}
                    onChange={(e) => setNewService((prev) => ({ ...prev, invoiceNumber: e.target.value }))}
                    placeholder="Optional"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Notes</Label>
                <Textarea
                  value={newService.notes}
                  onChange={(e) => setNewService((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder="Additional notes about the service"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddServiceDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddService}>Add Record</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    )
  }

  // List View
  return (
    <>
      <Header title="Service Providers" />
      <div className="flex flex-col gap-6 p-6">
        {/* Stats */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Providers</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{providers.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active Agreements</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{providers.filter((p) => p.serviceAgreement.includes("Active") || p.serviceAgreement.includes("Annual")).length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">On-Call</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{providers.filter((p) => p.serviceAgreement.includes("On-call")).length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Service Types</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{new Set(providers.map((p) => p.serviceType)).size}</p>
            </CardContent>
          </Card>
        </div>

        {/* Search and Add */}
        <div className="flex items-center justify-between gap-4">
          <div className="relative w-[320px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search providers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button className="gap-1.5" onClick={() => setShowAddDialog(true)}>
            <Plus className="h-4 w-4" />
            Add Provider
          </Button>
        </div>

        {/* Providers Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company Name</TableHead>
                  <TableHead>Contact Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Service Type</TableHead>
                  <TableHead>Agreement</TableHead>
                  <TableHead className="w-[80px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProviders.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      No service providers found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProviders.map((provider) => (
                    <TableRow key={provider.id}>
                      <TableCell>
                        <button
                          onClick={() => setSelectedProvider(provider)}
                          className="font-medium text-primary hover:underline text-left"
                        >
                          {provider.companyName}
                        </button>
                      </TableCell>
                      <TableCell>{provider.contactName}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                          {provider.phone}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                          {provider.email}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{provider.serviceType}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{provider.serviceAgreement}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setSelectedProvider(provider)}>
                              <Eye className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedProvider(provider)
                                setIsEditing(true)
                                setEditForm(provider)
                              }}
                            >
                              <Pencil className="mr-2 h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => handleDeleteProvider(provider.id)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
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
      </div>

      {/* Add Provider Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Service Provider</DialogTitle>
            <DialogDescription>
              Add a new contractor or service provider to the directory.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="flex flex-col gap-1.5">
              <Label>Company Name *</Label>
              <Input
                value={newProvider.companyName}
                onChange={(e) => setNewProvider((prev) => ({ ...prev, companyName: e.target.value }))}
                placeholder="e.g., CleanPro Services"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Contact Name *</Label>
              <Input
                value={newProvider.contactName}
                onChange={(e) => setNewProvider((prev) => ({ ...prev, contactName: e.target.value }))}
                placeholder="e.g., John Smith"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Phone #</Label>
              <Input
                value={newProvider.phone}
                onChange={(e) => setNewProvider((prev) => ({ ...prev, phone: e.target.value }))}
                placeholder="(555) 123-4567"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Email</Label>
              <Input
                type="email"
                value={newProvider.email}
                onChange={(e) => setNewProvider((prev) => ({ ...prev, email: e.target.value }))}
                placeholder="contact@company.com"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Website</Label>
              <Input
                value={newProvider.website}
                onChange={(e) => setNewProvider((prev) => ({ ...prev, website: e.target.value }))}
                placeholder="https://company.com"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Service Type</Label>
              <Input
                value={newProvider.serviceType}
                onChange={(e) => setNewProvider((prev) => ({ ...prev, serviceType: e.target.value }))}
                placeholder="e.g., Plumbing, HVAC, Electrical"
              />
            </div>
            <div className="col-span-2 flex flex-col gap-1.5">
              <Label>Service Agreement</Label>
              <Input
                value={newProvider.serviceAgreement}
                onChange={(e) => setNewProvider((prev) => ({ ...prev, serviceAgreement: e.target.value }))}
                placeholder="e.g., Annual - Expires 12/2024"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Account #</Label>
              <Input
                value={newProvider.accountNumber}
                onChange={(e) => setNewProvider((prev) => ({ ...prev, accountNumber: e.target.value }))}
                placeholder="Account number"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Username</Label>
              <Input
                value={newProvider.username}
                onChange={(e) => setNewProvider((prev) => ({ ...prev, username: e.target.value }))}
                placeholder="Portal username"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Password</Label>
              <Input
                type="password"
                value={newProvider.password}
                onChange={(e) => setNewProvider((prev) => ({ ...prev, password: e.target.value }))}
                placeholder="Portal password"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Security Code</Label>
              <Input
                value={newProvider.securityCode}
                onChange={(e) => setNewProvider((prev) => ({ ...prev, securityCode: e.target.value }))}
                placeholder="PIN or security code"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddProvider}>Add Provider</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
