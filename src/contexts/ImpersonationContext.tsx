import { createContext, useContext, useState, useCallback } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { toDisplayRole, type DbRole } from "@/lib/roleMapping";
import type { UserWithRole } from "@/lib/supabase";
import { setImpersonationOverride } from "@/contexts/AuthContext";

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
        .select("full_name, phone, avatar_url, is_active, email")
        .eq("id", userId)
        .maybeSingle(),
    ]);

    if (roleResult.error || profileResult.error || !profileResult.data) {
      console.error("Failed to fetch impersonation data");
      return;
    }

    const role = toDisplayRole(roleResult.data?.role as DbRole | null);
    const verticalId = roleResult.data?.vertical_id || roleResult.data?.department_id || null;

    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) return;

    const impersonatedAuthUser: User = {
      ...currentUser,
      id: userId,
      email: profileResult.data.email ?? currentUser.email,
      user_metadata: {
        ...currentUser.user_metadata,
        full_name: profileResult.data.full_name,
      },
    };

    const fakeUserWithRole: UserWithRole = {
      user: impersonatedAuthUser,
      role,
      verticalId,
      departmentId: verticalId,
      profile: profileResult.data,
    };

    const impersonation: ImpersonatedUser = {
      userId,
      fullName: profileResult.data.full_name,
      role,
      userWithRole: fakeUserWithRole,
    };

    setImpersonatedUser(impersonation);
    setImpersonationOverride(fakeUserWithRole);
  }, []);

  const stopImpersonation = useCallback(() => {
    setImpersonatedUser(null);
    setImpersonationOverride(null);
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
