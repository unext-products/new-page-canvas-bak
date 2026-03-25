import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.81.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authHeader = req.headers.get('authorization') ?? req.headers.get('Authorization');

    if (!authHeader?.startsWith('Bearer ')) {
      console.error('No valid authorization header provided');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '').trim();

    // User-context client for auth validation
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Admin client for privileged user listing
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser(token);
    if (authError || !user?.id) {
      console.error('Auth error:', authError);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = user.id;

    const { data: roleData, error: roleError } = await supabaseClient
      .from('user_roles')
      .select('role, organization_id')
      .eq('user_id', userId)
      .single();

    if (roleError || (roleData?.role !== 'org_admin' && roleData?.role !== 'super_admin')) {
      console.error('Role check failed:', roleError);
      return new Response(JSON.stringify({ error: 'Forbidden - Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const isSuperAdmin = roleData.role === 'super_admin';
    const adminOrgId = roleData.organization_id;

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

      if (authUsersData.users.length < perPage) break;
      page++;
    }

    let filteredUsers = allUsers;

    if (isSuperAdmin) {
      const { data: superAdminUsers } = await supabaseClient
        .from('user_roles')
        .select('user_id')
        .eq('role', 'super_admin')
        .neq('user_id', userId);

      const superAdminIds = new Set(superAdminUsers?.map((u) => u.user_id) || []);
      filteredUsers = allUsers.filter((u: any) => u.id === userId || !superAdminIds.has(u.id));
    } else {
      if (!adminOrgId) {
        console.error('Admin has no organization assigned');
        return new Response(JSON.stringify({ error: 'Admin has no organization assigned' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: orgUsers, error: orgUsersError } = await supabaseClient
        .from('user_roles')
        .select('user_id, role')
        .eq('organization_id', adminOrgId);

      if (orgUsersError) {
        console.error('Error fetching org users:', orgUsersError);
        throw orgUsersError;
      }

      const orgUserIds = new Set(
        orgUsers?.filter((u) => u.role !== 'super_admin').map((u) => u.user_id) || []
      );

      filteredUsers = allUsers.filter((u: any) => orgUserIds.has(u.id));
    }

    console.log(`Listed ${filteredUsers.length} users`);

    return new Response(JSON.stringify({ users: filteredUsers }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in admin-list-users:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to list users';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});