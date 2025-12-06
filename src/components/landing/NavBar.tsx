import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Clock } from "lucide-react";

export function NavBar() {
  const navigate = useNavigate();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-4">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Clock className="h-4 w-4 text-white" />
          </div>
          <span className="text-lg font-semibold text-white">ClockWise</span>
        </Link>
        
        {/* Center links */}
        <div className="hidden md:flex items-center gap-8">
          <a 
            href="#features" 
            className="text-sm text-landing-secondary hover:text-white transition-colors"
          >
            Features
          </a>
          <Link 
            to="/pricing" 
            className="text-sm text-landing-secondary hover:text-white transition-colors"
          >
            Pricing
          </Link>
        </div>
        
        {/* CTA buttons */}
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            onClick={() => navigate("/auth")}
            className="text-sm text-landing-secondary hover:text-white hover:bg-white/5"
          >
            Sign in
          </Button>
          <Button 
            onClick={() => navigate("/auth")}
            className="text-sm bg-white text-landing-dark hover:bg-white/90"
          >
            Get started
          </Button>
        </div>
      </div>
    </nav>
  );
}
