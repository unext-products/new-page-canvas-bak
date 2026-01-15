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

    // Verify user is admin or super_admin
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

    // Allow super_admin and org_admin to create users
    if (roleError || (roleData?.role !== 'org_admin' && roleData?.role !== 'super_admin')) {
      console.error('Role check failed:', roleError);
      return new Response(JSON.stringify({ error: 'Forbidden - Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const isSuperAdmin = roleData.role === 'super_admin';

    // Get request body
    const body = await req.json();
    const { 
      full_name, email, phone, role, 
      vertical_id, vertical_ids,
      program_id, program_ids, 
      batch_id, batch_ids,
      subject_id, subject_ids,
      is_active, password,
      organization_id: targetOrgId // Only super_admin can specify this
    } = body;

    // Normalize to arrays
    const verticalIds: string[] = vertical_ids?.length ? vertical_ids : (vertical_id ? [vertical_id] : []);
    const progIds: string[] = program_ids?.length ? program_ids : (program_id ? [program_id] : []);
    const batchIds: string[] = batch_ids?.length ? batch_ids : (batch_id ? [batch_id] : []);
    const subjectIds: string[] = subject_ids?.length ? subject_ids : (subject_id ? [subject_id] : []);

    // Determine organization ID
    let organizationId = roleData.organization_id;
    if (isSuperAdmin && targetOrgId) {
      organizationId = targetOrgId;
    }

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

    // Validate role - new role system
    const validRoles = ['super_admin', 'org_admin', 'l3', 'l2', 'l1'];
    if (!validRoles.includes(role)) {
      return new Response(JSON.stringify({ error: 'Invalid role' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Only super_admin can create super_admin users
    if (role === 'super_admin' && !isSuperAdmin) {
      return new Response(JSON.stringify({ error: 'Only Super Admins can create Super Admin users' }), {
        status: 403,
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

    // Validate hierarchy requirements based on role
    // L1 requires: vertical, program, batch, subject (all mandatory)
    if (role === 'l1') {
      if (verticalIds.length === 0) {
        return new Response(JSON.stringify({ error: 'L1 users require at least one vertical assignment' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (progIds.length === 0) {
        return new Response(JSON.stringify({ error: 'L1 users require at least one program assignment' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (batchIds.length === 0) {
        return new Response(JSON.stringify({ error: 'L1 users require at least one batch assignment' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (subjectIds.length === 0) {
        return new Response(JSON.stringify({ error: 'L1 users require at least one subject assignment' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // L2 and L3 require vertical assignment
    if ((role === 'l2' || role === 'l3') && verticalIds.length === 0) {
      return new Response(JSON.stringify({ error: `${role.toUpperCase()} users require at least one vertical assignment` }), {
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

    // Create user role
    const primaryVerticalId = verticalIds[0] || null;
    const primaryProgId = progIds[0] || null;

    const { error: roleInsertError } = await supabaseClient
      .from('user_roles')
      .insert({
        user_id: authData.user.id,
        role,
        organization_id: role === 'super_admin' ? null : organizationId,
        vertical_id: (role === 'l3' || role === 'l2' || role === 'l1') ? primaryVerticalId : null,
        program_id: (role === 'l2' || role === 'l1') ? primaryProgId : null,
      });

    if (roleInsertError) {
      console.error('Role insert error:', roleInsertError);
      throw roleInsertError;
    }

    // Insert into user_verticals junction table
    if (verticalIds.length > 0 && role !== 'org_admin' && role !== 'super_admin') {
      const verticalInserts = verticalIds.map(vId => ({
        user_id: authData.user.id,
        vertical_id: vId,
      }));

      const { error: verticalInsertError } = await supabaseClient
        .from('user_verticals')
        .insert(verticalInserts);

      if (verticalInsertError) {
        console.error('Vertical assignment error:', verticalInsertError);
        // Non-fatal, continue
      }
    }

    // Insert into user_programs junction table
    if (progIds.length > 0 && (role === 'l2' || role === 'l1')) {
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

    // Insert into user_batches junction table (L1 only)
    if (batchIds.length > 0 && role === 'l1') {
      const batchInserts = batchIds.map(bId => ({
        user_id: authData.user.id,
        batch_id: bId,
      }));

      const { error: batchInsertError } = await supabaseClient
        .from('user_batches')
        .insert(batchInserts);

      if (batchInsertError) {
        console.error('Batch assignment error:', batchInsertError);
        // Non-fatal, continue
      }
    }

    // Insert into user_subjects junction table (L1 only)
    if (subjectIds.length > 0 && role === 'l1') {
      const subjectInserts = subjectIds.map(sId => ({
        user_id: authData.user.id,
        subject_id: sId,
      }));

      const { error: subjectInsertError } = await supabaseClient
        .from('user_subjects')
        .insert(subjectInserts);

      if (subjectInsertError) {
        console.error('Subject assignment error:', subjectInsertError);
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
