"use client"

import { useState } from "react"
import { Pencil, X, Check, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"

interface CustomerData {
  firstName: string
  lastName: string
  dateOfBirth: string
  gender: string
  phone: string
  email: string
  addressLine1: string
  addressLine2: string
  city: string
  state: string
  zipCode: string
  country: string
  status: string
}

const initialCustomer: CustomerData = {
  firstName: "",
  lastName: "",
  dateOfBirth: "",
  gender: "",
  phone: "",
  email: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  zipCode: "",
  country: "",
  status: "Active",
}

function InfoRow({
  label,
  value,
  isEditing,
  field,
  editData,
  onChange,
  type = "text",
}: {
  label: string
  value: string
  isEditing: boolean
  field: keyof CustomerData
  editData: CustomerData
  onChange: (field: keyof CustomerData, value: string) => void
  type?: string
}) {
  return (
    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-0">
      <Label className="w-40 shrink-0 text-sm text-muted-foreground">
        {label}
      </Label>
      {isEditing ? (
        field === "gender" ? (
          <Select
            value={editData[field]}
            onValueChange={(val) => onChange(field, val)}
          >
            <SelectTrigger className="h-9 max-w-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Male">Male</SelectItem>
              <SelectItem value="Female">Female</SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <Input
            type={type}
            value={editData[field]}
            onChange={(e) => onChange(field, e.target.value)}
            className="h-9 max-w-xs"
          />
        )
      ) : (
        <span className="text-sm font-medium text-foreground">{value}</span>
      )}
    </div>
  )
}

export function CustomerProfileInfo() {
  const [customer, setCustomer] = useState<CustomerData>(initialCustomer)
  const [editData, setEditData] = useState<CustomerData>(initialCustomer)
  const [isEditing, setIsEditing] = useState(false)

  function handleEdit() {
    setEditData({ ...customer })
    setIsEditing(true)
  }

  function handleCancel() {
    setEditData({ ...customer })
    setIsEditing(false)
  }

  function handleSave() {
    setCustomer({ ...editData })
    setIsEditing(false)
  }

  function handleChange(field: keyof CustomerData, value: string) {
    setEditData((prev) => ({ ...prev, [field]: value }))
  }

  const fullName = `${customer.firstName} ${customer.lastName}`
  const initials = `${customer.firstName[0]}${customer.lastName[0]}`

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Profile Header */}
      <div className="flex items-center gap-5">
        <Avatar className="size-16 border-2 border-border">
          <AvatarFallback className="bg-primary/10 text-lg font-semibold text-primary">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-semibold text-foreground">
              {fullName}
            </h2>
            <Badge
              variant={
                customer.status === "Active" ? "default" : "secondary"
              }
              className={
                customer.status === "Active"
                  ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                  : ""
              }
            >
              {customer.status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{customer.email}</p>
        </div>
      </div>

      {/* Personal Information */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base font-semibold">
            Personal Information
          </CardTitle>
          {isEditing ? (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={handleCancel}>
                <X className="mr-1.5 size-4" />
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave}>
                <Check className="mr-1.5 size-4" />
                Save
              </Button>
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={handleEdit}>
              <Pencil className="mr-1.5 size-4" />
              Edit
            </Button>
          )}
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <InfoRow
            label="First Name"
            value={customer.firstName}
            isEditing={isEditing}
            field="firstName"
            editData={editData}
            onChange={handleChange}
          />
          <InfoRow
            label="Last Name"
            value={customer.lastName}
            isEditing={isEditing}
            field="lastName"
            editData={editData}
            onChange={handleChange}
          />
          <InfoRow
            label="Date of Birth"
            value={new Date(customer.dateOfBirth).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
            isEditing={isEditing}
            field="dateOfBirth"
            editData={editData}
            onChange={handleChange}
            type="date"
          />
          <InfoRow
            label="Gender"
            value={customer.gender}
            isEditing={isEditing}
            field="gender"
            editData={editData}
            onChange={handleChange}
          />

          <Separator />

          <InfoRow
            label="Phone"
            value={customer.phone}
            isEditing={isEditing}
            field="phone"
            editData={editData}
            onChange={handleChange}
            type="tel"
          />
          <InfoRow
            label="Email"
            value={customer.email}
            isEditing={isEditing}
            field="email"
            editData={editData}
            onChange={handleChange}
            type="email"
          />

          <Separator />

          <InfoRow
            label="Address Line 1"
            value={customer.addressLine1}
            isEditing={isEditing}
            field="addressLine1"
            editData={editData}
            onChange={handleChange}
          />
          <InfoRow
            label="Address Line 2"
            value={customer.addressLine2}
            isEditing={isEditing}
            field="addressLine2"
            editData={editData}
            onChange={handleChange}
          />
          <InfoRow
            label="City"
            value={customer.city}
            isEditing={isEditing}
            field="city"
            editData={editData}
            onChange={handleChange}
          />
          <InfoRow
            label="State"
            value={customer.state}
            isEditing={isEditing}
            field="state"
            editData={editData}
            onChange={handleChange}
          />
          <InfoRow
            label="Zip Code"
            value={customer.zipCode}
            isEditing={isEditing}
            field="zipCode"
            editData={editData}
            onChange={handleChange}
          />
          <InfoRow
            label="Country"
            value={customer.country}
            isEditing={isEditing}
            field="country"
            editData={editData}
            onChange={handleChange}
          />
        </CardContent>
      </Card>
    </div>
  )
}
