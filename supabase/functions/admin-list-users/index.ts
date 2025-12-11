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
      console.error('No authorization header provided');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Extract JWT token from Bearer header
    const token = authHeader.replace('Bearer ', '');

    // Create admin client with service role key
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user using the token directly
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
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

    // Get the admin's organization ID
    const adminOrgId = roleData.organization_id;
    if (!adminOrgId) {
      console.error('Admin has no organization assigned');
      return new Response(JSON.stringify({ error: 'Admin has no organization assigned' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get user IDs that belong to the admin's organization
    const { data: orgUsers, error: orgUsersError } = await supabaseClient
      .from('user_roles')
      .select('user_id')
      .eq('organization_id', adminOrgId);

    if (orgUsersError) {
      console.error('Error fetching org users:', orgUsersError);
      throw orgUsersError;
    }

    const orgUserIds = new Set(orgUsers?.map(u => u.user_id) || []);

    // List all users using admin API
    const { data: authUsersData, error: listError } = await supabaseClient.auth.admin.listUsers();

    if (listError) {
      console.error('List users error:', listError);
      throw listError;
    }

    // Filter to only include users from the admin's organization
    const filteredUsers = authUsersData.users.filter(u => orgUserIds.has(u.id));

    console.log(`Listed ${filteredUsers.length} users for organization ${adminOrgId}`);

    return new Response(JSON.stringify({ 
      users: filteredUsers 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in admin-list-users:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to list users';
    return new Response(JSON.stringify({ 
      error: errorMessage
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
