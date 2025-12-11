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
    
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    // Get the organization and department IDs
    const { data: org } = await supabaseClient
      .from('organizations')
      .select('id')
      .eq('code', 'MAB')
      .single();

    if (!org) {
      return new Response(JSON.stringify({ error: 'Organization not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: dept } = await supabaseClient
      .from('departments')
      .select('id')
      .eq('code', 'CS')
      .single();

    const { data: program } = await supabaseClient
      .from('programs')
      .select('id')
      .eq('code', 'BSCS')
      .single();

    const testUsers = [
      {
        email: 'admin2@mab.com',
        password: 'Test@567',
        full_name: 'Admin User 2',
        role: 'org_admin',
        department_id: null,
        program_id: null,
      },
      {
        email: 'hod2@mab.com',
        password: 'Test@567',
        full_name: 'HOD User 2',
        role: 'hod',
        department_id: dept?.id,
        program_id: null,
      },
      {
        email: 'faculty2@mab.com',
        password: 'Test@567',
        full_name: 'Faculty User 2',
        role: 'faculty',
        department_id: dept?.id,
        program_id: program?.id,
      },
    ];

    const createdUsers = [];

    for (const testUser of testUsers) {
      console.log(`Creating user: ${testUser.email}`);
      
      // Create auth user
      const { data: authData, error: authError } = await supabaseClient.auth.admin.createUser({
        email: testUser.email,
        password: testUser.password,
        email_confirm: true,
        user_metadata: { full_name: testUser.full_name },
      });

      if (authError) {
        console.error(`Error creating ${testUser.email}:`, authError);
        // Skip if user already exists
        if (authError.message.includes('already been registered')) {
          console.log(`User ${testUser.email} already exists, skipping`);
          continue;
        }
        throw authError;
      }

      // Update profile (created by trigger)
      await supabaseClient
        .from('profiles')
        .update({ full_name: testUser.full_name, is_active: true })
        .eq('id', authData.user.id);

      // Create user role
      const { error: roleError } = await supabaseClient
        .from('user_roles')
        .insert({
          user_id: authData.user.id,
          role: testUser.role,
          organization_id: org.id,
          department_id: testUser.department_id,
          program_id: testUser.program_id,
        });

      if (roleError) {
        console.error(`Error creating role for ${testUser.email}:`, roleError);
        throw roleError;
      }

      // Add to user_departments if department_id exists
      if (testUser.department_id) {
        await supabaseClient
          .from('user_departments')
          .insert({
            user_id: authData.user.id,
            department_id: testUser.department_id,
          });
      }

      // Add to user_programs if program_id exists
      if (testUser.program_id) {
        await supabaseClient
          .from('user_programs')
          .insert({
            user_id: authData.user.id,
            program_id: testUser.program_id,
          });
      }

      createdUsers.push({
        email: testUser.email,
        role: testUser.role,
        id: authData.user.id,
      });

      console.log(`Successfully created user: ${testUser.email}`);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Test users created successfully',
      users: createdUsers 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in seed-test-users:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Failed to create test users'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
