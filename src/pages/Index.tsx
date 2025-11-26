import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useCursorSpotlight } from "@/hooks/useCursorSpotlight";
import { useScrollAnimation } from "@/hooks/useScrollAnimation";
import {
  Clock,
  ArrowRight,
  Zap,
  Shield,
  TrendingUp,
  Users,
  BarChart3,
  CheckCircle,
  Sparkles,
  MousePointer2,
} from "lucide-react";
import dashboardMockup from "@/assets/dashboard-mockup.jpg";
import timesheetMockup from "@/assets/timesheet-entry-mockup.jpg";
import approvalsMockup from "@/assets/approvals-mockup.jpg";
import analyticsMockup from "@/assets/analytics-mockup.jpg";

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const cursorPosition = useCursorSpotlight();
  const [activeFeature, setActiveFeature] = useState(0);

  const heroRef = useRef<HTMLDivElement>(null);
  const featuresRef = useRef<HTMLDivElement>(null);
  const showcaseRef = useRef<HTMLDivElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);

  const isFeaturesVisible = useScrollAnimation(featuresRef);
  const isShowcaseVisible = useScrollAnimation(showcaseRef);
  const isStatsVisible = useScrollAnimation(statsRef);

  useEffect(() => {
    if (!loading && user) {
      navigate("/dashboard");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveFeature((prev) => (prev + 1) % 4);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  const features = [
    {
      icon: Zap,
      title: "Lightning Fast",
      description: "Submit and approve timesheets in seconds, not hours",
      color: "from-yellow-500 to-orange-500",
    },
    {
      icon: Shield,
      title: "Secure & Compliant",
      description: "Bank-grade security with automatic audit trails",
      color: "from-blue-500 to-cyan-500",
    },
    {
      icon: BarChart3,
      title: "Smart Analytics",
      description: "AI-powered insights into workforce productivity",
      color: "from-purple-500 to-pink-500",
    },
    {
      icon: Users,
      title: "Team Collaboration",
      description: "Real-time sync across all departments",
      color: "from-green-500 to-emerald-500",
    },
  ];

  const stats = [
    { value: "10K+", label: "Active Users" },
    { value: "99.9%", label: "Uptime" },
    { value: "2M+", label: "Hours Tracked" },
    { value: "500+", label: "Companies" },
  ];

  return (
    <div className="min-h-screen relative overflow-hidden bg-background">
      {/* Enhanced Cursor Spotlight */}
      <div
        className="pointer-events-none fixed inset-0 z-30 transition-opacity duration-500"
        style={{
          background: `radial-gradient(800px circle at ${cursorPosition.x}px ${cursorPosition.y}px, rgba(59, 130, 246, 0.08), transparent 70%)`,
        }}
      />

      {/* Dynamic Background Grid */}
      <div className="fixed inset-0 z-0">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border))_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border))_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_110%)] opacity-20" />
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-purple-500/5" />
      </div>

      {/* Floating orbs */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-[120px] animate-pulse delay-1000" />
      </div>

      {/* Content */}
      <div className="relative z-10">
        {/* Navigation - Floating Glass Pill */}
        <nav className="fixed top-4 left-4 right-4 z-50 flex justify-center">
          <div className="glass-navbar flex items-center justify-between gap-6 px-6 py-3 
            bg-white/[0.08] dark:bg-black/[0.15]
            backdrop-blur-[60px] backdrop-saturate-[180%]
            border border-white/[0.1] dark:border-white/[0.05]
            shadow-[0_8px_32px_rgba(0,0,0,0.12)]
            rounded-full max-w-5xl w-full">
            
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              <span className="font-semibold italic text-foreground">ClockWise</span>
            </div>
            
            <div className="hidden md:flex items-center gap-8">
              <button 
                className="text-[15px] text-foreground/70 hover:text-foreground transition-colors font-medium"
              >
                Features
              </button>
              <button 
                onClick={() => navigate("/pricing")}
                className="text-[15px] text-foreground/70 hover:text-foreground transition-colors font-medium"
              >
                Pricing
              </button>
              <button 
                onClick={() => navigate("/auth")}
                className="text-[15px] text-foreground/70 hover:text-foreground transition-colors font-medium"
              >
                Login
              </button>
            </div>

            <div className="flex items-center gap-3">
              <ThemeToggle />
              <Button 
                onClick={() => navigate("/auth")}
                className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 px-6 shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all hover:scale-105"
              >
                Get started
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </nav>

        {/* Hero Section - Bento Grid Layout */}
        <section ref={heroRef} className="pt-32 pb-20 px-4 sm:px-6">
          <div className="container mx-auto max-w-7xl">
            {/* Hero Content */}
            <div className="text-center mb-16 space-y-8">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full 
                bg-primary/10 border border-primary/20 backdrop-blur-sm
                hover:bg-primary/15 transition-all group cursor-pointer">
                <Sparkles className="h-4 w-4 text-primary animate-pulse" />
                <span className="text-sm font-medium text-foreground">AI-Powered Workforce Management</span>
                <ArrowRight className="h-3 w-3 text-primary group-hover:translate-x-1 transition-transform" />
              </div>
              
              <div className="space-y-6">
                <h1 className="text-5xl sm:text-6xl lg:text-8xl font-black leading-[1.1] tracking-tight">
                  <span className="block text-foreground">Time Tracking</span>
                  <span className="block bg-gradient-to-r from-primary via-blue-500 to-purple-500 bg-clip-text text-transparent">
                    Redesigned
                  </span>
                </h1>
                
                <p className="text-xl sm:text-2xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
                  The intelligent platform that transforms workforce management with 
                  <span className="text-foreground font-semibold"> real-time approvals</span>,
                  <span className="text-foreground font-semibold"> smart analytics</span>, and
                  <span className="text-foreground font-semibold"> seamless collaboration</span>
                </p>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                <Button 
                  size="lg" 
                  onClick={() => navigate("/auth")} 
                  className="text-lg px-8 py-6 bg-primary hover:bg-primary/90 shadow-2xl shadow-primary/20 hover:shadow-primary/30 transition-all hover:scale-105 group"
                >
                  Start Free Trial
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Button>
                <Button 
                  size="lg" 
                  variant="outline" 
                  className="text-lg px-8 py-6 backdrop-blur-sm border-2 hover:bg-accent/50 hover:scale-105 transition-all group"
                >
                  <MousePointer2 className="mr-2 h-5 w-5 group-hover:scale-110 transition-transform" />
                  Watch Demo
                </Button>
              </div>

              <div className="flex items-center justify-center gap-8 pt-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-primary" />
                  <span>No credit card required</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-primary" />
                  <span>14-day free trial</span>
                </div>
              </div>
            </div>

            {/* Bento Grid - Product Showcase */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6">
              {/* Large featured card */}
              <div className="lg:col-span-2 lg:row-span-2 group">
                <div className="relative h-full min-h-[400px] rounded-3xl overflow-hidden 
                  bg-gradient-to-br from-primary/5 to-purple-500/5 
                  border border-border/50 backdrop-blur-sm
                  hover:border-primary/50 transition-all duration-500
                  hover:shadow-2xl hover:shadow-primary/10">
                  <div className="absolute inset-0 bg-gradient-to-br from-transparent via-primary/5 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <img 
                    src={dashboardMockup} 
                    alt="Dashboard"
                    className="w-full h-full object-cover object-top opacity-90 group-hover:opacity-100 transition-all duration-500 group-hover:scale-105"
                  />
                  <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-background/90 via-background/50 to-transparent">
                    <h3 className="text-2xl font-bold mb-2">Real-Time Dashboard</h3>
                    <p className="text-muted-foreground">Complete visibility into team productivity</p>
                  </div>
                </div>
              </div>

              {/* Smaller cards */}
              <div className="group">
                <div className="relative h-full min-h-[200px] rounded-3xl overflow-hidden 
                  bg-gradient-to-br from-green-500/5 to-emerald-500/5
                  border border-border/50 backdrop-blur-sm
                  hover:border-green-500/50 transition-all duration-500
                  hover:shadow-2xl hover:shadow-green-500/10">
                  <img 
                    src={timesheetMockup} 
                    alt="Timesheet"
                    className="w-full h-full object-cover object-top opacity-90 group-hover:opacity-100 transition-all duration-500 group-hover:scale-105"
                  />
                  <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background/90 to-transparent">
                    <h3 className="text-lg font-bold">Smart Entry</h3>
                  </div>
                </div>
              </div>

              <div className="group">
                <div className="relative h-full min-h-[200px] rounded-3xl overflow-hidden 
                  bg-gradient-to-br from-orange-500/5 to-red-500/5
                  border border-border/50 backdrop-blur-sm
                  hover:border-orange-500/50 transition-all duration-500
                  hover:shadow-2xl hover:shadow-orange-500/10">
                  <img 
                    src={approvalsMockup} 
                    alt="Approvals"
                    className="w-full h-full object-cover object-top opacity-90 group-hover:opacity-100 transition-all duration-500 group-hover:scale-105"
                  />
                  <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background/90 to-transparent">
                    <h3 className="text-lg font-bold">Quick Approvals</h3>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-2 group">
                <div className="relative h-full min-h-[200px] rounded-3xl overflow-hidden 
                  bg-gradient-to-br from-blue-500/5 to-cyan-500/5
                  border border-border/50 backdrop-blur-sm
                  hover:border-blue-500/50 transition-all duration-500
                  hover:shadow-2xl hover:shadow-blue-500/10">
                  <img 
                    src={analyticsMockup} 
                    alt="Analytics"
                    className="w-full h-full object-cover object-top opacity-90 group-hover:opacity-100 transition-all duration-500 group-hover:scale-105"
                  />
                  <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-background/90 to-transparent">
                    <h3 className="text-lg font-bold">Advanced Analytics</h3>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section ref={featuresRef} className="py-32 px-4 sm:px-6 relative">
          <div className="container mx-auto max-w-7xl">
            <div className={`text-center mb-20 space-y-4 ${isFeaturesVisible ? 'animate-fade-in' : 'opacity-0'}`}>
              <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold">
                Built for <span className="text-primary">Modern Teams</span>
              </h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                Everything you need to manage your workforce efficiently
              </p>
            </div>

            <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 ${isFeaturesVisible ? 'animate-fade-in' : 'opacity-0'}`}>
              {features.map((feature, index) => {
                const Icon = feature.icon;
                return (
                  <div
                    key={index}
                    className="group relative"
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    <div className="relative p-8 rounded-2xl bg-card border border-border
                      hover:border-primary/50 transition-all duration-500
                      hover:shadow-2xl hover:shadow-primary/5 hover:-translate-y-2">
                      <div className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${feature.color} mb-6
                        group-hover:scale-110 transition-transform duration-500`}>
                        <Icon className="h-6 w-6 text-white" />
                      </div>
                      <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                      <p className="text-muted-foreground">{feature.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Stats Section */}
        <section ref={statsRef} className="py-20 px-4 sm:px-6">
          <div className="container mx-auto max-w-6xl">
            <div className={`relative rounded-3xl overflow-hidden border border-border/50 backdrop-blur-sm
              ${isStatsVisible ? 'animate-scale-in' : 'opacity-0 scale-95'}`}>
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-purple-500/5" />
              <div className="relative p-12 sm:p-16">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
                  {stats.map((stat, index) => (
                    <div key={index} className="text-center group">
                      <div className="text-4xl sm:text-5xl lg:text-6xl font-black mb-2 
                        bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent
                        group-hover:scale-110 transition-transform duration-300">
                        {stat.value}
                      </div>
                      <div className="text-sm sm:text-base text-muted-foreground font-medium">
                        {stat.label}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-32 px-4 sm:px-6">
          <div className="container mx-auto max-w-5xl">
            <div className="relative rounded-3xl overflow-hidden border border-border">
              <div className="absolute inset-0 bg-gradient-to-br from-primary via-blue-500 to-purple-500 opacity-10" />
              <div className="absolute inset-0 bg-gradient-to-t from-background/50 to-transparent" />
              
              <div className="relative p-12 sm:p-20 text-center space-y-8">
                <h2 className="text-4xl sm:text-5xl lg:text-6xl font-black leading-tight">
                  <span className="block text-foreground">Ready to Transform</span>
                  <span className="block bg-gradient-to-r from-primary via-blue-500 to-purple-500 bg-clip-text text-transparent">
                    Your Workflow?
                  </span>
                </h2>
                
                <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                  Join thousands of teams already using ClockWise to streamline their workforce management
                </p>
                
                <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
                  <Button 
                    size="lg" 
                    onClick={() => navigate("/auth")} 
                    className="text-lg px-10 py-7 bg-primary hover:bg-primary/90 
                      shadow-2xl shadow-primary/30 hover:shadow-primary/40 
                      transition-all hover:scale-105 group"
                  >
                    Start Free Trial
                    <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                  </Button>
                  <div className="text-sm text-muted-foreground">
                    No credit card required • 14-day trial
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-12 px-6 border-t border-border/50">
          <div className="container mx-auto max-w-6xl">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                <span className="text-xl font-bold italic">ClockWise</span>
              </div>
              
              <div className="flex items-center gap-8">
                <button className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Privacy
                </button>
                <button className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Terms
                </button>
                <button className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                  Contact
                </button>
              </div>
              
              <p className="text-sm text-muted-foreground">
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
