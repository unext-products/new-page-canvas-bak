import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { signIn, signUp } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Clock, CheckCircle2, BarChart3, Shield } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { getUserErrorMessage } from "@/lib/errorHandler";

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [organizationCode, setOrganizationCode] = useState("");
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      navigate("/dashboard");
    }
  }, [user, navigate]);

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

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-5xl px-6">
        <div className="glass-navbar rounded-full px-6 py-3 flex items-center justify-between border border-border/50 shadow-lg">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">C</span>
            </div>
            <span className="font-semibold text-foreground">ClockWise</span>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            <Link to="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Home
            </Link>
            <Link to="/pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Pricing
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="min-h-screen flex pt-24">
        {/* Left Side - Branding */}
        <div className="hidden lg:flex lg:w-1/2 items-center justify-center p-12 border-r border-border/50">
          <div className="max-w-md space-y-8">
            <div className="space-y-4">
              <h1 className="text-4xl font-bold tracking-tight">
                Time tracking,
                <br />
                simplified.
              </h1>
              <p className="text-lg text-muted-foreground">
                Log hours, get approvals, understand where time goes.
              </p>
            </div>

            {/* Simple Features List */}
            <div className="space-y-4 pt-4">
              {features.map((feature, i) => (
                <div key={i} className="flex items-center gap-3">
                  <feature.icon className="h-5 w-5 text-primary" />
                  <span className="text-muted-foreground">{feature.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Side - Auth Form */}
        <div className="w-full lg:w-1/2 flex items-center justify-center p-6 lg:p-12">
          <Card className="w-full max-w-md border border-border/50 shadow-sm">
            <CardHeader className="space-y-2 pb-6">
              {/* Mobile Logo */}
              <div className="flex lg:hidden items-center justify-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                  <span className="text-primary-foreground font-bold text-sm">C</span>
                </div>
                <span className="text-xl font-semibold">ClockWise</span>
              </div>
              
              <CardTitle className="text-2xl text-center font-semibold">
                {isLogin ? "Welcome back" : "Get started"}
              </CardTitle>
              <CardDescription className="text-center">
                {isLogin
                  ? "Sign in to access your dashboard"
                  : "Create your account to begin"}
              </CardDescription>
            </CardHeader>
            
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {!isLogin && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="fullName">Full Name</Label>
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
                      <Label htmlFor="organizationName">Organization Name</Label>
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
                      <Label htmlFor="organizationCode">Organization Code</Label>
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
                  <Label htmlFor="email">Email</Label>
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
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                
                <Button
                  type="submit"
                  className="w-full"
                  disabled={loading}
                >
                  {loading ? "Loading..." : isLogin ? "Sign In" : "Create Account"}
                </Button>
              </form>
              
              <div className="mt-6 space-y-4">
                <div className="text-center">
                  <span className="text-sm text-muted-foreground">
                    {isLogin ? "Don't have an account?" : "Already have an account?"}
                  </span>
                  {" "}
                  <Button
                    variant="link"
                    className="p-0 h-auto text-sm font-medium"
                    onClick={() => setIsLogin(!isLogin)}
                  >
                    {isLogin ? "Sign up" : "Sign in"}
                  </Button>
                </div>
                
                {/* Trust badge */}
                <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground pt-2 border-t border-border/50">
                  <Shield className="h-3.5 w-3.5" />
                  <span>256-bit SSL encryption</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
