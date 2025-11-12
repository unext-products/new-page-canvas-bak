import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useCursorSpotlight } from "@/hooks/useCursorSpotlight";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";
import {
  Clock,
  CheckCircle2,
  BarChart3,
  Users,
  Shield,
  Zap,
  ArrowRight,
  Sparkles,
  TrendingUp,
  FileCheck,
} from "lucide-react";

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const cursorPosition = useCursorSpotlight();

  const featuresRef = useRef<HTMLDivElement>(null);
  const howItWorksRef = useRef<HTMLDivElement>(null);
  const benefitsRef = useRef<HTMLDivElement>(null);

  const isFeaturesVisible = useScrollAnimation(featuresRef);
  const isHowItWorksVisible = useScrollAnimation(howItWorksRef);
  const isBenefitsVisible = useScrollAnimation(benefitsRef);

  useEffect(() => {
    if (!loading && user) {
      navigate("/dashboard");
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  const features = [
    {
      icon: Clock,
      title: "Smart Time Tracking",
      description: "Intuitive interface for faculty to log hours with precision and ease.",
      gradient: "from-primary to-purple-500",
      size: "large",
    },
    {
      icon: CheckCircle2,
      title: "Approval Workflows",
      description: "Streamlined review process for HODs and administrators.",
      gradient: "from-purple-500 to-pink-500",
      size: "small",
    },
    {
      icon: BarChart3,
      title: "Advanced Analytics",
      description: "Real-time insights with comprehensive reporting tools.",
      gradient: "from-pink-500 to-primary",
      size: "small",
    },
    {
      icon: Users,
      title: "Department Management",
      description: "Organize faculty by departments with role-based access.",
      gradient: "from-primary to-cyan-500",
      size: "medium",
    },
    {
      icon: Shield,
      title: "Secure & Compliant",
      description: "Enterprise-grade security with audit trails.",
      gradient: "from-cyan-500 to-primary",
      size: "medium",
    },
    {
      icon: Zap,
      title: "Bulk Operations",
      description: "Import and export data with CSV/Excel support.",
      gradient: "from-purple-500 to-primary",
      size: "small",
    },
  ];

  const steps = [
    {
      icon: Clock,
      title: "Faculty Log Hours",
      description: "Instructors record their teaching and administrative hours with detailed activity descriptions.",
    },
    {
      icon: FileCheck,
      title: "HODs Review",
      description: "Department heads review and approve submitted timesheets in real-time.",
    },
    {
      icon: TrendingUp,
      title: "Generate Reports",
      description: "Administrators access comprehensive analytics and export reports instantly.",
    },
  ];

  const benefits = [
    "Reduce administrative overhead by 70%",
    "Real-time visibility into faculty workload",
    "Eliminate timesheet disputes with audit trails",
    "Automated compliance reporting",
    "Mobile-friendly interface for on-the-go access",
    "Seamless integration with existing systems",
  ];

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Cursor Spotlight Effect */}
      <div
        className="pointer-events-none fixed inset-0 z-30 transition-opacity duration-300"
        style={{
          background: `radial-gradient(600px at ${cursorPosition.x}px ${cursorPosition.y}px, rgba(109, 40, 217, 0.15), transparent 80%)`,
        }}
      />

      {/* Animated Background Gradient */}
      <div className="fixed inset-0 z-0 bg-gradient-mesh animate-gradient-shift bg-[length:200%_200%]" />
      <div className="fixed inset-0 z-0 bg-background/95 backdrop-blur-xl" />

      {/* Content */}
      <div className="relative z-10">
        {/* Navigation */}
        <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/40 backdrop-blur-xl bg-background/60">
          <div className="container mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-gradient-to-br from-primary to-purple-500">
                  <Clock className="h-6 w-6 text-white" />
                </div>
                <span className="text-2xl font-bold bg-gradient-to-r from-primary via-purple-500 to-pink-500 bg-clip-text text-transparent">
                  ClockWise
                </span>
              </div>
              <div className="flex items-center gap-3">
                <ThemeToggle />
                <Button variant="ghost" onClick={() => navigate("/auth")} className="hover:scale-105 transition-transform">
                  Login
                </Button>
                <Button onClick={() => navigate("/auth")} className="bg-gradient-to-r from-primary to-purple-500 hover:opacity-90 transition-opacity">
                  Get Started
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </nav>

        {/* Hero Section */}
        <section className="pt-32 pb-20 px-6">
          <div className="container mx-auto max-w-6xl">
            <div className="text-center space-y-8 animate-fade-in-up">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/20 bg-primary/5 backdrop-blur-sm">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">The Future of Faculty Management</span>
              </div>
              
              <h1 className="text-6xl md:text-8xl font-bold leading-tight">
                <span className="bg-gradient-to-r from-primary via-purple-500 to-pink-500 bg-clip-text text-transparent animate-gradient-shift bg-[length:200%_200%]">
                  Time Tracking
                </span>
                <br />
                <span className="text-foreground">Reimagined</span>
              </h1>
              
              <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
                The intelligent platform that transforms how educational institutions manage faculty timesheets, 
                approvals, and reporting.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
                <Button 
                  size="lg" 
                  onClick={() => navigate("/auth")} 
                  className="text-lg px-8 py-6 bg-gradient-to-r from-primary to-purple-500 hover:opacity-90 transition-all hover:scale-105"
                >
                  Start Free Trial
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                <Button 
                  size="lg" 
                  variant="outline" 
                  className="text-lg px-8 py-6 backdrop-blur-sm border-border/40 hover:bg-accent/50 hover:scale-105 transition-all"
                >
                  Watch Demo
                </Button>
              </div>

              {/* Floating Elements */}
              <div className="relative h-40 mt-16">
                <div className="absolute top-0 left-1/4 animate-float">
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-primary/20 to-purple-500/20 backdrop-blur-xl border border-border/40">
                    <CheckCircle2 className="h-8 w-8 text-primary" />
                  </div>
                </div>
                <div className="absolute top-0 right-1/4 animate-float" style={{ animationDelay: "1s" }}>
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 backdrop-blur-xl border border-border/40">
                    <BarChart3 className="h-8 w-8 text-purple-500" />
                  </div>
                </div>
                <div className="absolute top-10 left-1/2 -translate-x-1/2 animate-float" style={{ animationDelay: "2s" }}>
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-pink-500/20 to-primary/20 backdrop-blur-xl border border-border/40">
                    <Zap className="h-8 w-8 text-pink-500" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section - Bento Grid */}
        <section ref={featuresRef} className="py-20 px-6">
          <div className="container mx-auto max-w-7xl">
            <div className="text-center mb-16 animate-fade-in-up">
              <h2 className="text-5xl font-bold mb-4 bg-gradient-to-r from-foreground to-foreground/60 bg-clip-text text-transparent">
                Powerful Features
              </h2>
              <p className="text-xl text-muted-foreground">Everything you need to manage faculty time effectively</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-fade-in-up">
              {features.map((feature, index) => {
                const Icon = feature.icon;
                const colSpan = feature.size === "large" ? "md:col-span-2" : feature.size === "medium" ? "md:col-span-2" : "md:col-span-1";
                const rowSpan = feature.size === "large" ? "md:row-span-2" : "";
                
                return (
                  <div
                    key={index}
                    className={`${colSpan} ${rowSpan} group relative p-8 rounded-3xl border border-border/40 hover:border-primary/50 transition-all duration-500 hover:scale-[1.02] cursor-pointer overflow-hidden`}
                    style={{ 
                      background: "var(--glass-bg)",
                      backdropFilter: "blur(20px)",
                      boxShadow: "var(--glass-shadow)",
                      animationDelay: `${index * 0.1}s`
                    }}
                  >
                    {/* Gradient Background on Hover */}
                    <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-500`} />
                    
                    <div className="relative z-10">
                      <div className={`inline-flex p-3 rounded-2xl bg-gradient-to-br ${feature.gradient} mb-6`}>
                        <Icon className="h-8 w-8 text-white" />
                      </div>
                      <h3 className="text-2xl font-bold mb-3">{feature.title}</h3>
                      <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section ref={howItWorksRef} className="py-20 px-6">
          <div className="container mx-auto max-w-5xl">
            <div className={`text-center mb-16 ${isHowItWorksVisible ? "animate-fade-in-up" : "opacity-0"}`}>
              <h2 className="text-5xl font-bold mb-4 bg-gradient-to-r from-foreground to-foreground/60 bg-clip-text text-transparent">
                How It Works
              </h2>
              <p className="text-xl text-muted-foreground">Simple, efficient, and effective</p>
            </div>

            <div className={`space-y-8 ${isHowItWorksVisible ? "animate-fade-in-up" : "opacity-0"}`}>
              {steps.map((step, index) => {
                const Icon = step.icon;
                return (
                  <div
                    key={index}
                    className="flex gap-6 p-8 rounded-3xl border border-border/40 hover:border-primary/50 transition-all duration-300 group"
                    style={{
                      background: "var(--glass-bg)",
                      backdropFilter: "blur(20px)",
                      boxShadow: "var(--glass-shadow)",
                      animationDelay: `${index * 0.15}s`
                    }}
                  >
                    <div className="flex-shrink-0">
                      <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-purple-500 text-white text-2xl font-bold">
                        {index + 1}
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <Icon className="h-6 w-6 text-primary" />
                        <h3 className="text-2xl font-bold">{step.title}</h3>
                      </div>
                      <p className="text-lg text-muted-foreground leading-relaxed">{step.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Benefits Section */}
        <section ref={benefitsRef} className="py-20 px-6">
          <div className="container mx-auto max-w-6xl">
            <div className={`text-center mb-16 ${isBenefitsVisible ? "animate-fade-in-up" : "opacity-0"}`}>
              <h2 className="text-5xl font-bold mb-4 bg-gradient-to-r from-foreground to-foreground/60 bg-clip-text text-transparent">
                Why Choose ClockWise
              </h2>
              <p className="text-xl text-muted-foreground">Transform your institution's time management</p>
            </div>

            <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 ${isBenefitsVisible ? "animate-fade-in-up" : "opacity-0"}`}>
              {benefits.map((benefit, index) => (
                <div
                  key={index}
                  className="flex items-center gap-4 p-6 rounded-2xl border border-border/40 hover:border-primary/50 transition-all duration-300 group"
                  style={{
                    background: "var(--glass-bg)",
                    backdropFilter: "blur(20px)",
                    boxShadow: "var(--glass-shadow)",
                    animationDelay: `${index * 0.1}s`
                  }}
                >
                  <div className="flex-shrink-0">
                    <CheckCircle2 className="h-6 w-6 text-primary group-hover:scale-110 transition-transform" />
                  </div>
                  <span className="text-lg font-medium">{benefit}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-32 px-6">
          <div className="container mx-auto max-w-4xl">
            <div 
              className="relative p-12 md:p-20 rounded-3xl overflow-hidden animate-fade-in-up"
              style={{
                background: "var(--glass-bg)",
                backdropFilter: "blur(20px)",
                boxShadow: "var(--glass-shadow)",
                border: "1px solid var(--glass-border)",
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-purple-500/20 to-pink-500/20" />
              <div className="relative z-10 text-center space-y-6">
                <h2 className="text-4xl md:text-6xl font-bold">
                  <span className="bg-gradient-to-r from-primary via-purple-500 to-pink-500 bg-clip-text text-transparent">
                    Ready to Transform
                  </span>
                  <br />
                  <span className="text-foreground">Your Workflow?</span>
                </h2>
                <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                  Join hundreds of institutions already using ClockWise to streamline their faculty management.
                </p>
                <Button 
                  size="lg" 
                  onClick={() => navigate("/auth")} 
                  className="text-lg px-10 py-7 bg-gradient-to-r from-primary to-purple-500 hover:opacity-90 transition-all hover:scale-105 mt-6"
                >
                  Get Started Now
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-12 px-6 border-t border-border/40 backdrop-blur-xl">
          <div className="container mx-auto max-w-6xl">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-gradient-to-br from-primary to-purple-500">
                  <Clock className="h-5 w-5 text-white" />
                </div>
                <span className="text-xl font-bold bg-gradient-to-r from-primary via-purple-500 to-pink-500 bg-clip-text text-transparent">
                  ClockWise
                </span>
              </div>
              <p className="text-muted-foreground">
                © 2024 ClockWise. All rights reserved.
              </p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default Index;
