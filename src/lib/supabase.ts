import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";
import { toDisplayRole, type DisplayRole, type DbRole } from "./roleMapping";

export type UserRole = DisplayRole;

export interface UserWithRole {
  user: User;
  role: UserRole | null;
  verticalId: string | null;
  /** @deprecated Use verticalId instead */
  departmentId: string | null;
  profile: {
    full_name: string;
    phone: string | null;
    avatar_url: string | null;
    is_active: boolean;
  } | null;
}

export async function getUserWithRole(userId: string, authUser?: User): Promise<UserWithRole | null> {
  try {
    const [roleData, profileData] = await Promise.all([
      supabase
        .from("user_roles")
        .select("role, vertical_id, department_id")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("profiles")
        .select("full_name, phone, avatar_url, is_active")
        .eq("id", userId)
        .maybeSingle(),
    ]);

    let user = authUser;
    if (!user) {
      const { data: { user: fetchedUser } } = await supabase.auth.getUser();
      user = fetchedUser ?? undefined;
    }
    
    if (!user) return null;

    const verticalId = roleData.data?.vertical_id || roleData.data?.department_id || null;

    return {
      user,
      role: toDisplayRole(roleData.data?.role as DbRole | null),
      verticalId,
      departmentId: verticalId, // backward compatibility
      profile: profileData.data,
    };
  } catch (error) {
    console.error("Error fetching user with role:", error);
    return null;
  }
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  // If login succeeded, check if user is active
  if (data?.user && !error) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_active")
      .eq("id", data.user.id)
      .single();

    // If user is deactivated, sign them out and return error
    if (profile && profile.is_active === false) {
      await supabase.auth.signOut();
      return {
        data: null,
        error: { message: "Your account has been deactivated. Please contact your administrator." } as any,
      };
    }
  }

  return { data, error };
}

export async function signUp(
  email: string, 
  password: string, 
  fullName: string,
  organizationName: string,
  organizationCode: string
) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${window.location.origin}/`,
      data: {
        full_name: fullName,
        organization_name: organizationName,
        organization_code: organizationCode,
      },
    },
  });
  return { data, error };
}

export async function signOut() {
  // Try global sign out first (revokes token server-side)
  const { error } = await supabase.auth.signOut({ scope: 'global' });
  if (error) {
    // If server-side fails (expired token, network issue), clear local state
    await supabase.auth.signOut({ scope: 'local' });
  }
  return { error: null }; // Always succeed from caller's perspective
}
