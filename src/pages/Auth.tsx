import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { signIn, signUp } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Clock, Zap, Shield, TrendingUp } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
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
              description: error.message,
              variant: "destructive",
            });
          }
        } else {
          navigate("/dashboard");
        }
      } else {
        const { error } = await signUp(email, password, fullName);
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
              description: error.message,
              variant: "destructive",
            });
          }
        } else {
          toast({
            title: "Success",
            description: "Account created! Please contact your administrator to assign a role.",
          });
          setIsLogin(true);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex relative overflow-hidden">
      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-gradient-mesh animate-gradient-shift opacity-60" />
      
      {/* Floating gradient orbs */}
      <div className="absolute top-20 left-20 w-96 h-96 bg-primary/30 rounded-full blur-3xl animate-float-slow" />
      <div className="absolute bottom-20 right-20 w-96 h-96 bg-accent/20 rounded-full blur-3xl animate-float-slow" style={{ animationDelay: "5s" }} />
      
      {/* Animated dots grid */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: "radial-gradient(circle, currentColor 1px, transparent 1px)",
          backgroundSize: "40px 40px"
        }} />
      </div>
      
      {/* Theme Toggle - Fixed Position */}
      <div className="fixed top-6 right-6 z-50">
        <ThemeToggle />
      </div>

      {/* Left Side - Branding & Showcase */}
      <div className="hidden lg:flex lg:w-1/2 relative items-center justify-center p-12">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background/50 to-accent/20 backdrop-blur-3xl" />
        
        <div className="relative z-10 max-w-lg space-y-10 animate-fade-in">
          {/* Logo & Title */}
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="p-4 rounded-2xl bg-gradient-to-br from-primary to-primary/70 shadow-2xl shadow-primary/30 animate-pulse-glow">
                <Clock className="h-12 w-12 text-primary-foreground" />
              </div>
              <span className="text-5xl font-bold bg-gradient-to-r from-foreground via-foreground to-foreground/70 bg-clip-text text-transparent">
                ClockWise
              </span>
            </div>
            <h1 className="text-6xl font-bold leading-tight tracking-tight">
              Time tracking
              <br />
              <span className="bg-gradient-to-r from-primary via-primary/90 to-primary/70 bg-clip-text text-transparent">
                made effortless
              </span>
            </h1>
            <p className="text-xl text-muted-foreground leading-relaxed">
              Streamline your workflow with intelligent time management
            </p>
            
            {/* Stats showcase */}
            <div className="flex items-center gap-6 pt-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-primary">10k+</div>
                <div className="text-sm text-muted-foreground">Teams</div>
              </div>
              <div className="w-px h-12 bg-border" />
              <div className="text-center">
                <div className="text-3xl font-bold text-primary">99.9%</div>
                <div className="text-sm text-muted-foreground">Uptime</div>
              </div>
              <div className="w-px h-12 bg-border" />
              <div className="text-center">
                <div className="text-3xl font-bold text-primary">24/7</div>
                <div className="text-sm text-muted-foreground">Support</div>
              </div>
            </div>
          </div>

          {/* Feature Highlights */}
          <div className="space-y-5">
            {[
              { icon: Zap, title: "Lightning Fast", desc: "Track time in seconds, not minutes" },
              { icon: Shield, title: "Secure & Private", desc: "Enterprise-grade encryption" },
              { icon: TrendingUp, title: "Smart Analytics", desc: "AI-powered insights & reports" }
            ].map((feature, i) => (
              <div
                key={i}
                className="group flex items-start gap-4 p-5 rounded-xl bg-card/40 backdrop-blur-md border border-border/50 hover:bg-card/60 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/10 hover:-translate-y-1 transition-all duration-300 animate-fade-in"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <div className="p-3 rounded-xl bg-primary/10 group-hover:bg-primary/20 group-hover:shadow-lg group-hover:shadow-primary/20 transition-all duration-300">
                  <feature.icon className="h-6 w-6 text-primary group-hover:scale-110 transition-transform duration-300" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-semibold text-base">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Side - Auth Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 lg:p-12 relative">
        <div className="absolute inset-0 bg-background/95 backdrop-blur-xl lg:bg-background/80" />
        
        <Card className="w-full max-w-md relative z-10 bg-card/60 backdrop-blur-2xl border-border/50 shadow-2xl hover:shadow-primary/10 animate-fade-in" style={{ boxShadow: "var(--glass-shadow)" }}>
          <CardHeader className="space-y-2 pb-8">
            {/* Mobile Logo */}
            <div className="flex lg:hidden items-center justify-center gap-3 mb-6">
              <div className="p-2 rounded-xl bg-gradient-to-br from-primary to-primary/70 shadow-lg shadow-primary/20">
                <Clock className="h-8 w-8 text-primary-foreground" />
              </div>
              <span className="text-3xl font-bold">ClockWise</span>
            </div>
            
            <CardTitle className="text-3xl text-center font-bold">
              {isLogin ? "Welcome back" : "Get started"}
            </CardTitle>
            <CardDescription className="text-center text-base">
              {isLogin
                ? "Sign in to access your dashboard"
                : "Create your account to begin"}
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="fullName" className="text-sm font-medium">
                    Full Name
                  </Label>
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="John Doe"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    className="bg-background/60 border-border/60 focus:border-primary focus:ring-2 focus:ring-primary/30 transition-all h-11"
                  />
                </div>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="bg-background/60 border-border/60 focus:border-primary focus:ring-2 focus:ring-primary/30 transition-all h-11"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="bg-background/60 border-border/60 focus:border-primary focus:ring-2 focus:ring-primary/30 transition-all h-11"
                />
              </div>
              
              <Button
                type="submit"
                className="relative w-full h-12 bg-gradient-to-r from-primary to-primary/80 hover:shadow-xl hover:shadow-primary/30 hover:scale-[1.02] transition-all duration-300 overflow-hidden group"
                disabled={loading}
              >
                <span className="relative z-10">
                  {loading ? "Loading..." : isLogin ? "Sign In" : "Create Account"}
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000" />
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
                  className="p-0 h-auto text-sm font-semibold text-primary hover:text-primary/80 transition-colors"
                  onClick={() => setIsLogin(!isLogin)}
                >
                  {isLogin ? "Sign up" : "Sign in"}
                </Button>
              </div>
              
              {/* Trust badge */}
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground pt-2 border-t border-border/40">
                <Shield className="h-3.5 w-3.5 text-primary" />
                <span>256-bit SSL encryption • SOC 2 certified</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
