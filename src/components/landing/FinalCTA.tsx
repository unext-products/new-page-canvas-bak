import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";

export function FinalCTA() {
  const navigate = useNavigate();

  return (
    <section className="py-32 px-6 bg-landing-dark">
      <div className="max-w-2xl mx-auto text-center">
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-gray-900 mb-6 font-display">
          Ready to take control
          <br />
          of your team's time?
        </h2>
        
        <p className="text-landing-secondary mb-10">
          Start your free trial today. No credit card required.
        </p>
        
        <Button 
          size="lg" 
          onClick={() => navigate("/auth")}
          className="h-14 px-10 text-base font-medium bg-primary text-white hover:bg-primary/90 transition-all"
        >
          Start for free
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </section>
  );
}
