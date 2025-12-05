import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { HeroSection } from "@/components/landing/HeroSection";
import { ProblemSection } from "@/components/landing/ProblemSection";
import { ProductShowcase } from "@/components/landing/ProductShowcase";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { FinalCTA } from "@/components/landing/FinalCTA";
import { Clock, Users, TrendingUp, ArrowRight, Github, Twitter, Linkedin } from "lucide-react";

export default function Index() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (session && !loading) {
      navigate("/dashboard");
    }
  }, [session, loading, navigate]);

  if (loading) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-4xl px-6">
        <div className="glass-navbar rounded-2xl px-6 py-3 flex items-center justify-between border border-border/50 shadow-premium-lg">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shadow-sm">
              <span className="text-primary-foreground font-bold text-base">C</span>
            </div>
            <span className="font-semibold text-foreground font-display text-lg">ClockWise</span>
          </div>

          <div className="hidden md:flex items-center gap-8">
            <a href="#showcase" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Features
            </a>
            <a href="/pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Pricing
            </a>
            <button 
              onClick={() => navigate("/auth")}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Login
            </button>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Button 
              onClick={() => navigate("/auth")}
              size="sm"
              className="rounded-xl"
            >
              Get Started
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main>
        <HeroSection />
        <ProblemSection />
        <ProductShowcase />
        <HowItWorks />
        
        {/* Premium Metrics Section */}
        <section className="py-20 px-6">
          <div className="max-w-6xl mx-auto">
            <div className="rounded-2xl border border-border/50 bg-gradient-subtle p-12">
              <div className="grid md:grid-cols-3 gap-12">
                <div className="text-center space-y-3">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 text-primary mb-2">
                    <Clock className="w-6 h-6" />
                  </div>
                  <p className="text-4xl font-bold font-display">40+ hours</p>
                  <p className="text-muted-foreground">saved per manager/month</p>
                </div>
                <div className="text-center space-y-3">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-success/10 text-success mb-2">
                    <TrendingUp className="w-6 h-6" />
                  </div>
                  <p className="text-4xl font-bold font-display">99.9%</p>
                  <p className="text-muted-foreground">uptime guarantee</p>
                </div>
                <div className="text-center space-y-3">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-warning/10 text-warning mb-2">
                    <Users className="w-6 h-6" />
                  </div>
                  <p className="text-4xl font-bold font-display">5 min</p>
                  <p className="text-muted-foreground">to get started</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <FinalCTA />
      </main>

      {/* Premium Footer */}
      <footer className="border-t border-border/50 py-16 px-6 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-4 gap-12 mb-12">
            {/* Brand Column */}
            <div className="md:col-span-1">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
                  <span className="text-primary-foreground font-bold">C</span>
                </div>
                <span className="font-semibold font-display text-lg">ClockWise</span>
              </div>
              <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
                Modern time tracking for teams that care about where their hours go.
              </p>
              <div className="flex gap-3">
                <a href="#" className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors">
                  <Twitter className="w-4 h-4" />
                </a>
                <a href="#" className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors">
                  <Github className="w-4 h-4" />
                </a>
                <a href="#" className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors">
                  <Linkedin className="w-4 h-4" />
                </a>
              </div>
            </div>

            {/* Product Column */}
            <div>
              <h4 className="font-semibold font-display mb-4">Product</h4>
              <div className="space-y-3 text-sm">
                <a href="#showcase" className="block text-muted-foreground hover:text-foreground transition-colors">
                  Features
                </a>
                <a href="/pricing" className="block text-muted-foreground hover:text-foreground transition-colors">
                  Pricing
                </a>
                <a href="#" className="block text-muted-foreground hover:text-foreground transition-colors">
                  Integrations
                </a>
                <a href="#" className="block text-muted-foreground hover:text-foreground transition-colors">
                  Changelog
                </a>
              </div>
            </div>

            {/* Company Column */}
            <div>
              <h4 className="font-semibold font-display mb-4">Company</h4>
              <div className="space-y-3 text-sm">
                <a href="#" className="block text-muted-foreground hover:text-foreground transition-colors">
                  About
                </a>
                <a href="#" className="block text-muted-foreground hover:text-foreground transition-colors">
                  Blog
                </a>
                <a href="#" className="block text-muted-foreground hover:text-foreground transition-colors">
                  Careers
                </a>
                <a href="#" className="block text-muted-foreground hover:text-foreground transition-colors">
                  Contact
                </a>
              </div>
            </div>

            {/* Legal Column */}
            <div>
              <h4 className="font-semibold font-display mb-4">Legal</h4>
              <div className="space-y-3 text-sm">
                <a href="#" className="block text-muted-foreground hover:text-foreground transition-colors">
                  Privacy Policy
                </a>
                <a href="#" className="block text-muted-foreground hover:text-foreground transition-colors">
                  Terms of Service
                </a>
                <a href="#" className="block text-muted-foreground hover:text-foreground transition-colors">
                  Cookie Policy
                </a>
                <a href="#" className="block text-muted-foreground hover:text-foreground transition-colors">
                  Security
                </a>
              </div>
            </div>
          </div>

          <div className="pt-8 border-t border-border/50 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-muted-foreground">
              © 2025 ClockWise. All rights reserved.
            </p>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <span>Made with care for productive teams</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}