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

    // Verify user using getClaims for reliable JWT validation
    const supabaseAuth = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } }
    });
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      console.error('Auth error:', claimsError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = claimsData.claims.sub;

    const { data: roleData, error: roleError } = await supabaseClient
      .from('user_roles')
      .select('role, organization_id')
      .eq('user_id', userId)
      .single();

    // Allow super_admin and org_admin to list users
    if (roleError || (roleData?.role !== 'org_admin' && roleData?.role !== 'super_admin')) {
      console.error('Role check failed:', roleError);
      return new Response(JSON.stringify({ error: 'Forbidden - Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const isSuperAdmin = roleData.role === 'super_admin';
    const adminOrgId = roleData.organization_id;

    // List all users using admin API with pagination
    let allUsers: any[] = [];
    let page = 1;
    const perPage = 1000;

    while (true) {
      const { data: authUsersData, error: listError } = await supabaseClient.auth.admin.listUsers({
        page,
        perPage,
      });

      if (listError) {
        console.error('List users error:', listError);
        throw listError;
      }

      allUsers = [...allUsers, ...authUsersData.users];

      // If we got fewer than perPage users, we've reached the last page
      if (authUsersData.users.length < perPage) break;
      page++;
    }

    let filteredUsers = allUsers;

    if (isSuperAdmin) {
      // Super admin can see all users EXCEPT other super_admins
      const { data: superAdminUsers } = await supabaseClient
        .from('user_roles')
        .select('user_id')
        .eq('role', 'super_admin')
        .neq('user_id', userId);

      const superAdminIds = new Set(superAdminUsers?.map(u => u.user_id) || []);
      
      // Filter out other super_admins from the list (keep self)
      filteredUsers = allUsers.filter((u: any) => u.id === userId || !superAdminIds.has(u.id));
    } else {
      // Org admin can only see users in their organization
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
        .select('user_id, role')
        .eq('organization_id', adminOrgId);

      if (orgUsersError) {
        console.error('Error fetching org users:', orgUsersError);
        throw orgUsersError;
      }

      // Filter out super_admin users from the visible list
      const orgUserIds = new Set(
        orgUsers
          ?.filter(u => u.role !== 'super_admin')
          .map(u => u.user_id) || []
      );

      // Filter to only include users from the admin's organization (excluding super_admins)
      filteredUsers = allUsers.filter((u: any) => orgUserIds.has(u.id));
    }

    console.log(`Listed ${filteredUsers.length} users`);

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
