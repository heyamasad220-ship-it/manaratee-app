"use client"

import { useMemo, useState, useTransition } from "react"
import {
  Baby,
  CalendarDays,
  Heart,
  Loader2,
  MapPin,
  Store,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { formatChildcareAgeGroupLabel } from "@/lib/events/event-service-requirements"
import {
  registerChildForOpportunityChildcare,
  submitServiceParticipation,
} from "@/lib/service-participations/service-participation-actions"
import type { ContactServiceEligibility } from "@/lib/service-participations/service-participation-eligibility"
import type {
  ServiceOpportunity,
  ServiceParticipationType,
} from "@/lib/service-participations/service-participation-types"
import {
  SERVICE_PARTICIPATION_TYPE_LABELS,
} from "@/lib/service-participations/service-participation-types"

type OpportunitiesClientProps = {
  opportunities: ServiceOpportunity[]
  eligibility: ContactServiceEligibility | null
}

function formatWhen(opportunity: ServiceOpportunity) {
  if (!opportunity.startsAt) {
    return "Date TBD"
  }

  const start = new Date(opportunity.startsAt)
  const end = opportunity.endsAt ? new Date(opportunity.endsAt) : null

  const dateLabel = start.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  })

  const timeLabel = start.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  })

  if (!end) {
    return `${dateLabel} · ${timeLabel}`
  }

  const endTime = end.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  })

  return `${dateLabel} · ${timeLabel} – ${endTime}`
}

function typeIcon(type: ServiceParticipationType) {
  switch (type) {
    case "volunteer":
      return Heart
    case "childcare_provider":
      return Baby
    case "vendor":
      return Store
  }
}

