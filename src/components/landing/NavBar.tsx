import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu } from "lucide-react";

export function NavBar() {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <nav className="fixed top-6 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-4xl">
      <div className="flex items-center justify-between px-4 py-2.5 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 shadow-lg shadow-black/5">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 pl-2">
          <span className="text-lg font-semibold text-white italic tracking-tight">Clock</span>
          <span className="text-lg font-normal text-white/80 -ml-1">Wise</span>
        </Link>
        
        {/* Center links - Desktop */}
        <div className="hidden md:flex items-center gap-6">
          <a 
            href="#features" 
            className="text-sm text-white/70 hover:text-white transition-colors"
          >
            Features
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

        {/* Mobile menu + CTA */}
        <div className="flex items-center gap-2">
          {/* Mobile hamburger */}
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon" className="text-white hover:bg-white/10">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="top" className="bg-landing-dark/95 backdrop-blur-xl border-white/10">
              <nav className="flex flex-col gap-4 pt-8">
                <a 
                  href="#features" 
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-lg text-white/80 hover:text-white transition-colors"
                >
                  Features
                </a>
                <Link 
                  to="/pricing" 
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-lg text-white/80 hover:text-white transition-colors"
                >
                  Pricing
                </Link>
                <button 
                  onClick={() => { navigate("/auth"); setMobileMenuOpen(false); }}
                  className="text-lg text-white/80 hover:text-white transition-colors text-left"
                >
                  Login
                </button>
              </nav>
            </SheetContent>
          </Sheet>

          {/* CTA button */}
          <Button 
            onClick={() => navigate("/auth?signup=true")}
            className="text-sm bg-landing-dark text-white hover:bg-landing-darker rounded-full px-5 h-9"
          >
            Get started
          </Button>
        </div>
      </div>
    </nav>
  );
}
