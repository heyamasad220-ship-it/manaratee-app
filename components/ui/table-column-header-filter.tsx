"use client"

import { useState, type ReactNode } from "react"
import { ArrowUpDown, Filter } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

type TableColumnHeaderFilterHelpers = {
  close: () => void
}

type TableColumnHeaderFilterProps = {
  label: string
  active?: boolean
  children: ReactNode | ((helpers: TableColumnHeaderFilterHelpers) => ReactNode)
  trailing?: ReactNode
}

export function TableColumnHeaderFilter({
  label,
  active = false,
  children,
  trailing,
}: TableColumnHeaderFilterProps) {
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)
  const content = typeof children === "function" ? children({ close }) : children

  return (
    <div className="flex items-center gap-1">
      <span className="font-medium">{label}</span>
      {trailing}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(
              "h-7 w-7 shrink-0",
              active && "rounded-full bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary"
            )}
            aria-label={`Filter ${label}`}
          >
            <Filter className="h-3.5 w-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-3" align="start">
          {content}
        </PopoverContent>
      </Popover>
    </div>
  )
}

type TableColumnHeaderSortProps = {
  label: string
  value: string
  active?: boolean
  options: { value: string; label: string }[]
  onChange: (value: string) => void
}

export function TableColumnHeaderSort({
  label,
  value,
  active = false,
  options,
  onChange,
}: TableColumnHeaderSortProps) {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            "h-7 w-7 shrink-0",
            active && "rounded-full bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary"
          )}
          aria-label={`Sort ${label}`}
        >
          <ArrowUpDown className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-3" align="start">
        <Select
          value={value}
          onValueChange={(next) => {
            onChange(next)
            setOpen(false)
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </PopoverContent>
    </Popover>
  )
}
