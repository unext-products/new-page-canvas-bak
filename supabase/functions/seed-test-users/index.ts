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
    // Require authentication - only super_admins or org_admins can seed test users
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

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: callerRole } = await supabaseClient
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

    // Read test user data from request body (no hardcoded credentials)
    const body = await req.json();
    const { users: testUsers } = body;

    if (!testUsers || !Array.isArray(testUsers) || testUsers.length === 0) {
      return new Response(JSON.stringify({ 
        error: "Request body must include 'users' array with objects containing: email, full_name, role, organization_code, department_code (optional), program_code (optional)" 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const createdUsers = [];

    for (const testUser of testUsers) {
      if (!testUser.email || !testUser.full_name || !testUser.role || !testUser.organization_code) {
        createdUsers.push({ email: testUser.email, status: 'skipped', error: 'Missing required fields' });
        continue;
      }

      // Generate random temporary password
      const tempPassword = crypto.randomUUID().slice(0, 8) + "A@1x";

      // Lookup organization
      const { data: org } = await supabaseClient
        .from('organizations')
        .select('id')
        .eq('code', testUser.organization_code)
        .single();

      if (!org) {
        createdUsers.push({ email: testUser.email, status: 'skipped', error: 'Organization not found' });
        continue;
      }

      // Lookup optional dept/program
      let department_id = null;
      let program_id = null;

      if (testUser.department_code) {
        const { data: dept } = await supabaseClient.from('departments').select('id').eq('code', testUser.department_code).single();
        department_id = dept?.id;
      }
      if (testUser.program_code) {
        const { data: prog } = await supabaseClient.from('programs').select('id').eq('code', testUser.program_code).single();
        program_id = prog?.id;
      }

      console.log(`Creating user: ${testUser.email}`);

      const { data: authData, error: createError } = await supabaseClient.auth.admin.createUser({
        email: testUser.email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { full_name: testUser.full_name },
      });

      if (createError) {
        if (createError.message.includes('already been registered')) {
          createdUsers.push({ email: testUser.email, status: 'already_exists' });
          continue;
        }
        throw createError;
      }

      await supabaseClient.from('profiles').update({ full_name: testUser.full_name, is_active: true }).eq('id', authData.user.id);

      await supabaseClient.from('user_roles').insert({
        user_id: authData.user.id,
        role: testUser.role,
        organization_id: org.id,
        department_id,
        program_id,
      });

      if (department_id) {
        await supabaseClient.from('user_departments').insert({ user_id: authData.user.id, department_id });
      }
      if (program_id) {
        await supabaseClient.from('user_programs').insert({ user_id: authData.user.id, program_id });
      }

      createdUsers.push({ email: testUser.email, role: testUser.role, id: authData.user.id, status: 'created' });
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Users processed. Trigger password reset emails for new users.',
      users: createdUsers 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in seed-test-users:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
