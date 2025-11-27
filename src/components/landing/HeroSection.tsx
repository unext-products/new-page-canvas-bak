import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import dashboardMockup from "@/assets/dashboard-mockup.jpg";

export function HeroSection() {
  const navigate = useNavigate();

  return (
    <section className="relative pt-32 pb-20 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-[45%_55%] gap-12 items-center">
          {/* Left - Copy */}
          <div className="space-y-8">
            <h1 className="text-5xl lg:text-6xl font-bold leading-tight tracking-tight">
              Your team's time,
              <br />
              finally organized.
            </h1>
            
            <p className="text-lg text-muted-foreground leading-relaxed max-w-md">
              Replace spreadsheets, emails, and guesswork with one simple system for logging hours, getting approvals, and understanding where time goes.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <Button 
                size="lg" 
                onClick={() => navigate("/auth")}
                className="text-base px-8"
              >
                Start Free Trial →
              </Button>
              <Button 
                size="lg" 
                variant="outline"
                onClick={() => document.getElementById('showcase')?.scrollIntoView({ behavior: 'smooth' })}
                className="text-base"
              >
                See it in action ↓
              </Button>
            </div>

            <div className="flex flex-wrap gap-6 text-sm text-muted-foreground">
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4 text-primary" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Setup in 5 minutes
              </span>
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4 text-primary" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                No credit card
              </span>
            </div>
          </div>

          {/* Right - Product Screenshot */}
          <div className="relative lg:translate-x-8">
            <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-border/50 bg-background transform lg:rotate-2 hover:rotate-0 transition-transform duration-500">
              {/* Browser Chrome */}
              <div className="bg-muted/30 border-b border-border/50 px-4 py-3 flex items-center gap-2">
                <div className="flex gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500/20" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/20" />
                  <div className="w-3 h-3 rounded-full bg-green-500/20" />
                </div>
                <div className="flex-1 text-center">
                  <div className="inline-flex items-center gap-2 px-4 py-1 bg-background/50 rounded-md text-xs text-muted-foreground">
                    <span className="w-3 h-3 text-muted-foreground/40">🔒</span>
                    <span>app.clockwise.com</span>
                  </div>
                </div>
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
