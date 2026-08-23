import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

// PUT - Update a module
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const updates: Record<string, unknown> = {
      name: body.name,
      description: body.description,
      is_active: body.is_active,
    }
    if (body.monthly_price_cents != null) {
      updates.monthly_price_cents = Number(body.monthly_price_cents)
    }

    const { data: module, error } = await supabase
      .from("modules")
      .update(updates)
      .eq("id", id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ module })
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to update module" },
      { status: 500 }
    )
  }
}