export function OpportunitiesClient({
  opportunities: initialOpportunities,
  eligibility,
}: OpportunitiesClientProps) {
  const [opportunities, setOpportunities] = useState(initialOpportunities)
  const [selected, setSelected] = useState<ServiceOpportunity | null>(null)
  const [participationType, setParticipationType] =
    useState<ServiceParticipationType>("volunteer")
  const [volunteerRole, setVolunteerRole] = useState("")
  const [notes, setNotes] = useState("")
  const [childName, setChildName] = useState("")
  const [childAge, setChildAge] = useState("")
  const [allergies, setAllergies] = useState("")
  const [childNotes, setChildNotes] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const roleOptions = useMemo(() => {
    if (!selected) return []
    return selected.serviceRequirements.volunteers?.roles || []
  }, [selected])

  function openOpportunity(opportunity: ServiceOpportunity) {
    setSelected(opportunity)
    setParticipationType(opportunity.eligibleParticipationTypes[0] || "volunteer")
    setVolunteerRole("")
    setNotes("")
    setChildName("")
    setChildAge("")
    setAllergies("")
    setChildNotes("")
    setError(null)
  }

  function markSignedUp(
    opportunity: ServiceOpportunity,
    type: ServiceParticipationType
  ) {
    setOpportunities((current) =>
      current.map((item) =>
        item.sourceId === opportunity.sourceId &&
        item.sourceType === opportunity.sourceType
          ? {
              ...item,
              myParticipationTypes: item.myParticipationTypes.includes(type)
                ? item.myParticipationTypes
                : [...item.myParticipationTypes, type],
            }
          : item
      )
    )
  }

  function handleParticipationSubmit() {
    if (!selected) return

    startTransition(async () => {
      setError(null)
      try {
        await submitServiceParticipation({
          sourceType: selected.sourceType,
          sourceId: selected.sourceId,
          participationType,
          volunteerRole:
            participationType === "volunteer" ? volunteerRole || null : null,
          notes: notes || null,
        })
        markSignedUp(selected, participationType)
        setSelected(null)
      } catch (submitError) {
        setError(
          submitError instanceof Error
            ? submitError.message
            : "Could not submit sign-up."
        )
      }
    })
  }

  function handleChildRegistrationSubmit() {
    if (!selected) return

    startTransition(async () => {
      setError(null)
      try {
        await registerChildForOpportunityChildcare({
          sourceType: selected.sourceType,
          sourceId: selected.sourceId,
          childName,
          childAge: childAge ? Number.parseInt(childAge, 10) : null,
          allergies: allergies || null,
          notes: childNotes || null,
        })
        setSelected(null)
      } catch (submitError) {
        setError(
          submitError instanceof Error
            ? submitError.message
            : "Could not register child."
        )
      }
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Opportunities</h1>
        <p className="text-sm text-muted-foreground">
          Sign up to volunteer, provide childcare, vend at events, or register your
          child for offered childcare. All sign-ups stay pending until a coordinator
          confirms them.
        </p>
        {eligibility ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {eligibility.isVolunteer ? (
              <Badge variant="secondary">Volunteer</Badge>
            ) : null}
            {eligibility.isChildcareProvider ? (
              <Badge variant="secondary">Childcare provider</Badge>
            ) : null}
            {eligibility.isVendor ? (
              <Badge variant="secondary">Vendor</Badge>
            ) : null}
          </div>
        ) : null}
      </div>

      {opportunities.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No open opportunities right now. Confirmed events and active programs
            with service needs will appear here.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {opportunities.map((opportunity) => (
            <Card key={`${opportunity.sourceType}-${opportunity.sourceId}`}>
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg">{opportunity.title}</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {opportunity.sourceType === "internal_event"
                        ? "Internal event"
                        : "Program"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {opportunity.requiresVolunteers ? (
                      <Badge variant="outline" className="gap-1">
                        <Heart className="h-3 w-3" />
                        Volunteers
                      </Badge>
                    ) : null}
                    {opportunity.requiresChildcare ? (
                      <Badge variant="outline" className="gap-1">
                        <Baby className="h-3 w-3" />
                        Childcare
                      </Badge>
                    ) : null}
                    {opportunity.requiresVendors ? (
                      <Badge variant="outline" className="gap-1">
                        <Store className="h-3 w-3" />
                        Vendors
                      </Badge>
                    ) : null}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays className="h-4 w-4" />
                    {formatWhen(opportunity)}
                  </span>
                  {opportunity.locationLabel ? (
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="h-4 w-4" />
                      {opportunity.locationLabel}
                    </span>
                  ) : null}
                </div>

                {opportunity.description ? (
                  <p className="text-sm text-muted-foreground">
                    {opportunity.description}
                  </p>
                ) : null}

                {opportunity.myParticipationTypes.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {opportunity.myParticipationTypes.map((type) => {
                      const Icon = typeIcon(type)
                      return (
                        <Badge key={type} className="gap-1">
                          <Icon className="h-3 w-3" />
                          {SERVICE_PARTICIPATION_TYPE_LABELS[type]} — pending
                        </Badge>
                      )
                    })}
                  </div>
                ) : null}

                <Button variant="outline" onClick={() => openOpportunity(opportunity)}>
                  View details & sign up
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          {selected ? (
            <>
              <DialogHeader>
                <DialogTitle>{selected.title}</DialogTitle>
                <DialogDescription>{formatWhen(selected)}</DialogDescription>
              </DialogHeader>

              {error ? (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </div>
              ) : null}

              {selected.eligibleParticipationTypes.length > 0 ? (
                <div className="space-y-4 rounded-lg border p-4">
                  <p className="text-sm font-medium">Your sign-up</p>
                  <div className="space-y-2">
                    <Label>Participation type</Label>
                    <Select
                      value={participationType}
                      onValueChange={(value) =>
                        setParticipationType(value as ServiceParticipationType)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {selected.eligibleParticipationTypes.map((type) => (
                          <SelectItem key={type} value={type}>
                            {SERVICE_PARTICIPATION_TYPE_LABELS[type]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {participationType === "volunteer" && roleOptions.length > 0 ? (
                    <div className="space-y-2">
                      <Label>Preferred role</Label>
                      <Select value={volunteerRole || undefined} onValueChange={setVolunteerRole}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a role" />
                        </SelectTrigger>
                        <SelectContent>
                          {roleOptions.map((role) => (
                            <SelectItem key={role.name} value={role.name}>
                              {role.name} ({role.slots} slots)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : null}

                  <div className="space-y-2">
                    <Label htmlFor="signup-notes">Notes (optional)</Label>
                    <Textarea
                      id="signup-notes"
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                      rows={2}
                    />
                  </div>

                  <DialogFooter>
                    <Button
                      onClick={handleParticipationSubmit}
                      disabled={
                        isPending ||
                        selected.myParticipationTypes.includes(participationType)
                      }
                    >
                      {isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Submitting...
                        </>
                      ) : selected.myParticipationTypes.includes(participationType) ? (
                        "Already signed up"
                      ) : (
                        "Submit sign-up"
                      )}
                    </Button>
                  </DialogFooter>
                </div>
              ) : null}

              {selected.requiresChildcare ? (
                <div className="space-y-4 rounded-lg border p-4">
                  <div>
                    <p className="text-sm font-medium">Register your child</p>
                    <p className="text-xs text-muted-foreground">
                      Parent registrations are also pending until confirmed.
                    </p>
                  </div>

                  {selected.serviceRequirements.childcare?.ageGroups?.length ? (
                    <ul className="text-xs text-muted-foreground">
                      {selected.serviceRequirements.childcare.ageGroups.map((group) => (
                        <li key={group.ageRange}>
                          {formatChildcareAgeGroupLabel(group.ageRange)} — capacity{" "}
                          {group.capacity}
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="child-name">Child name</Label>
                      <Input
                        id="child-name"
                        value={childName}
                        onChange={(event) => setChildName(event.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="child-age">Child age</Label>
                      <Input
                        id="child-age"
                        type="number"
                        min={0}
                        value={childAge}
                        onChange={(event) => setChildAge(event.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="child-allergies">Allergies</Label>
                    <Input
                      id="child-allergies"
                      value={allergies}
                      onChange={(event) => setAllergies(event.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="child-reg-notes">Notes</Label>
                    <Textarea
                      id="child-reg-notes"
                      value={childNotes}
                      onChange={(event) => setChildNotes(event.target.value)}
                      rows={2}
                    />
                  </div>

                  <Button
                    variant="secondary"
                    onClick={handleChildRegistrationSubmit}
                    disabled={isPending || !childName.trim()}
                  >
                    {isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      "Register child for childcare"
                    )}
                  </Button>
                </div>
              ) : null}
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
