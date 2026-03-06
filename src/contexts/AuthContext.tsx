import { createContext, useContext, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";
import { getUserWithRole, type UserWithRole } from "@/lib/supabase";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  userWithRole: UserWithRole | null;
  loading: boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userWithRole, setUserWithRole] = useState<UserWithRole | null>(null);
  const [loading, setLoading] = useState(true);
  const userWithRoleRef = useRef<UserWithRole | null>(null);

  // Keep ref in sync with state
  useEffect(() => {
    userWithRoleRef.current = userWithRole;
  }, [userWithRole]);

  const refreshUser = async () => {
    if (user) {
      const userData = await getUserWithRole(user.id, user);
      setUserWithRole(userData);
    }
  };

  useEffect(() => {
    let latestFetchId = 0;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          // On TOKEN_REFRESHED, skip re-fetch if we already have data
          if (event === 'TOKEN_REFRESHED' && userWithRoleRef.current) {
            setLoading(false);
            return;
          }

          const fetchId = ++latestFetchId;

          // Fetch with retry (up to 2 attempts)
          let userData = await getUserWithRole(session.user.id, session.user);
          if (!userData && fetchId === latestFetchId) {
            await new Promise(r => setTimeout(r, 500));
            userData = await getUserWithRole(session.user.id, session.user);
          }
          if (!userData && fetchId === latestFetchId) {
            await new Promise(r => setTimeout(r, 1000));
            userData = await getUserWithRole(session.user.id, session.user);
          }

          // If still null, verify session is actually valid
          if (!userData && fetchId === latestFetchId) {
            const { error: verifyError } = await supabase.auth.getUser();
            if (verifyError) {
              // Token is invalid — clear corrupted session
              await supabase.auth.signOut({ scope: 'local' });
              return; // onAuthStateChange will fire again with null session
            }
          }

          // Only update if this is still the latest fetch
          if (fetchId === latestFetchId) {
            setUserWithRole(userData);
            setLoading(false);
          }
        } else {
          setUserWithRole(null);
          setLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, userWithRole, loading, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
