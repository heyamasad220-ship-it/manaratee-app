"use client"



import { useCallback, useEffect, useState } from "react"

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

import { searchMemberGroupsForDonationPickerAction } from "@/lib/contacts/group-giving-actions"

import { cn } from "@/lib/utils"



type DonationGroupPickerProps = {

  groupContactId: string | null

  groupLabel: string

  onChange: (groupContactId: string | null, label: string) => void

  /** Required to list groups — only groups this contact already belongs to. */

  memberContactId?: string | null

  disabled?: boolean

}



export function DonationGroupPicker({

  groupContactId,

  groupLabel,

  onChange,

  memberContactId = null,

  disabled = false,

}: DonationGroupPickerProps) {

  const [open, setOpen] = useState(false)

  const [search, setSearch] = useState("")

  const [loading, setLoading] = useState(false)

  const [groups, setGroups] = useState<

    Array<{ contactId: string; label: string; full_name: string | null }>

  >([])



  const loadGroups = useCallback(async (term: string) => {

    if (!memberContactId) {

      setGroups([])

      return

    }



    setLoading(true)

    const result = await searchMemberGroupsForDonationPickerAction(memberContactId, term, 30)

    setLoading(false)



    if (!result.success) {

      setGroups([])

      return

    }



    setGroups(

      result.groups.map((group) => ({

        contactId: group.contactId,

        label: group.label,

        full_name: group.full_name,

      }))

    )

  }, [memberContactId])



  useEffect(() => {

    if (!open) return



    const timer = window.setTimeout(() => {

      void loadGroups(search)

    }, 200)



    return () => window.clearTimeout(timer)

  }, [open, search, loadGroups])



  const selectedLabel = groupContactId

    ? groupLabel || groups.find((group) => group.contactId === groupContactId)?.label || "Selected group"

    : "No group (individual only)"



  return (

    <div className="space-y-2">

      <Label>Group (optional)</Label>

      <Popover open={open} onOpenChange={setOpen}>

        <PopoverTrigger asChild>

          <Button

            type="button"

            variant="outline"

            role="combobox"

            aria-expanded={open}

            disabled={disabled || !memberContactId}

            className="w-full justify-between font-normal"

          >

            <span className="truncate">

              {!memberContactId ? "Select a contact first" : selectedLabel}

            </span>

            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />

          </Button>

        </PopoverTrigger>

        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">

          <Command shouldFilter={false}>

            <CommandInput

              placeholder="Search groups..."

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

              <CommandEmpty>Not a member of any matching groups.</CommandEmpty>

              <CommandGroup>

                <CommandItem

                  value="none"

                  onSelect={() => {

                    onChange(null, "")

                    setOpen(false)

                  }}

                >

                  <Check

                    className={cn("mr-2 h-4 w-4", !groupContactId ? "opacity-100" : "opacity-0")}

                  />

                  No group (individual only)

                </CommandItem>

                {groups.map((group) => (

                  <CommandItem

                    key={group.contactId}

                    value={group.contactId}

                    onSelect={() => {

                      onChange(group.contactId, group.label)

                      setOpen(false)

                    }}

                  >

                    <Check

                      className={cn(

                        "mr-2 h-4 w-4",

                        groupContactId === group.contactId ? "opacity-100" : "opacity-0"

                      )}

                    />

                    {group.label}

                  </CommandItem>

                ))}

              </CommandGroup>

            </CommandList>

          </Command>

        </PopoverContent>

      </Popover>

      <p className="text-xs text-muted-foreground">

        Count this gift toward a group total. Only groups this contact belongs to are listed — add

        membership from the group page if needed.

      </p>

    </div>

  )

}


