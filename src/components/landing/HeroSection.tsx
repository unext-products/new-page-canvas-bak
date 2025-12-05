import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import dashboardMockup from "@/assets/dashboard-mockup.jpg";
import { Clock, CheckCircle2, Zap } from "lucide-react";

export function HeroSection() {
  const navigate = useNavigate();

  return (
    <section className="relative pt-32 pb-24 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-[45%_55%] gap-16 items-center">
          {/* Left - Copy */}
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium">
              <Zap className="w-4 h-4" />
              <span>Now with AI-powered insights</span>
            </div>
            
            <h1 className="text-5xl lg:text-6xl font-bold leading-[1.1] tracking-tight font-display">
              Your team's time,
              <br />
              <span className="text-gradient">finally organized.</span>
            </h1>

            <p className="text-lg text-muted-foreground leading-relaxed max-w-md">
              Replace spreadsheets, emails, and guesswork with one simple system for logging hours, getting approvals,
              and understanding where time goes.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <Button 
                size="lg" 
                onClick={() => navigate("/auth")} 
                className="text-base px-8 shadow-primary-glow"
              >
                Start Free Trial
                <span className="ml-1">→</span>
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => document.getElementById("showcase")?.scrollIntoView({ behavior: "smooth" })}
                className="text-base"
              >
                See it in action
                <span className="ml-1">↓</span>
              </Button>
            </div>

            <div className="flex flex-wrap gap-6 pt-2">
              <span className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="w-4 h-4 text-success" />
                Setup in 5 minutes
              </span>
              <span className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="w-4 h-4 text-success" />
                No credit card required
              </span>
              <span className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="w-4 h-4 text-success" />
                Free for small teams
              </span>
            </div>
          </div>

          {/* Right - Product Screenshot */}
          <div className="relative lg:translate-x-4">
            {/* Glow effect behind mockup */}
            <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-primary/5 blur-3xl rounded-full scale-90 opacity-60" />
            
            <div className="relative rounded-2xl overflow-hidden shadow-premium-2xl border border-border/50 bg-card transform lg:rotate-1 hover:rotate-0 transition-all duration-500 hover:shadow-primary-glow/20">
              {/* Browser Chrome */}
              <div className="bg-muted/50 border-b border-border/50 px-4 py-3 flex items-center gap-3">
                <div className="flex gap-2">
                  <div className="w-3 h-3 rounded-full bg-destructive/70" />
                  <div className="w-3 h-3 rounded-full bg-warning/70" />
                  <div className="w-3 h-3 rounded-full bg-success/70" />
                </div>
                <div className="flex-1 flex justify-center">
                  <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-background rounded-lg text-xs text-muted-foreground border border-border/50">
                    <svg className="w-3 h-3 text-success" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                    </svg>
                    <span className="font-medium">app.clockwise.com</span>
                  </div>
                </div>
                <div className="w-14" />
              </div>

              {/* Screenshot */}
              <img
                src={dashboardMockup}
                alt="ClockWise Dashboard - Time tracking interface showing today's logged hours and team completion rates"
                className="w-full h-auto"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}