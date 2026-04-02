import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Wrench, LogOut } from "lucide-react";

export default function Maintenance() {
  const handleLogout = async () => {
    await supabase.auth.signOut({ scope: "local" });
    window.location.href = "/";
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <div className="flex flex-col items-center gap-6 max-w-md text-center">
        <Logo to="/" variant="dark" size="lg" />
        <div className="rounded-full bg-muted p-4">
          <Wrench className="h-10 w-10 text-muted-foreground" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold font-display text-foreground">
            Under Maintenance
          </h1>
          <p className="text-muted-foreground">
            The system is currently under maintenance. Please check back later.
          </p>
        </div>
        <Button variant="outline" onClick={handleLogout} className="gap-2">
          <LogOut className="h-4 w-4" />
          Logout
        </Button>
      </div>
    </div>
  );
}
