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
      {/* Animated gradient background for left side */}
      <div className="absolute inset-0 bg-gradient-mesh animate-gradient-shift opacity-60" />
      
      {/* Theme Toggle - Fixed Position */}
      <div className="fixed top-6 right-6 z-50">
        <ThemeToggle />
      </div>

      {/* Left Side - Branding & Showcase */}
      <div className="hidden lg:flex lg:w-1/2 relative items-center justify-center p-12">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background/50 to-accent/20 backdrop-blur-3xl" />
        
        <div className="relative z-10 max-w-lg space-y-8 animate-fade-in">
          {/* Logo & Title */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-gradient-to-br from-primary to-primary/70 shadow-lg shadow-primary/20">
                <Clock className="h-10 w-10 text-primary-foreground" />
              </div>
              <span className="text-4xl font-bold bg-gradient-to-r from-foreground via-foreground to-foreground/70 bg-clip-text text-transparent">
                ClockWise
              </span>
            </div>
            <h1 className="text-5xl font-bold leading-tight">
              Time tracking
              <br />
              <span className="bg-gradient-to-r from-primary via-primary/80 to-accent bg-clip-text text-transparent">
                made effortless
              </span>
            </h1>
            <p className="text-lg text-muted-foreground">
              Streamline your workflow with intelligent time management
            </p>
          </div>

          {/* Feature Highlights */}
          <div className="space-y-6 pt-8">
            {[
              { icon: Zap, title: "Lightning Fast", desc: "Track time in seconds" },
              { icon: Shield, title: "Secure & Private", desc: "Enterprise-grade security" },
              { icon: TrendingUp, title: "Smart Analytics", desc: "Actionable insights" }
            ].map((feature, i) => (
              <div
                key={i}
                className="flex items-start gap-4 p-4 rounded-xl bg-card/30 backdrop-blur-sm border border-border/40 hover:bg-card/50 transition-all duration-300 animate-fade-in"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <div className="p-2 rounded-lg bg-primary/10">
                  <feature.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Side - Auth Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 lg:p-12 relative">
        <div className="absolute inset-0 bg-background/95 backdrop-blur-xl lg:bg-background/80" />
        
        <Card className="w-full max-w-md relative z-10 bg-card/50 backdrop-blur-xl border-border/40 shadow-2xl animate-fade-in">
          <CardHeader className="space-y-1 pb-6">
            {/* Mobile Logo */}
            <div className="flex lg:hidden items-center justify-center gap-2 mb-4">
              <Clock className="h-8 w-8 text-primary" />
              <span className="text-2xl font-bold">ClockWise</span>
            </div>
            
            <CardTitle className="text-3xl text-center">
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
                    className="bg-background/50 border-border/60 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
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
                  className="bg-background/50 border-border/60 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
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
                  className="bg-background/50 border-border/60 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>
              
              <Button
                type="submit"
                className="w-full h-11 bg-gradient-to-r from-primary to-primary/80 hover:shadow-lg hover:shadow-primary/20 hover:scale-[1.02] transition-all duration-200"
                disabled={loading}
              >
                {loading ? "Loading..." : isLogin ? "Sign In" : "Create Account"}
              </Button>
            </form>
            
            <div className="mt-6 text-center">
              <span className="text-sm text-muted-foreground">
                {isLogin ? "Don't have an account?" : "Already have an account?"}
              </span>
              {" "}
              <Button
                variant="link"
                className="p-0 h-auto text-sm font-semibold text-primary hover:text-primary/80"
                onClick={() => setIsLogin(!isLogin)}
              >
                {isLogin ? "Sign up" : "Sign in"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
