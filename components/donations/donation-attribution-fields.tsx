"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export type DonationAttributionValue = {
  campaignId: string
  categoryId: string
  subcategoryId: string
}

type CampaignOption = { id: string; name: string }
type CategoryOption = {
  id: string
  name: string
  funds: Array<{ id: string; name: string }>
}

type FundOption = {
  id: string
  name: string
  categoryId: string
}

type DonationAttributionFieldsProps = {
  organizationId: string | null
  value: DonationAttributionValue
  onChange: (value: DonationAttributionValue) => void
  showCampaign?: boolean
  showCategory?: boolean
  showFund?: boolean
  disabled?: boolean
}

const NONE = "none"

export function DonationAttributionFields({
  organizationId,
  value,
  onChange,
  showCampaign = true,
  showCategory = true,
  showFund = true,
  disabled = false,
}: DonationAttributionFieldsProps) {
  const supabase = createClient()
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([])
  const [categories, setCategories] = useState<CategoryOption[]>([])
  const [allFunds, setAllFunds] = useState<FundOption[]>([])

  useEffect(() => {
    if (!organizationId) {
      setCampaigns([])
      setCategories([])
      setAllFunds([])
      return
    }

    async function loadOptions() {
      const [campaignsResult, categoriesResult, subcategoriesResult] = await Promise.all([
        supabase
          .from("campaigns")
          .select("id, name")
          .eq("organization_id", organizationId)
          .order("name"),
        supabase
          .from("donation_categories")
          .select("id, name")
          .eq("organization_id", organizationId)
          .order("name"),
        supabase
          .from("donation_subcategories")
          .select("id, name, category_id")
          .eq("organization_id", organizationId)
          .order("name"),
      ])

      setCampaigns((campaignsResult.data || []) as CampaignOption[])

      const subcategories = (subcategoriesResult.data || []) as Array<{
        id: string
        name: string
        category_id: string
      }>

      setAllFunds(
        subcategories.map((fund) => ({
          id: fund.id,
          name: fund.name,
          categoryId: fund.category_id,
        }))
      )

      setCategories(
        (categoriesResult.data || []).map((category) => ({
          id: category.id as string,
          name: category.name as string,
          funds: subcategories
            .filter((fund) => fund.category_id === category.id)
            .map((fund) => ({
              id: fund.id as string,
              name: fund.name as string,
            })),
        }))
      )
    }

    loadOptions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId])

  const usesFundFirstAttribution = allFunds.length > 0

  function update(patch: Partial<DonationAttributionValue>) {
    onChange({ ...value, ...patch })
  }

  function handleFundChange(next: string) {
    if (next === NONE) {
      update({ subcategoryId: "", categoryId: "" })
      return
    }

    const selectedFund = allFunds.find((fund) => fund.id === next)
    update({
      subcategoryId: next,
      categoryId: selectedFund?.categoryId ?? "",
    })
  }

  function handleCategoryChange(next: string) {
    update({
      categoryId: next === NONE ? "" : next,
      subcategoryId: "",
    })
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {showCampaign ? (
        <div className="flex flex-col gap-2">
          <Label>Campaign</Label>
          <Select
            value={value.campaignId || NONE}
            onValueChange={(next) => update({ campaignId: next === NONE ? "" : next })}
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select campaign" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>No campaign</SelectItem>
              {campaigns.map((campaign) => (
                <SelectItem key={campaign.id} value={campaign.id}>
                  {campaign.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {showFund ? (
        <div className="flex flex-col gap-2">
          <Label>Fund</Label>
          <Select
            value={value.subcategoryId || NONE}
            onValueChange={handleFundChange}
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select fund" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>No fund</SelectItem>
              {allFunds.map((fund) => (
                <SelectItem key={fund.id} value={fund.id}>
                  {fund.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {showCategory ? (
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label>Category</Label>
          <Select
            value={value.categoryId || NONE}
            onValueChange={handleCategoryChange}
            disabled={disabled || usesFundFirstAttribution}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>No category</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}
    </div>
  )
}

export function toAttributionIds(value: DonationAttributionValue) {
  return {
    campaign_id: value.campaignId || null,
    category_id: value.categoryId || null,
    subcategory_id: value.subcategoryId || null,
  }
}

export const EMPTY_DONATION_ATTRIBUTION_VALUE: DonationAttributionValue = {
  campaignId: "",
  categoryId: "",
  subcategoryId: "",
}
