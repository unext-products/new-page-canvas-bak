import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Require authentication - only super_admins or org_admins can run this
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Validate caller
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: callerRole } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (!callerRole || !['super_admin', 'org_admin'].includes(callerRole.role)) {
      return new Response(JSON.stringify({ error: "Forbidden: admin role required" }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Accept faculty data from request body instead of hardcoding
    const body = await req.json();
    const { organization_id, users, verticals, programs } = body;

    if (!organization_id || !users || !Array.isArray(users)) {
      return new Response(JSON.stringify({ 
        error: "Request body must include organization_id and users array. Each user needs: name, email, vertical (code)" 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const results: { email: string; status: string; error?: string }[] = [];
    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    for (const userData of users) {
      try {
        if (!userData.name || !userData.email || !userData.vertical) {
          results.push({ email: userData.email || 'unknown', status: 'error', error: 'Missing required fields' });
          errorCount++;
          continue;
        }

        const verticalId = verticals?.[userData.vertical];
        const programId = programs?.[userData.vertical];

        if (!verticalId) {
          results.push({ email: userData.email, status: 'error', error: `Vertical ${userData.vertical} not found in mapping` });
          errorCount++;
          continue;
        }

        // Generate random temporary password
        const tempPassword = crypto.randomUUID().slice(0, 8) + "A@1x";

        const { data: authData, error: createError } = await adminClient.auth.admin.createUser({
          email: userData.email,
          password: tempPassword,
          email_confirm: true,
          user_metadata: { full_name: userData.name },
        });

        if (createError) {
          if (createError.message.includes('already been registered')) {
            results.push({ email: userData.email, status: 'skipped' });
            skipCount++;
            continue;
          }
          throw createError;
        }

        // Update profile
        await adminClient.from('profiles').update({ full_name: userData.name, is_active: true }).eq('id', authData.user.id);

        // Create role
        await adminClient.from('user_roles').insert({
          user_id: authData.user.id,
          role: 'l1',
          organization_id,
          vertical_id: verticalId,
          program_id: programId || null,
        });

        // Assign vertical
        await adminClient.from('user_verticals').insert({ user_id: authData.user.id, vertical_id: verticalId });

        // Assign program if available
        if (programId) {
          await adminClient.from('user_programs').insert({ user_id: authData.user.id, program_id: programId });
        }

        results.push({ email: userData.email, status: 'created' });
        successCount++;
      } catch (err) {
        console.error(`Error processing ${userData.email}:`, err);
        results.push({ email: userData.email, status: 'error', error: String(err) });
        errorCount++;
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: `Processed ${users.length} users. Created: ${successCount}, Skipped: ${skipCount}, Errors: ${errorCount}. Trigger password reset emails for new users.`,
      results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
