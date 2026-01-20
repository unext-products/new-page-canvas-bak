import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SuperAdminData {
  email: string;
  password: string;
  full_name: string;
}

const superAdmins: SuperAdminData[] = [
  {
    email: "shreyas.patil@u-next.com",
    password: "Sclockwise@3",
    full_name: "Shreyas Patil",
  },
  {
    email: "unext.product.team@gmail.com",
    password: "Manipal@577",
    full_name: "UNext Product Team",
  },
];

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create admin client with service role key
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const results: { email: string; status: string; error?: string }[] = [];

    for (const admin of superAdmins) {
      console.log(`Processing super admin: ${admin.email}`);

      try {
        // Check if user already exists
        const { data: existingUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers();
        
        if (listError) {
          console.error(`Error listing users:`, listError);
          results.push({ email: admin.email, status: "error", error: listError.message });
          continue;
        }

        const existingUser = existingUsers?.users?.find(u => u.email === admin.email);

        if (existingUser) {
          console.log(`User ${admin.email} already exists, checking role...`);
          
          // Check if they already have super_admin role
          const { data: existingRole } = await supabaseAdmin
            .from("user_roles")
            .select("id, role")
            .eq("user_id", existingUser.id)
            .single();

          if (existingRole?.role === "super_admin") {
            results.push({ email: admin.email, status: "already_exists" });
            continue;
          }

          // Update or insert role to super_admin
          if (existingRole) {
            await supabaseAdmin
              .from("user_roles")
              .update({ role: "super_admin", organization_id: null })
              .eq("user_id", existingUser.id);
          } else {
            await supabaseAdmin
              .from("user_roles")
              .insert({
                user_id: existingUser.id,
                role: "super_admin",
                organization_id: null,
              });
          }

          results.push({ email: admin.email, status: "role_updated" });
          continue;
        }

        // Create new auth user with email confirmed
        const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email: admin.email,
          password: admin.password,
          email_confirm: true,
          user_metadata: {
            full_name: admin.full_name,
          },
        });

        if (createError) {
          console.error(`Error creating user ${admin.email}:`, createError);
          results.push({ email: admin.email, status: "error", error: createError.message });
          continue;
        }

        if (!authData.user) {
          results.push({ email: admin.email, status: "error", error: "No user returned" });
          continue;
        }

        console.log(`Created auth user: ${authData.user.id}`);

        // Update profile with full name (profile should be auto-created by trigger)
        const { error: profileError } = await supabaseAdmin
          .from("profiles")
          .update({ full_name: admin.full_name })
          .eq("id", authData.user.id);

        if (profileError) {
          console.log(`Profile update note: ${profileError.message}`);
          // Try insert if update fails (in case trigger didn't create it)
          await supabaseAdmin
            .from("profiles")
            .insert({
              id: authData.user.id,
              full_name: admin.full_name,
            });
        }

        // Create super_admin role
        const { error: roleError } = await supabaseAdmin
          .from("user_roles")
          .insert({
            user_id: authData.user.id,
            role: "super_admin",
            organization_id: null,
          });

        if (roleError) {
          console.error(`Error creating role for ${admin.email}:`, roleError);
          results.push({ email: admin.email, status: "partial", error: `Role error: ${roleError.message}` });
          continue;
        }

        console.log(`Successfully created super admin: ${admin.email}`);
        results.push({ email: admin.email, status: "created" });
      } catch (err) {
        console.error(`Unexpected error for ${admin.email}:`, err);
        results.push({ email: admin.email, status: "error", error: String(err) });
      }
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Fatal error:", error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
