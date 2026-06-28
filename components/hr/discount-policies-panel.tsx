import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Briefcase,
  Heart,
  Info,
  Plus,
  Shield,
  Trash2,
  UserCheck,
  Users,
} from "lucide-react"
import {
  createDiscountTag,
  deleteDiscountTagFromForm,
  toggleDiscountTagFromForm,
} from "@/lib/discount-tags/discount-tag-actions"

type DiscountTag = {
  id: string
  name: string
  description: string | null
  active: boolean
}

function getTagIcon(name: string) {
  const normalized = name.toLowerCase()

  if (normalized.includes("staff") || normalized.includes("employee")) {
    return Briefcase
  }

  if (normalized.includes("volunteer")) {
    return Heart
  }

  if (normalized.includes("member")) {
    return UserCheck
  }

  if (normalized.includes("board") || normalized.includes("admin")) {
    return Shield
  }

  return Users
}

export function DiscountPoliciesPanel({ tags }: { tags: DiscountTag[] }) {
  return (
    <div className="flex flex-col gap-6">
      <Card className="border-blue-200 bg-blue-50/50">
        <CardContent className="flex items-start gap-3 p-4">
          <Info className="mt-0.5 h-5 w-5 text-blue-600" />
          <div>
            <p className="text-sm font-medium text-blue-800">Discount tags</p>
            <p className="text-sm text-blue-700">
              Discount tags identify groups such as members, staff, volunteers, or scholarship
              recipients. Tags are applied automatically on contact profiles when matching roles
              are earned from activity. Program discount rules use these tags at checkout.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Discount Tags</CardTitle>
            <CardDescription>Manage the customer tags that discount policies can use.</CardDescription>
          </CardHeader>

          <CardContent className="p-0">
            {tags.length === 0 ? (
              <div className="flex min-h-[260px] flex-col items-center justify-center p-8 text-center">
                <Users className="mb-4 h-10 w-10 text-muted-foreground" />
                <h2 className="text-lg font-semibold">No discount tags yet</h2>
                <p className="mt-2 max-w-md text-sm text-muted-foreground">
                  Create tags like Staff, Member, Volunteer, or Scholarship Recipient using the form
                  on the right.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Tag</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {tags.map((tag) => {
                    const TagIcon = getTagIcon(tag.name)

                    return (
                      <TableRow key={tag.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                              <TagIcon className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium">{tag.name}</p>
                              <p className="text-xs text-muted-foreground">Customer discount group</p>
                            </div>
                          </div>
                        </TableCell>

                        <TableCell className="max-w-md">
                          <p className="text-sm text-muted-foreground">
                            {tag.description || "No description provided."}
                          </p>
                        </TableCell>

                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={
                              tag.active
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-muted text-muted-foreground"
                            }
                          >
                            {tag.active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>

                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <form action={toggleDiscountTagFromForm}>
                              <input type="hidden" name="id" value={tag.id} />
                              <input type="hidden" name="active" value={String(!tag.active)} />
                              <Button type="submit" variant="outline" size="sm">
                                {tag.active ? "Deactivate" : "Activate"}
                              </Button>
                            </form>

                            <form action={deleteDiscountTagFromForm}>
                              <input type="hidden" name="id" value={tag.id} />
                              <Button type="submit" variant="ghost" size="sm">
                                <Trash2 className="h-4 w-4 text-muted-foreground hover:text-red-600" />
                              </Button>
                            </form>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Create Discount Tag</CardTitle>
            <CardDescription>Add a customer group that can receive discounts later.</CardDescription>
          </CardHeader>

          <CardContent>
            <form action={createDiscountTag} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="discount-tag-name">Tag Name *</Label>
                <Input id="discount-tag-name" name="name" required placeholder="Staff" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="discount-tag-description">Description</Label>
                <Input
                  id="discount-tag-description"
                  name="description"
                  placeholder="People who should receive the staff discount"
                />
              </div>

              <Button type="submit" className="w-full">
                <Plus className="mr-2 h-4 w-4" />
                Add Tag
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
