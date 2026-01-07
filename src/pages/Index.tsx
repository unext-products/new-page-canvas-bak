import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn, signUp } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, BarChart3, Shield, Clock, ExternalLink } from "lucide-react";
import { getUserErrorMessage } from "@/lib/errorHandler";
import { Logo } from "@/components/Logo";

export default function Index() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [organizationCode, setOrganizationCode] = useState("");
  const [loading, setLoading] = useState(false);
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!authLoading && user) {
      navigate("/dashboard");
    }
  }, [user, authLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
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
      } else {
        const { error } = await signUp(email, password, fullName, organizationName, organizationCode);
        if (error) {
          if (error.message.includes("already registered")) {
            toast({
              title: "Account exists",
              description: "This email is already registered. Please sign in.",
              variant: "destructive",
            });
          } else {
            toast({
              title: "Error",
              description: getUserErrorMessage(error, "sign up"),
              variant: "destructive",
            });
          }
        } else {
          toast({
            title: "Success",
            description: "Account created! Your organization has been set up and you are now the admin.",
          });
          setIsLogin(true);
        }
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
  const userGuideLink = "https://drive.google.com/file/d/18fqbNj6iTKGlmN6xOQwLuWI2P0FjlV0X/view?usp=sharing";

  if (authLoading) {
    return null;
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
                <h2 className="text-2xl font-semibold text-foreground mb-2">
                  {isLogin ? "Welcome" : "Get started"}
                </h2>
                <p className="text-muted-foreground text-sm">
                  {isLogin ? "Sign in to access your dashboard" : "Create your account to begin"}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {!isLogin && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="fullName" className="text-muted-foreground text-sm">
                        Full Name
                      </Label>
                      <Input
                        id="fullName"
                        type="text"
                        placeholder="John Doe"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="organizationName" className="text-muted-foreground text-sm">
                        Organization Name
                      </Label>
                      <Input
                        id="organizationName"
                        type="text"
                        placeholder="Acme University"
                        value={organizationName}
                        onChange={(e) => setOrganizationName(e.target.value)}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="organizationCode" className="text-muted-foreground text-sm">
                        Organization Code
                      </Label>
                      <Input
                        id="organizationCode"
                        type="text"
                        placeholder="ACME"
                        value={organizationCode}
                        onChange={(e) => setOrganizationCode(e.target.value)}
                        required
                      />
                    </div>
                  </>
                )}

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
                  {loading ? "Loading..." : isLogin ? "Sign In" : "Create Account"}
                </Button>
              </form>

              <div className="mt-6 space-y-4">
                <div className="text-center">
                  <span className="text-sm text-muted-foreground">
                    {isLogin ? "Don't have an account?" : "Already have an account?"}
                  </span>{" "}
                  <button
                    type="button"
                    className="text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                    onClick={() => setIsLogin(!isLogin)}
                  >
                    {isLogin ? "Sign up" : "Sign in"}
                  </button>
                </div>

                {/* Trust badge */}
                <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground pt-4 border-t border-border">
                  <Shield className="h-3.5 w-3.5" />
                  <span>256-bit SSL encryption</span>
                </div>

                {/* Mobile User Guide Link */}
                <div className="flex lg:hidden items-center justify-center pt-2">
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
    </div>
  );
}
