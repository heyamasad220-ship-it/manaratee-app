"use client"

import { useState } from "react"
import { Header } from "@/components/layout/header"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Download, Heart, DollarSign, Users, TrendingUp, FileText, Send, Search, Printer } from "lucide-react"
import { cn } from "@/lib/utils"

const reportsTabs = ["Overview", "Donations", "Donors", "Campaigns", "Tax Receipts"] as const
type ReportsTab = (typeof reportsTabs)[number]

const taxReceiptDonors = [
  { id: "d-1", name: "Ahmed Foundation", type: "Organization", email: "info@ahmedfoundation.org", totalDonations: "$25,000", donationCount: 12, receiptStatus: "Not Generated", lastReceipt: null },
  { id: "d-2", name: "Mohamed Ali", type: "Individual", email: "mohamed.ali@email.com", totalDonations: "$12,500", donationCount: 24, receiptStatus: "Generated", lastReceipt: "2025" },
  { id: "d-3", name: "Sarah Johnson", type: "Individual", email: "sarah.j@email.com", totalDonations: "$8,200", donationCount: 8, receiptStatus: "Sent", lastReceipt: "2025" },
  { id: "d-4", name: "Community Trust", type: "Organization", email: "contact@communitytrust.org", totalDonations: "$10,000", donationCount: 4, receiptStatus: "Generated", lastReceipt: "2025" },
  { id: "d-5", name: "Fatima Hassan", type: "Individual", email: "fatima.h@email.com", totalDonations: "$3,500", donationCount: 14, receiptStatus: "Not Generated", lastReceipt: null },
  { id: "d-6", name: "Omar Khan", type: "Individual", email: "omar.khan@email.com", totalDonations: "$6,800", donationCount: 18, receiptStatus: "Sent", lastReceipt: "2025" },
  { id: "d-7", name: "Islamic Relief Fund", type: "Organization", email: "donations@islamicrelief.org", totalDonations: "$15,000", donationCount: 6, receiptStatus: "Not Generated", lastReceipt: "2024" },
]

