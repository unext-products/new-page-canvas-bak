import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, BarChart3, Clock, ExternalLink } from "lucide-react";
import { getUserErrorMessage } from "@/lib/errorHandler";
import { Logo } from "@/components/Logo";

export default function Index() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { user, session, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!authLoading && user && session) {
      navigate("/dashboard");
    }
  }, [user, session, authLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await signIn(email, password);
      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          toast({
            title: "Login failed",
            description: "Invalid email or password",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Error",
            description: getUserErrorMessage(error, "sign in"),
            variant: "destructive",
          });
        }
      } else {
        navigate("/dashboard");
      }
    } finally {
      setLoading(false);
    }
  };

  const features = [
    { icon: Clock, text: "Log hours in seconds" },
    { icon: CheckCircle2, text: "Easy approval workflows" },
    { icon: BarChart3, text: "Insightful reports" },
  ];

  // Placeholder link for User Guide - replace with actual link
  const userGuideLink = "https://drive.google.com/file/d/1CkrO9DyGA2PDVfiuXOvVWTOm9rcZJSvj/view?usp=sharing";

  // Show a branded loading state instead of blank page
  if (authLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <Logo to="/" variant="dark" size="lg" />
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Main Content */}
      <div className="min-h-screen flex">
        {/* Left Side - Branding & Description */}
        <div className="hidden lg:flex lg:w-1/2 items-center justify-center p-12 border-r border-border bg-muted/30">
          <div className="max-w-md space-y-8">
            {/* Logo */}
            <Logo to="/" variant="dark" size="lg" />

            <div className="space-y-4">
              <h1 className="text-4xl font-bold tracking-tight text-foreground font-display">
                Time tracking,
                <br />
                simplified.
              </h1>
              <p className="text-lg text-muted-foreground">Log hours, get approvals, understand where time goes.</p>
            </div>

            {/* Features List */}
            <div className="space-y-4 pt-4">
              {features.map((feature, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <feature.icon className="h-4 w-4 text-primary" />
                  </div>
                  <span className="text-muted-foreground">{feature.text}</span>
                </div>
              ))}
            </div>

            {/* User Guide Button */}
            <div className="pt-4">
              <Button variant="outline" className="gap-2" onClick={() => window.open(userGuideLink, "_blank")}>
                <ExternalLink className="h-4 w-4" />
                View User Guide
              </Button>
            </div>
          </div>
        </div>

        {/* Right Side - Auth Form */}
        <div className="w-full lg:w-1/2 flex items-center justify-center p-6 lg:p-12 bg-background">
          <div className="w-full max-w-md">
            {/* Mobile Logo */}
            <div className="flex lg:hidden items-center justify-center mb-8">
              <Logo to="/" variant="dark" size="lg" />
            </div>

            {/* Form Card */}
            <div className="rounded-2xl bg-card border border-border p-8 shadow-sm">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-semibold text-foreground mb-2">Welcome</h2>
                <p className="text-muted-foreground text-sm">
                  Sign in to access your dashboard
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-muted-foreground text-sm">
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-muted-foreground text-sm">
                    Password
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>

                <Button type="submit" className="w-full h-11 font-medium" disabled={loading}>
                  {loading ? "Loading..." : "Sign In"}
                </Button>
              </form>

              {/* Mobile User Guide Link */}
              <div className="flex lg:hidden items-center justify-center pt-6">
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-2 text-muted-foreground"
                  onClick={() => window.open(userGuideLink, "_blank")}
                >
                  <ExternalLink className="h-4 w-4" />
                  View User Guide
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
