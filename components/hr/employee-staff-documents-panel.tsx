"use client"

import * as React from "react"
import { useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertCircle,
  CheckCircle2,
  Download,
  Eye,
  FileText,
  MoreHorizontal,
  Search,
  Timer,
  Trash2,
  Upload,
  XCircle,
} from "lucide-react"

type StaffDocumentStatus = "verified" | "pending" | "missing" | "expired"

type StaffDocument = {
  id: string
  document_type: string
  status: StaffDocumentStatus
  uploaded_at: string | null
  expires_at: string | null
}

function formatShortDate(date: string | null) {
  if (!date) return "-"
  const parsedDate = new Date(`${date.slice(0, 10)}T00:00:00`)
  return parsedDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function getDocumentStatusBadge(status: StaffDocumentStatus) {
  if (status === "verified") {
    return (
      <Badge className="gap-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-50">
        <CheckCircle2 className="size-3" />
        Verified
      </Badge>
    )
  }
  if (status === "pending") {
    return (
      <Badge variant="outline" className="gap-1 border-amber-200 text-amber-700">
        <Timer className="size-3" />
        Pending
      </Badge>
    )
  }
  if (status === "expired") {
    return (
      <Badge variant="destructive" className="gap-1">
        <AlertCircle className="size-3" />
        Expired
      </Badge>
    )
  }
  return (
    <Badge variant="secondary" className="gap-1">
      <XCircle className="size-3" />
      Missing
    </Badge>
  )
}

export function EmployeeStaffDocumentsPanel({
  organizationId,
  staffId,
}: {
  organizationId: string | null
  staffId: string
}) {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [documents, setDocuments] = useState<StaffDocument[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [typeFilter, setTypeFilter] = useState("all")

  async function fetchData() {
    if (!organizationId) {
      setDocuments([])
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from("staff_documents")
        .select("id, document_type, status, uploaded_at, expires_at")
        .eq("organization_id", organizationId)
        .eq("staff_id", staffId)

      if (error) {
        if (error.code !== "42P01" && error.code !== "42703") {
          console.warn("Staff documents could not be loaded:", error.message)
        }
        setDocuments([])
      } else {
        setDocuments(
          (data || []).map((item: any) => ({
            id: item.id,
            document_type: item.document_type || "Document",
            status: item.status || "pending",
            uploaded_at: item.uploaded_at || null,
            expires_at: item.expires_at || null,
          }))
        )
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, staffId])

  const documentTypes = useMemo(() => {
    return Array.from(new Set(documents.map((document) => document.document_type))).sort()
  }, [documents])

  const filteredDocuments = useMemo(() => {
    const search = searchQuery.toLowerCase()
    return documents.filter((document) => {
      const matchesSearch = document.document_type.toLowerCase().includes(search)
      const matchesStatus = statusFilter === "all" || document.status === statusFilter
      const matchesType = typeFilter === "all" || document.document_type === typeFilter
      return Boolean(matchesSearch && matchesStatus && matchesType)
    })
  }, [documents, searchQuery, statusFilter, typeFilter])

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle>Documents</CardTitle>
          <p className="text-sm text-muted-foreground">
            Track uploads, expirations, and verification status for this employee.
          </p>
        </div>
        <Button className="bg-black text-white hover:bg-black/90" size="sm">
          <Upload className="mr-2 size-4" />
          Upload Document
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by document type..."
              className="pl-9"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-full lg:w-[220px]">
              <FileText className="mr-2 size-4" />
              <SelectValue placeholder="All Document Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Document Types</SelectItem>
              {documentTypes.map((documentType) => (
                <SelectItem key={documentType} value={documentType}>
                  {documentType}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full lg:w-[200px]">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="verified">Verified</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="missing">Missing</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Document</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Uploaded</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead className="w-[120px] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  Loading documents...
                </TableCell>
              </TableRow>
            ) : filteredDocuments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  No documents found for this employee.
                </TableCell>
              </TableRow>
            ) : (
              filteredDocuments.map((document) => (
                <TableRow key={document.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <FileText className="size-4 text-muted-foreground" />
                      <span>{document.document_type}</span>
                    </div>
                  </TableCell>
                  <TableCell>{getDocumentStatusBadge(document.status)}</TableCell>
                  <TableCell>{formatShortDate(document.uploaded_at)}</TableCell>
                  <TableCell>{formatShortDate(document.expires_at)}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" aria-label="View document">
                        <Eye className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon" aria-label="Download document">
                        <Download className="size-4" />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label="More actions">
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Eye className="mr-2 size-4" />
                            View
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Download className="mr-2 size-4" />
                            Download
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-red-600">
                            <Trash2 className="mr-2 size-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
