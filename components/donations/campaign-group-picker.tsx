"use client"

import { useEffect, useMemo, useState } from "react"
import { Check, ChevronsUpDown, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { listCampaignGroupOptionsAction } from "@/lib/donations/campaign-group-actions"
import { cn } from "@/lib/utils"

type CampaignGroupPickerProps = {
  campaignId: string | null
  groupId: string | null
  groupLabel: string
  onChange: (groupId: string | null, label: string) => void
  disabled?: boolean
}

export function CampaignGroupPicker({
  campaignId,
  groupId,
  groupLabel,
  onChange,
  disabled = false,
}: CampaignGroupPickerProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(false)
  const [groups, setGroups] = useState<Array<{ id: string; name: string }>>([])

  useEffect(() => {
    if (!campaignId) {
      setGroups([])
      return
    }

    let cancelled = false
    setLoading(true)
    void listCampaignGroupOptionsAction(campaignId).then((result) => {
      if (cancelled) return
      setLoading(false)
      setGroups(result.success ? result.groups : [])
    })

    return () => {
      cancelled = true
    }
  }, [campaignId])

  const visibleGroups = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return groups
    return groups.filter((group) => group.name.toLowerCase().includes(term))
  }, [groups, search])

  const selectedLabel = groupId
    ? groupLabel || groups.find((group) => group.id === groupId)?.name || "Selected group"
    : "No campaign group"

  return (
    <div className="space-y-2">
      <Label>Campaign group</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled || !campaignId}
            className="w-full justify-between font-normal"
          >
            <span className="truncate">
              {!campaignId ? "Select a campaign first" : selectedLabel}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Search campaign groups..."
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              {loading ? (
                <div className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading groups...
                </div>
              ) : null}
              <CommandEmpty>No matching campaign groups.</CommandEmpty>
              <CommandGroup>
                <CommandItem
                  value="none"
                  onSelect={() => {
                    onChange(null, "")
                    setOpen(false)
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", !groupId ? "opacity-100" : "opacity-0")} />
                  No campaign group
                </CommandItem>
                {visibleGroups.map((group) => (
                  <CommandItem
                    key={group.id}
                    value={group.id}
                    onSelect={() => {
                      onChange(group.id, group.name)
                      setOpen(false)
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        groupId === group.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {group.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}
