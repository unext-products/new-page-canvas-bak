import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Require authentication - only existing super admins can run this
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    // Validate caller is a super_admin
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: callerRole } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (callerRole?.role !== "super_admin") {
      return new Response(JSON.stringify({ error: "Forbidden: super_admin role required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Read super admin data from request body (no hardcoded credentials)
    const body = await req.json();
    const { email, full_name } = body;

    if (!email || !full_name) {
      return new Response(JSON.stringify({ error: "email and full_name are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate a secure random temporary password
    const tempPassword = crypto.randomUUID().slice(0, 8) + "A@1x";

    // Check if user already exists
    const { data: existingUsers } = await adminClient.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email === email);

    if (existingUser) {
      // Update role if needed
      const { data: existingRole } = await adminClient
        .from("user_roles")
        .select("id, role")
        .eq("user_id", existingUser.id)
        .single();

      if (existingRole?.role === "super_admin") {
        return new Response(JSON.stringify({ status: "already_exists", email }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (existingRole) {
        await adminClient.from("user_roles").update({ role: "super_admin", organization_id: null }).eq("user_id", existingUser.id);
      } else {
        await adminClient.from("user_roles").insert({ user_id: existingUser.id, role: "super_admin", organization_id: null });
      }

      return new Response(JSON.stringify({ status: "role_updated", email }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create new user with temporary password
    const { data: authData, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name },
    });

    if (createError || !authData.user) {
      return new Response(JSON.stringify({ error: createError?.message || "Failed to create user" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await adminClient.from("profiles").update({ full_name }).eq("id", authData.user.id);
    await adminClient.from("user_roles").insert({ user_id: authData.user.id, role: "super_admin", organization_id: null });

    // Note: In production, send a password reset email instead of returning the temp password
    return new Response(JSON.stringify({ 
      status: "created", 
      email,
      message: "User created. Please trigger a password reset email for this user."
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
