"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Pencil, Trash2 } from "lucide-react"

const defaultPolicies = [
  { id: "p-1", name: "Vacation", daysPerYear: 15, carryOver: true, maxCarryOver: 5 },
  { id: "p-2", name: "Sick Leave", daysPerYear: 10, carryOver: false, maxCarryOver: 0 },
  { id: "p-3", name: "Personal Days", daysPerYear: 3, carryOver: false, maxCarryOver: 0 },
  { id: "p-4", name: "Bereavement", daysPerYear: 5, carryOver: false, maxCarryOver: 0 },
  { id: "p-5", name: "Parental Leave", daysPerYear: 60, carryOver: false, maxCarryOver: 0 },
]

export function HrTimeOffPanel() {
  const [policies, setPolicies] = useState(defaultPolicies)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Time Off Policies</h2>
          <p className="text-sm text-muted-foreground">
            Configure leave types and annual allocations for employees.
          </p>
        </div>
        <Button>Add Policy</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Leave Type</TableHead>
                <TableHead>Days Per Year</TableHead>
                <TableHead>Carry Over</TableHead>
                <TableHead>Max Carry Over</TableHead>
                <TableHead className="w-[100px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {policies.map((policy) => (
                <TableRow key={policy.id}>
                  <TableCell className="font-medium">{policy.name}</TableCell>
                  <TableCell>{policy.daysPerYear}</TableCell>
                  <TableCell>{policy.carryOver ? "Yes" : "No"}</TableCell>
                  <TableCell>{policy.carryOver ? `${policy.maxCarryOver} days` : "-"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="size-8">
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground hover:text-red-600"
                        onClick={() => setPolicies(policies.filter((p) => p.id !== policy.id))}
                      >
                        <Trash2 className="size-4" />
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
  )
}
