import { useState, useEffect } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn, signUp } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { Clock, CheckCircle2, BarChart3, Shield, ArrowLeft } from "lucide-react";
import { getUserErrorMessage } from "@/lib/errorHandler";

export default function Auth() {
  const [searchParams] = useSearchParams();
  const [isLogin, setIsLogin] = useState(!searchParams.get("signup"));
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
    <div className="min-h-screen bg-landing-dark">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Clock className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg font-semibold text-white">ClockWise</span>
          </Link>
          
          <Link 
            to="/" 
            className="flex items-center gap-2 text-sm text-landing-secondary hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>
        </div>
      </nav>

      {/* Main Content */}
      <div className="min-h-screen flex pt-20">
        {/* Left Side - Branding */}
        <div className="hidden lg:flex lg:w-1/2 items-center justify-center p-12 border-r border-landing-border">
          <div className="max-w-md space-y-8">
            <div className="space-y-4">
              <h1 className="text-4xl font-bold tracking-tight text-white font-display">
                Time tracking,
                <br />
                simplified.
              </h1>
              <p className="text-lg text-landing-secondary">
                Log hours, get approvals, understand where time goes.
              </p>
            </div>

            {/* Features List */}
            <div className="space-y-4 pt-4">
              {features.map((feature, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <feature.icon className="h-4 w-4 text-primary" />
                  </div>
                  <span className="text-landing-secondary">{feature.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Side - Auth Form */}
        <div className="w-full lg:w-1/2 flex items-center justify-center p-6 lg:p-12">
          <div className="w-full max-w-md">
            {/* Mobile Logo */}
            <div className="flex lg:hidden items-center justify-center gap-2 mb-8">
              <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
                <Clock className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-semibold text-white">ClockWise</span>
            </div>

            {/* Form Card */}
            <div className="rounded-2xl bg-landing-card border border-landing-border p-8">
              <div className="text-center mb-8">
                <h2 className="text-2xl font-semibold text-white mb-2">
                  {isLogin ? "Welcome back" : "Get started"}
                </h2>
                <p className="text-landing-secondary text-sm">
                  {isLogin
                    ? "Sign in to access your dashboard"
                    : "Create your account to begin"}
                </p>
              </div>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                {!isLogin && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="fullName" className="text-landing-secondary text-sm">
                        Full Name
                      </Label>
                      <Input
                        id="fullName"
                        type="text"
                        placeholder="John Doe"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        required
                        className="h-11 bg-landing-dark border-landing-border text-white placeholder:text-landing-muted focus:border-primary"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="organizationName" className="text-landing-secondary text-sm">
                        Organization Name
                      </Label>
                      <Input
                        id="organizationName"
                        type="text"
                        placeholder="Acme University"
                        value={organizationName}
                        onChange={(e) => setOrganizationName(e.target.value)}
                        required
                        className="h-11 bg-landing-dark border-landing-border text-white placeholder:text-landing-muted focus:border-primary"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="organizationCode" className="text-landing-secondary text-sm">
                        Organization Code
                      </Label>
                      <Input
                        id="organizationCode"
                        type="text"
                        placeholder="ACME"
                        value={organizationCode}
                        onChange={(e) => setOrganizationCode(e.target.value)}
                        required
                        className="h-11 bg-landing-dark border-landing-border text-white placeholder:text-landing-muted focus:border-primary"
                      />
                    </div>
                  </>
                )}
                
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-landing-secondary text-sm">
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-11 bg-landing-dark border-landing-border text-white placeholder:text-landing-muted focus:border-primary"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-landing-secondary text-sm">
                    Password
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="h-11 bg-landing-dark border-landing-border text-white placeholder:text-landing-muted focus:border-primary"
                  />
                </div>
                
                <Button
                  type="submit"
                  className="w-full h-11 bg-white text-landing-dark hover:bg-white/90 font-medium"
                  disabled={loading}
                >
                  {loading ? "Loading..." : isLogin ? "Sign In" : "Create Account"}
                </Button>
              </form>
              
              <div className="mt-6 space-y-4">
                <div className="text-center">
                  <span className="text-sm text-landing-muted">
                    {isLogin ? "Don't have an account?" : "Already have an account?"}
                  </span>
                  {" "}
                  <button
                    type="button"
                    className="text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                    onClick={() => setIsLogin(!isLogin)}
                  >
                    {isLogin ? "Sign up" : "Sign in"}
                  </button>
                </div>
                
                {/* Trust badge */}
                <div className="flex items-center justify-center gap-2 text-xs text-landing-muted pt-4 border-t border-landing-border">
                  <Shield className="h-3.5 w-3.5" />
                  <span>256-bit SSL encryption</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
