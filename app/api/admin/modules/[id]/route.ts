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

    const { data: module, error } = await supabase
      .from("modules")
      .update({
        name: body.name,
        description: body.description,
        is_active: body.is_active,
        default_enabled: body.default_enabled,
      })
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
