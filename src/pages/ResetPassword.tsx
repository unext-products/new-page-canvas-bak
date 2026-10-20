import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Logo } from "@/components/Logo";

export const INACTIVE_MESSAGE = "User is inactive. Kindly reach out to your administrator for assistance.";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => { if (data.session) setReady(true); });
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast({ title: "Password too short", description: "Use at least 8 characters.", variant: "destructive" });
      return;
    }
    if (password !== confirm) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Reset link is invalid or has expired. Please request a new one.");
      const { data: profile } = await supabase.from("profiles").select("is_active").eq("id", user.id).maybeSingle();
      if (profile && profile.is_active === false) {
        await supabase.auth.signOut({ scope: "local" });
        toast({ title: "Account inactive", description: INACTIVE_MESSAGE, variant: "destructive" });
        navigate("/");
        return;
      }
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      await supabase.auth.signOut({ scope: "local" });
      toast({ title: "Password updated", description: "Please sign in with your new password." });
      navigate("/");
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Could not reset password", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-md space-y-8">
        <div className="flex justify-center"><Logo to="/" variant="dark" size="lg" /></div>
        <div className="rounded-2xl bg-card border border-border p-8 shadow-sm">
          <h2 className="text-2xl font-semibold text-foreground mb-2 text-center">Set a new password</h2>
          {!ready ? (
            <p className="text-muted-foreground text-sm text-center">Verifying your reset link… If nothing happens, request a new link from the sign-in page.</p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 mt-6">
              <div className="space-y-2">
                <Label htmlFor="new-password">New password</Label>
                <Input id="new-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm password</Label>
                <Input id="confirm-password" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
              </div>
              <Button type="submit" className="w-full h-11" disabled={loading}>{loading ? "Updating..." : "Update Password"}</Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
