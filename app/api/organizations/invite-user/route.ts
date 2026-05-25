import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function json(status: number, body: unknown) {
  return NextResponse.json(body, { status });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const email = String(body.email || "").trim().toLowerCase();
    const organizationId = String(body.organizationId || "").trim();
    const roleId = String(body.roleId || "").trim();
    const roleName = String(body.roleName || "").trim();
    const firstName = String(body.firstName || "").trim();
    const lastName = String(body.lastName || "").trim();

    if (!email || !organizationId || !roleId) {
      return json(400, {
        error: "Missing required fields",
        required: ["email", "organizationId", "roleId"],
      });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`;

    if (!supabaseUrl || !serviceRoleKey || !appUrl) {
      console.error("Invite config missing", {
        hasSupabaseUrl: Boolean(supabaseUrl),
        hasServiceRoleKey: Boolean(serviceRoleKey),
        hasAppUrl: Boolean(appUrl),
      });

      return json(500, {
        error: "Server invite configuration is incomplete",
      });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // 1. Confirm role belongs to this organization.
    const { data: role, error: roleError } = await admin
      .from("organization_roles")
      .select("id, name, organization_id")
      .eq("id", roleId)
      .eq("organization_id", organizationId)
      .single();

    if (roleError || !role) {
      console.error("Invalid role for invite", { roleError, roleId, organizationId });
      return json(400, { error: "Invalid organization role" });
    }

    // 2. Send Supabase invite email.
    const redirectTo = `${appUrl.replace(/\/$/, "")}/auth/callback?next=/dashboard`;

    const { data: inviteData, error: inviteError } =
      await admin.auth.admin.inviteUserByEmail(email, {
        redirectTo,
        data: {
          first_name: firstName,
          last_name: lastName,
          organization_id: organizationId,
          organization_role_id: roleId,
          organization_role_name: role.name || roleName,
        },
      });

    if (inviteError || !inviteData?.user?.id) {
      console.error("Supabase invite failed", {
        email,
        redirectTo,
        inviteError,
      });

      return json(502, {
        error: "Failed to send invite email",
        details: inviteError?.message,
      });
    }

    const userId = inviteData.user.id;

    // 3. Upsert membership using service-role client to avoid RLS blockage.
    // organization_members.role stays hidden/system-level access.
    // organization_members.role_id is the visible custom org role.
    const { data: membership, error: memberError } = await admin
      .from("organization_members")
      .upsert(
        {
          organization_id: organizationId,
          user_id: userId,
          email,
          first_name: firstName || null,
          last_name: lastName || null,
          role: "member",
          role_id: roleId,
          status: "invited",
          invited_at: new Date().toISOString(),
        },
        {
          onConflict: "organization_id,user_id",
        }
      )
      .select("*")
      .single();

    if (memberError) {
      console.error("Membership insert/upsert failed", {
        memberError,
        organizationId,
        userId,
        roleId,
      });

      return json(500, {
        error: "Invite email sent, but organization membership failed",
        details: memberError.message,
      });
    }

    return json(200, {
      success: true,
      message: "Invite sent",
      userId,
      membership,
      debug: {
        email,
        organizationId,
        roleId,
        roleName: role.name,
        redirectTo,
      },
    });
  } catch (error: any) {
    console.error("Unhandled invite-user error", error);

    return json(500, {
      error: "Unexpected invite failure",
      details: error?.message,
    });
  }
}