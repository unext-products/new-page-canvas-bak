import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Play } from "lucide-react";
import dashboardMockup from "@/assets/dashboard-mockup.png";

export function HeroSection() {
  const navigate = useNavigate();

  return (
    <section className="relative min-h-screen flex flex-col justify-center pt-24 pb-16 px-6 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-landing-dark" />
      
      {/* Subtle gradient orb */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/3 w-[800px] h-[600px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
      
      <div className="relative max-w-6xl mx-auto w-full">
        {/* Copy section */}
        <div className="max-w-3xl mx-auto text-center mb-16">
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-[-0.03em] text-gray-900 leading-[1.1] mb-6 font-display">
            Time tracking
            <br />
            that works.
          </h1>
          
          <p className="text-lg sm:text-xl text-landing-secondary max-w-xl mx-auto mb-10 leading-relaxed">
            Stop chasing timesheets. Your team logs hours in seconds. 
            You get full visibility, instant approvals, and reports that actually help.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              size="lg" 
              onClick={() => navigate("/auth?signup=true")}
              className="h-12 px-8 text-base font-medium bg-primary text-white hover:bg-primary/90 transition-all"
            >
              Start for free
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button 
              size="lg" 
              variant="ghost"
              onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}
              className="h-12 px-8 text-base font-medium border border-gray-300 text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-all"
            >
              <Play className="mr-2 h-4 w-4" />
              Watch demo
            </Button>
          </div>
        </div>
        
        {/* Product screenshot */}
        <div className="relative max-w-5xl mx-auto">
          {/* Glow behind image */}
          <div className="absolute inset-0 bg-gradient-to-t from-primary/10 via-primary/5 to-transparent blur-3xl scale-95 opacity-60" />
          
          <div className="relative rounded-xl overflow-hidden border border-gray-200 shadow-2xl">
            <img
              src={dashboardMockup}
              alt="Clockwise for MAB Dashboard - Modern time tracking interface"
              className="w-full h-auto"
              width={1920}
              height={1126}
            />
            {/* Overlay gradient at bottom */}
            <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-white to-transparent" />
          </div>
        </div>
      </div>
    </section>
  );
}
