import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authHeader = req.headers.get('authorization');

    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Create clients
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
    const userClient = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verify user is admin
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: roleData, error: roleError } = await supabaseClient
      .from('user_roles')
      .select('role, organization_id')
      .eq('user_id', user.id)
      .single();

    if (roleError || roleData?.role !== 'org_admin') {
      console.error('Role check failed:', roleError);
      return new Response(JSON.stringify({ error: 'Forbidden - Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get request body - support both single department_id and multiple department_ids
    const body = await req.json();
    const { full_name, email, phone, role, department_id, department_ids, program_id, program_ids, is_active, password } = body;

    // Normalize to arrays
    const deptIds: string[] = department_ids?.length ? department_ids : (department_id ? [department_id] : []);
    const progIds: string[] = program_ids?.length ? program_ids : (program_id ? [program_id] : []);

    // Validate inputs
    if (!full_name || !email || !role || !password) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (full_name.length > 100 || email.length > 255) {
      return new Response(JSON.stringify({ error: 'Input exceeds maximum length' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate password
    if (password.length < 8) {
      return new Response(JSON.stringify({ error: 'Password must be at least 8 characters' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
      return new Response(JSON.stringify({ 
        error: 'Password must contain at least one uppercase letter, one lowercase letter, and one number' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create user with admin API
    const { data: authData, error: authCreateError } = await supabaseClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    });

    if (authCreateError) {
      console.error('User creation error:', authCreateError);
      throw authCreateError;
    }

    // Update profile
    const { error: profileError } = await supabaseClient
      .from('profiles')
      .update({
        full_name,
        phone: phone || null,
        is_active: is_active ?? true,
      })
      .eq('id', authData.user.id);

    if (profileError) {
      console.error('Profile update error:', profileError);
      throw profileError;
    }

    // Create user role - use first department/program for backward compatibility
    const primaryDeptId = deptIds[0] || null;
    const primaryProgId = progIds[0] || null;

    const { error: roleInsertError } = await supabaseClient
      .from('user_roles')
      .insert({
        user_id: authData.user.id,
        role,
        organization_id: roleData.organization_id,
        department_id: role === 'org_admin' ? null : primaryDeptId,
        program_id: (role === 'program_manager' || role === 'faculty') ? primaryProgId : null,
      });

    if (roleInsertError) {
      console.error('Role insert error:', roleInsertError);
      throw roleInsertError;
    }

    // Insert into user_departments junction table for all departments
    if (deptIds.length > 0 && role !== 'org_admin') {
      const deptInserts = deptIds.map(dId => ({
        user_id: authData.user.id,
        department_id: dId,
      }));

      const { error: deptInsertError } = await supabaseClient
        .from('user_departments')
        .insert(deptInserts);

      if (deptInsertError) {
        console.error('Department assignment error:', deptInsertError);
        // Non-fatal, continue
      }
    }

    // Insert into user_programs junction table for all programs
    if (progIds.length > 0 && (role === 'program_manager' || role === 'faculty')) {
      const progInserts = progIds.map(pId => ({
        user_id: authData.user.id,
        program_id: pId,
      }));

      const { error: progInsertError } = await supabaseClient
        .from('user_programs')
        .insert(progInserts);

      if (progInsertError) {
        console.error('Program assignment error:', progInsertError);
        // Non-fatal, continue
      }
    }

    console.log('User created successfully:', authData.user.id);

    return new Response(JSON.stringify({ 
      success: true, 
      user: authData.user,
      message: 'User created successfully'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in admin-create-user:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to create user';
    return new Response(JSON.stringify({ 
      error: errorMessage
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
