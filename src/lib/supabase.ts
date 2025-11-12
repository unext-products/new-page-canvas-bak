import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

export type UserRole = "admin" | "hod" | "faculty";

export interface UserWithRole {
  user: User;
  role: UserRole | null;
  departmentId: string | null;
  profile: {
    full_name: string;
    phone: string | null;
    avatar_url: string | null;
    is_active: boolean;
  } | null;
}

export async function getUserWithRole(userId: string): Promise<UserWithRole | null> {
  try {
    const [roleData, profileData] = await Promise.all([
      supabase
        .from("user_roles")
        .select("role, department_id")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("profiles")
        .select("full_name, phone, avatar_url, is_active")
        .eq("id", userId)
        .maybeSingle(),
    ]);

    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return null;

    return {
      user,
      role: roleData.data?.role as UserRole | null,
      departmentId: roleData.data?.department_id || null,
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
  return { data, error };
}

export async function signUp(email: string, password: string, fullName: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${window.location.origin}/`,
      data: {
        full_name: fullName,
      },
    },
  });
  return { data, error };
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  return { error };
}
