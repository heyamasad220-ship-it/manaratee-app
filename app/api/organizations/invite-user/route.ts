import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

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
        success: false,
        error: "Missing required fields.",
        required: ["email", "organizationId", "roleId"],
      });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");

    if (!supabaseUrl || !serviceRoleKey || !appUrl) {
      console.error("Invite config missing", {
        hasSupabaseUrl: Boolean(supabaseUrl),
        hasServiceRoleKey: Boolean(serviceRoleKey),
        hasAppUrl: Boolean(appUrl),
      });

      return json(500, {
        success: false,
        error: "Server invite configuration is incomplete.",
      });
    }

    const supabaseUser = await createServerClient();

    const {
      data: { user },
      error: userError,
    } = await supabaseUser.auth.getUser();

    if (userError || !user) {
      return json(401, {
        success: false,
        error: "Unauthorized.",
      });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    /**
     * 1. Confirm current user belongs to the organization.
     * organization_members.role = hidden system/platform access
     * organization_members.role_id = visible organization role
     */
    const { data: currentMembership, error: currentMembershipError } =
      await admin
        .from("organization_members")
        .select("id, organization_id, user_id, role, role_id")
        .eq("organization_id", organizationId)
        .eq("user_id", user.id)
        .maybeSingle();

    if (currentMembershipError) {
      console.error("Current membership lookup failed", {
        currentMembershipError,
        organizationId,
        userId: user.id,
      });

      return json(500, {
        success: false,
        error: currentMembershipError.message,
      });
    }

    if (!currentMembership) {
      return json(403, {
        success: false,
        error: "You are not a member of this organization.",
      });
    }

    /**
     * 2. Confirm current user has permission to invite users.
     * This avoids requiring platform admin privileges.
     */
    const { data: invitePermission, error: invitePermissionError } =
      await admin
        .from("role_permissions")
        .select("id")
        .eq("role_id", currentMembership.role_id)
        .eq("permission_key", "users.invite")
        .eq("enabled", true)
        .maybeSingle();

    if (invitePermissionError) {
      console.error("Invite permission lookup failed", {
        invitePermissionError,
        roleId: currentMembership.role_id,
      });

      return json(500, {
        success: false,
        error: invitePermissionError.message,
      });
    }

    const isSystemAdmin =
  currentMembership.role === "owner" ||
  currentMembership.role === "admin" ||
  currentMembership.role === "super_admin";

if (!isSystemAdmin && !invitePermission) {
  return json(403, {
    success: false,
    error: "You do not have permission to invite users.",
  });
}

    /**
     * 3. Confirm invited role belongs to this organization.
     */
    const { data: invitedRole, error: invitedRoleError } = await admin
      .from("organization_roles")
      .select("id, name, organization_id")
      .eq("id", roleId)
      .eq("organization_id", organizationId)
      .single();

    if (invitedRoleError || !invitedRole) {
      console.error("Invalid invited role", {
        invitedRoleError,
        roleId,
        organizationId,
      });

      return json(400, {
        success: false,
        error: "Invalid organization role.",
      });
    }

    /**
     * 4. Send Supabase invite email.
     */
    const redirectTo = `${appUrl.replace(
      /\/$/,
      ""
    )}/auth/callback?next=/dashboard`;

    const { data: inviteData, error: inviteError } =
      await admin.auth.admin.inviteUserByEmail(email, {
        redirectTo,
        data: {
          first_name: firstName,
          last_name: lastName,
          organization_id: organizationId,
          organization_role_id: roleId,
          organization_role_name: invitedRole.name || roleName,
        },
      });

    if (inviteError || !inviteData?.user?.id) {
      console.error("SUPABASE INVITE ERROR:", {
        email,
        redirectTo,
        message: inviteError?.message,
        status: inviteError?.status,
        code: inviteError?.code,
        name: inviteError?.name,
        fullError: inviteError,
      });

      return json(502, {
        success: false,
        error: "Failed to send invite email.",
        details: inviteError?.message,
        status: inviteError?.status,
        code: inviteError?.code,
        name: inviteError?.name,
      });
    }

    const invitedUserId = inviteData.user.id;

    /**
     * 5. Create/update organization membership.
     */
    const { data: membership, error: membershipError } = await admin
  .from("organization_members")
  .upsert(
    {
      organization_id: organizationId,
      user_id: invitedUserId,
      role: "member",
      role_id: roleId,
    },
    {
      onConflict: "organization_id,user_id",
    }
  )
  .select("*")
  .single();

if (membershipError) {
  console.error("MEMBERSHIP UPSERT FAILED:", {
    message: membershipError.message,
    details: membershipError.details,
    hint: membershipError.hint,
    code: membershipError.code,
  });

  return json(500, {
    success: false,
    error: "Invite email sent, but organization membership failed.",
    details: membershipError.message,
    hint: membershipError.hint,
    code: membershipError.code,
  });
}

    return json(200, {
      success: true,
      message: "Invite sent.",
      user: inviteData.user,
      membership,
      debug: {
        email,
        organizationId,
        roleId,
        roleName: invitedRole.name,
        redirectTo,
      },
    });
  } catch (error: any) {
    console.error("Unhandled invite-user error", error);

    return json(500, {
      success: false,
      error: "Unexpected invite failure.",
      details: error?.message,
    });
  }
}