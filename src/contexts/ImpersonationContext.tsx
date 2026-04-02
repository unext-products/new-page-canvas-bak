import { createContext, useContext, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toDisplayRole, type DbRole } from "@/lib/roleMapping";
import type { UserWithRole } from "@/lib/supabase";

interface ImpersonatedUser {
  userId: string;
  fullName: string;
  role: string | null;
  userWithRole: UserWithRole;
}

interface ImpersonationContextType {
  impersonatedUser: ImpersonatedUser | null;
  isImpersonating: boolean;
  isReadOnly: boolean;
  startImpersonation: (userId: string) => Promise<void>;
  stopImpersonation: () => void;
}

const ImpersonationContext = createContext<ImpersonationContextType | undefined>(undefined);

export function ImpersonationProvider({ children }: { children: React.ReactNode }) {
  const [impersonatedUser, setImpersonatedUser] = useState<ImpersonatedUser | null>(null);

  const startImpersonation = useCallback(async (userId: string) => {
    const [roleResult, profileResult] = await Promise.all([
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

    if (roleResult.error || profileResult.error || !profileResult.data) {
      console.error("Failed to fetch impersonation data");
      return;
    }

    const role = toDisplayRole(roleResult.data?.role as DbRole | null);
    const verticalId = roleResult.data?.vertical_id || roleResult.data?.department_id || null;

    // We need a User object - create a minimal one from profile data
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) return;

    const fakeUserWithRole: UserWithRole = {
      user: currentUser, // keep real user for session
      role,
      verticalId,
      departmentId: verticalId,
      profile: profileResult.data,
    };

    setImpersonatedUser({
      userId,
      fullName: profileResult.data.full_name,
      role,
      userWithRole: fakeUserWithRole,
    });
  }, []);

  const stopImpersonation = useCallback(() => {
    setImpersonatedUser(null);
  }, []);

  return (
    <ImpersonationContext.Provider
      value={{
        impersonatedUser,
        isImpersonating: !!impersonatedUser,
        isReadOnly: !!impersonatedUser,
        startImpersonation,
        stopImpersonation,
      }}
    >
      {children}
    </ImpersonationContext.Provider>
  );
}

export function useImpersonation() {
  const context = useContext(ImpersonationContext);
  if (context === undefined) {
    throw new Error("useImpersonation must be used within an ImpersonationProvider");
  }
  return context;
}
