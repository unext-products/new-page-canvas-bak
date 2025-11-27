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
      <nav className="fixed top-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-5xl px-6">
        <div className="glass-navbar rounded-full px-6 py-3 flex items-center justify-between border border-border/50 shadow-lg">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">C</span>
            </div>
            <span className="font-semibold text-foreground">ClockWise</span>
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
              className="rounded-full"
            >
              Start Free →
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
        
        {/* Simple Metrics */}
        <section className="py-12 px-6 border-y border-border/50">
          <div className="max-w-6xl mx-auto">
            <div className="grid md:grid-cols-3 gap-8 text-center">
              <div className="space-y-1">
                <p className="text-2xl font-semibold">40+ hours saved</p>
                <p className="text-sm text-muted-foreground">per manager/month</p>
              </div>
              <div className="space-y-1">
                <p className="text-2xl font-semibold">99.9% uptime</p>
                <p className="text-sm text-muted-foreground">reliable & secure</p>
              </div>
              <div className="space-y-1">
                <p className="text-2xl font-semibold">5-minute setup</p>
                <p className="text-sm text-muted-foreground">no training needed</p>
              </div>
            </div>
          </div>
        </section>

        <FinalCTA />
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 py-12 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                  <span className="text-primary-foreground font-bold text-sm">C</span>
                </div>
                <span className="font-semibold">ClockWise</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Simple time tracking for teams.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <div className="space-y-2 text-sm">
                <a href="#showcase" className="block text-muted-foreground hover:text-foreground transition-colors">
                  Features
                </a>
                <a href="/pricing" className="block text-muted-foreground hover:text-foreground transition-colors">
                  Pricing
                </a>
                <button 
                  onClick={() => navigate("/auth")}
                  className="block text-muted-foreground hover:text-foreground transition-colors text-left"
                >
                  Login
                </button>
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Legal</h4>
              <div className="space-y-2 text-sm">
                <a href="#" className="block text-muted-foreground hover:text-foreground transition-colors">
                  Privacy
                </a>
                <a href="#" className="block text-muted-foreground hover:text-foreground transition-colors">
                  Terms
                </a>
              </div>
            </div>
          </div>

          <div className="pt-8 border-t border-border/50 text-center text-sm text-muted-foreground">
            © 2025 ClockWise. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
