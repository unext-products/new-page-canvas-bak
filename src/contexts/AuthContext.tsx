import { createContext, useContext, useEffect, useRef, useState, useCallback, useSyncExternalStore } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";
import { getUserWithRole, type UserWithRole } from "@/lib/supabase";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  userWithRole: UserWithRole | null;
  realUserWithRole: UserWithRole | null;
  loading: boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Impersonation override — module-level store so useAuth can react to it
let _impersonationOverride: UserWithRole | null = null;
let _impersonationListeners: Set<() => void> = new Set();

export function setImpersonationOverride(override: UserWithRole | null) {
  _impersonationOverride = override;
  _impersonationListeners.forEach(l => l());
}

function subscribeImpersonation(callback: () => void) {
  _impersonationListeners.add(callback);
  return () => { _impersonationListeners.delete(callback); };
}

function getImpersonationSnapshot() {
  return _impersonationOverride;
}

const AUTH_INIT_TIMEOUT_MS = 10000; // 10s watchdog

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userWithRole, setUserWithRole] = useState<UserWithRole | null>(null);
  const [loading, setLoading] = useState(true);
  
  const userWithRoleRef = useRef<UserWithRole | null>(null);
  const latestFetchId = useRef(0);
  const resolving = useRef(false);

  useEffect(() => {
    userWithRoleRef.current = userWithRole;
  }, [userWithRole]);

  const refreshUser = useCallback(async () => {
    if (user) {
      const userData = await getUserWithRole(user.id, user);
      if (userData) {
        setUserWithRole(userData);
      }
    }
  }, [user]);

  // Core async resolver — called outside the onAuthStateChange callback
  const resolveAuth = useCallback(async (sessionUser: User, fetchId: number) => {
    if (resolving.current && fetchId !== latestFetchId.current) return;
    resolving.current = true;

    try {
      const { data: { user: verifiedUser }, error: verifyError } = await supabase.auth.getUser();
      if (fetchId !== latestFetchId.current) return;

      if (verifyError || !verifiedUser) {
        console.warn("[Auth] Session invalid, clearing local session");
        await supabase.auth.signOut({ scope: 'local' });
        return;
      }

      // Attempt 1
      let userData = await getUserWithRole(verifiedUser.id, verifiedUser);
      if (fetchId !== latestFetchId.current) return;

      // Retry 1
      if (!userData) {
        await new Promise(r => setTimeout(r, 500));
        if (fetchId !== latestFetchId.current) return;
        userData = await getUserWithRole(sessionUser.id, sessionUser);
        if (fetchId !== latestFetchId.current) return;
      }

      // Retry 2
      if (!userData) {
        await new Promise(r => setTimeout(r, 1000));
        if (fetchId !== latestFetchId.current) return;
        userData = await getUserWithRole(sessionUser.id, sessionUser);
        if (fetchId !== latestFetchId.current) return;
      }

      // If still null, verify session validity
      if (!userData) {
        const { error: verifyError } = await supabase.auth.getUser();
        if (verifyError) {
          // Token is invalid — clear corrupted session
          console.warn("[Auth] Session invalid after retries, clearing local session");
          await supabase.auth.signOut({ scope: 'local' });
          return; // onAuthStateChange will fire again with null session
        }
      }

      if (fetchId === latestFetchId.current) {
        setUserWithRole(userData);
        setLoading(false);
      }
    } finally {
      resolving.current = false;
    }
  }, []);

  useEffect(() => {
    // Watchdog: if loading never resolves, force recovery
    const watchdog = setTimeout(() => {
      if (loading) {
        console.warn("[Auth] Watchdog triggered — forcing loading=false");
        setLoading(false);
      }
    }, AUTH_INIT_TIMEOUT_MS);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, currentSession) => {
        // Synchronous state updates only
        setSession(currentSession);
        setUser(currentSession?.user ?? null);

        if (currentSession?.user) {
          // Skip re-resolving when we already have healthy data for the same user.
          // This prevents data reloads on tab focus (SIGNED_IN/TOKEN_REFRESHED fire
          // when the tab regains focus and Supabase revalidates the session).
          const sameUser = userWithRoleRef.current?.user?.id === currentSession.user.id;
          const hasHealthyData = !!(userWithRoleRef.current?.role && userWithRoleRef.current?.profile);
          if ((event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN' || event === 'USER_UPDATED') && sameUser && hasHealthyData) {
            setLoading(false);
            return;
          }

          const fetchId = ++latestFetchId.current;
          // Queue async work outside the callback
          setTimeout(() => resolveAuth(currentSession.user, fetchId), 0);
        } else {
          // Signed out or no session
          latestFetchId.current++;
          setUserWithRole(null);
          setLoading(false);
        }
      }
    );

    return () => {
      clearTimeout(watchdog);
      subscription.unsubscribe();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AuthContext.Provider value={{ user, session, userWithRole, realUserWithRole: userWithRole, loading, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  
  const impersonationOverride = useSyncExternalStore(subscribeImpersonation, getImpersonationSnapshot);
  
  if (impersonationOverride) {
    return {
      ...context,
      userWithRole: impersonationOverride,
      realUserWithRole: context.userWithRole,
    };
  }
  
  return context;
}
