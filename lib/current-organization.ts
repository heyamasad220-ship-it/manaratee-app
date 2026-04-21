import { createClient } from "@/lib/supabase/client";

export async function getCurrentOrganizationId(): Promise<string | null> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // Get org from organization_members
  const { data, error } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("Error fetching org:", error);
    return null;
  }

  return data?.organization_id || null;
}