export default function DonationsReportsPage() {
  const [activeTab, setActiveTab] = useState<ReportsTab>("Overview")
  const [dateRange, setDateRange] = useState("30d")
  const [taxYear, setTaxYear] = useState("2025")
  const [taxSearch, setTaxSearch] = useState("")
  const [selectedDonors, setSelectedDonors] = useState<string[]>([])
  const [showPreviewDialog, setShowPreviewDialog] = useState(false)
  const [previewDonor, setPreviewDonor] = useState<typeof taxReceiptDonors[0] | null>(null)

  const filteredTaxDonors = taxReceiptDonors.filter((donor) =>
    donor.name.toLowerCase().includes(taxSearch.toLowerCase()) ||
    donor.email.toLowerCase().includes(taxSearch.toLowerCase())
  )

  const handleSelectAll = () => {
    if (selectedDonors.length === filteredTaxDonors.length) {
      setSelectedDonors([])
    } else {
      setSelectedDonors(filteredTaxDonors.map((d) => d.id))
    }
  }

  const handleSelectDonor = (id: string) => {
    if (selectedDonors.includes(id)) {
      setSelectedDonors(selectedDonors.filter((d) => d !== id))
    } else {
      setSelectedDonors([...selectedDonors, id])
    }
  }

  return (
    <>
      <Header title="Donations Reports" />
      <div className="p-6">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex gap-0 border-b border-border">
            {reportsTabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "relative px-4 py-2.5 text-sm font-medium transition-colors",
                  activeTab === tab
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab}
                {activeTab === tab && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary" />
                )}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
                <SelectItem value="1y">Last year</SelectItem>
                <SelectItem value="ytd">Year to date</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          </div>
        </div>

        {activeTab === "Overview" && (
          <div className="flex flex-col gap-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Donations</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">$128,450</div>
                  <p className="text-xs text-muted-foreground">
                    <span className="text-green-600">+18%</span> from last period
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Active Donors</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">342</div>
                  <p className="text-xs text-muted-foreground">
                    <span className="text-green-600">+24</span> new this period
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Avg. Donation</CardTitle>
                  <Heart className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">$375</div>
                  <p className="text-xs text-muted-foreground">
                    <span className="text-green-600">+8%</span> from last period
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Pledge Fulfillment</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">87%</div>
                  <p className="text-xs text-muted-foreground">
                    <span className="text-green-600">+5%</span> from last period
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Donations by Category</CardTitle>
                  <CardDescription>Breakdown by donation category</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Category</TableHead>
                        <TableHead>Count</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell className="font-medium">Zakat</TableCell>
                        <TableCell>156</TableCell>
                        <TableCell className="text-right">$52,400</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Sadaqah</TableCell>
                        <TableCell>89</TableCell>
                        <TableCell className="text-right">$28,200</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Operations</TableCell>
                        <TableCell>64</TableCell>
                        <TableCell className="text-right">$24,850</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Building Fund</TableCell>
                        <TableCell>33</TableCell>
                        <TableCell className="text-right">$23,000</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Top Donors</CardTitle>
                  <CardDescription>Highest contributors this period</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Donor</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell className="font-medium">Ahmed Foundation</TableCell>
                        <TableCell>Organization</TableCell>
                        <TableCell className="text-right">$25,000</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Mohamed Ali</TableCell>
                        <TableCell>Individual</TableCell>
                        <TableCell className="text-right">$12,500</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell className="font-medium">Community Trust</TableCell>
                        <TableCell>Organization</TableCell>
                        <TableCell className="text-right">$10,000</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {activeTab === "Donations" && (
          <Card>
            <CardHeader>
              <CardTitle>Donation Transactions</CardTitle>
              <CardDescription>All donations received this period</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Donor</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>Mar 1, 2026</TableCell>
                    <TableCell className="font-medium">Ahmed Foundation</TableCell>
                    <TableCell>Building Fund</TableCell>
                    <TableCell>Bank Transfer</TableCell>
                    <TableCell className="text-right">$10,000</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Feb 28, 2026</TableCell>
                    <TableCell className="font-medium">Sarah Johnson</TableCell>
                    <TableCell>Zakat</TableCell>
                    <TableCell>Credit Card</TableCell>
                    <TableCell className="text-right">$2,500</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Feb 27, 2026</TableCell>
                    <TableCell className="font-medium">Mohamed Ali</TableCell>
                    <TableCell>Operations</TableCell>
                    <TableCell>Check</TableCell>
                    <TableCell className="text-right">$1,500</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Feb 26, 2026</TableCell>
                    <TableCell className="font-medium">Anonymous</TableCell>
                    <TableCell>Sadaqah</TableCell>
                    <TableCell>Cash</TableCell>
                    <TableCell className="text-right">$500</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {activeTab === "Donors" && (
          <Card>
            <CardHeader>
              <CardTitle>Donor Analysis</CardTitle>
              <CardDescription>Donor giving patterns and retention</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Donor</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>First Donation</TableHead>
                    <TableHead>Donations</TableHead>
                    <TableHead>Frequency</TableHead>
                    <TableHead className="text-right">Lifetime Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">Ahmed Foundation</TableCell>
                    <TableCell>Organization</TableCell>
                    <TableCell>Jan 2022</TableCell>
                    <TableCell>48</TableCell>
                    <TableCell>Monthly</TableCell>
                    <TableCell className="text-right">$125,000</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Mohamed Ali</TableCell>
                    <TableCell>Individual</TableCell>
                    <TableCell>Mar 2020</TableCell>
                    <TableCell>36</TableCell>
                    <TableCell>Monthly</TableCell>
                    <TableCell className="text-right">$54,000</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Sarah Johnson</TableCell>
                    <TableCell>Individual</TableCell>
                    <TableCell>Jun 2023</TableCell>
                    <TableCell>12</TableCell>
                    <TableCell>Quarterly</TableCell>
                    <TableCell className="text-right">$18,000</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {activeTab === "Campaigns" && (
          <Card>
            <CardHeader>
              <CardTitle>Campaign Performance</CardTitle>
              <CardDescription>Fundraising campaign results</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campaign</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Goal</TableHead>
                    <TableHead>Raised</TableHead>
                    <TableHead>Donors</TableHead>
                    <TableHead className="text-right">Progress</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">Ramadan 2026</TableCell>
                    <TableCell><span className="text-green-600">Active</span></TableCell>
                    <TableCell>$100,000</TableCell>
                    <TableCell>$72,500</TableCell>
                    <TableCell>245</TableCell>
                    <TableCell className="text-right">73%</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Building Expansion</TableCell>
                    <TableCell><span className="text-green-600">Active</span></TableCell>
                    <TableCell>$500,000</TableCell>
                    <TableCell>$325,000</TableCell>
                    <TableCell>89</TableCell>
                    <TableCell className="text-right">65%</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Youth Programs 2025</TableCell>
                    <TableCell><span className="text-muted-foreground">Completed</span></TableCell>
                    <TableCell>$50,000</TableCell>
                    <TableCell>$58,200</TableCell>
                    <TableCell>156</TableCell>
                    <TableCell className="text-right text-green-600">116%</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {activeTab === "Tax Receipts" && (
          <div className="flex flex-col gap-6">
            {/* Stats Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Donors</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">342</div>
                  <p className="text-xs text-muted-foreground">Eligible for {taxYear} receipts</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Receipts Generated</CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">156</div>
                  <p className="text-xs text-muted-foreground">46% of eligible donors</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Receipts Sent</CardTitle>
                  <Send className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">89</div>
                  <p className="text-xs text-muted-foreground">26% of eligible donors</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Donations</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">$428,500</div>
                  <p className="text-xs text-muted-foreground">For tax year {taxYear}</p>
                </CardContent>
              </Card>
            </div>

            {/* Controls */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Select value={taxYear} onValueChange={setTaxYear}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Tax Year" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2025">2025</SelectItem>
                    <SelectItem value="2024">2024</SelectItem>
                    <SelectItem value="2023">2023</SelectItem>
                  </SelectContent>
                </Select>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search donors..."
                    value={taxSearch}
                    onChange={(e) => setTaxSearch(e.target.value)}
                    className="w-full pl-9 sm:w-[250px]"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  disabled={selectedDonors.length === 0}
                  onClick={() => {}}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Generate Selected ({selectedDonors.length})
                </Button>
                <Button
                  variant="outline"
                  disabled={selectedDonors.length === 0}
                  onClick={() => {}}
                >
                  <Send className="mr-2 h-4 w-4" />
                  Email Selected
                </Button>
                <Button onClick={() => {}}>
                  <FileText className="mr-2 h-4 w-4" />
                  Generate All
                </Button>
              </div>
            </div>

            {/* Donors Table */}
            <Card>
              <CardHeader>
                <CardTitle>Donor Tax Receipts - {taxYear}</CardTitle>
                <CardDescription>Generate and send year-end tax receipts to donors</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">
                        <Checkbox
                          checked={selectedDonors.length === filteredTaxDonors.length && filteredTaxDonors.length > 0}
                          onCheckedChange={handleSelectAll}
                        />
                      </TableHead>
                      <TableHead>Donor</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Donations</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTaxDonors.map((donor) => (
                      <TableRow key={donor.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedDonors.includes(donor.id)}
                            onCheckedChange={() => handleSelectDonor(donor.id)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{donor.name}</TableCell>
                        <TableCell>{donor.type}</TableCell>
                        <TableCell className="text-muted-foreground">{donor.email}</TableCell>
                        <TableCell>{donor.donationCount}</TableCell>
                        <TableCell className="font-medium">{donor.totalDonations}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              donor.receiptStatus === "Sent"
                                ? "default"
                                : donor.receiptStatus === "Generated"
                                ? "secondary"
                                : "outline"
                            }
                            className={
                              donor.receiptStatus === "Sent"
                                ? "bg-green-100 text-green-800 hover:bg-green-100"
                                : ""
                            }
                          >
                            {donor.receiptStatus}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setPreviewDonor(donor)
                                setShowPreviewDialog(true)
                              }}
                            >
                              <FileText className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm">
                              <Printer className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm">
                              <Send className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Receipt Preview Dialog */}
      <Dialog open={showPreviewDialog} onOpenChange={setShowPreviewDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Tax Receipt Preview</DialogTitle>
            <DialogDescription>
              Year-end donation receipt for {previewDonor?.name}
            </DialogDescription>
          </DialogHeader>
          {previewDonor && (
            <div className="rounded-lg border bg-white p-6">
              <div className="mb-6 text-center">
                <h2 className="text-xl font-bold">Organization Name</h2>
                <p className="text-sm text-muted-foreground">123 Main Street, City, State 12345</p>
                <p className="text-sm text-muted-foreground">Tax ID: 12-3456789</p>
              </div>
              <div className="mb-6 text-center">
                <h3 className="text-lg font-semibold">Official Donation Receipt</h3>
                <p className="text-sm text-muted-foreground">For Tax Year {taxYear}</p>
              </div>
              <div className="mb-6 space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Receipt Number:</span>
                  <span className="font-medium">RCP-{taxYear}-{previewDonor.id.split("-")[1].padStart(4, "0")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Date Issued:</span>
                  <span className="font-medium">{new Date().toLocaleDateString()}</span>
                </div>
              </div>
              <div className="mb-6 rounded-md bg-muted/50 p-4">
                <p className="mb-2 font-medium">Donor Information</p>
                <p>{previewDonor.name}</p>
                <p className="text-sm text-muted-foreground">{previewDonor.email}</p>
              </div>
              <div className="mb-6">
                <p className="mb-2 font-medium">Donation Summary</p>
                <div className="rounded-md border">
                  <div className="flex justify-between border-b p-3">
                    <span>Total Donations ({previewDonor.donationCount} transactions)</span>
                    <span className="font-bold">{previewDonor.totalDonations}</span>
                  </div>
                  <div className="flex justify-between bg-muted/30 p-3">
                    <span className="font-medium">Tax Deductible Amount</span>
                    <span className="font-bold">{previewDonor.totalDonations}</span>
                  </div>
                </div>
              </div>
              <div className="text-center text-xs text-muted-foreground">
                <p>This receipt is issued for income tax purposes.</p>
                <p>No goods or services were provided in exchange for these donations.</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreviewDialog(false)}>
              Close
            </Button>
            <Button variant="outline">
              <Printer className="mr-2 h-4 w-4" />
              Print
            </Button>
            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Download PDF
            </Button>
            <Button>
              <Send className="mr-2 h-4 w-4" />
              Email to Donor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
