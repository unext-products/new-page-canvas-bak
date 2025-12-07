import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Clock } from "lucide-react";

export function NavBar() {
  const navigate = useNavigate();

  return (
    <nav className="fixed top-6 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-4xl">
      <div className="flex items-center justify-between px-4 py-2.5 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 shadow-lg shadow-black/5">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 pl-2">
          <span className="text-lg font-semibold text-white italic tracking-tight">Clock</span>
          <span className="text-lg font-normal text-white/80 -ml-1">Wise</span>
        </Link>
        
        {/* Center links */}
        <div className="hidden md:flex items-center gap-6">
          <a 
            href="#features" 
            className="text-sm text-white/70 hover:text-white transition-colors"
          >
            Features
          </a>
          <a 
            href="#how-it-works" 
            className="text-sm text-white/70 hover:text-white transition-colors"
          >
            How it works
          </a>
          <Link 
            to="/pricing" 
            className="text-sm text-white/70 hover:text-white transition-colors"
          >
            Pricing
          </Link>
          <button 
            onClick={() => navigate("/auth")}
            className="text-sm text-white/70 hover:text-white transition-colors"
          >
            Login
          </button>
        </div>
        
        {/* CTA button */}
        <Button 
          onClick={() => navigate("/auth")}
          className="text-sm bg-landing-dark text-white hover:bg-landing-darker rounded-full px-5 h-9"
        >
          Get started
        </Button>
      </div>
    </nav>
  );
}
