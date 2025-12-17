import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import { Logo } from "@/components/Logo";
import unextMabLogo from "@/assets/unext-mab-logo.png";

export function NavBar() {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <nav className="fixed top-6 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-4xl">
      <div className="flex items-center justify-between px-4 py-2.5 rounded-full bg-white/80 backdrop-blur-xl border border-gray-200 shadow-lg shadow-black/5">
        {/* Logo */}
        <Logo to="/" variant="dark" className="pl-2" />
        
        {/* Center - UNext | MAB Logo */}
        <div className="hidden md:flex items-center justify-center absolute left-1/2 -translate-x-1/2">
          <img 
            src={unextMabLogo} 
            alt="UNext | Manipal Academy of BFSI" 
            className="h-8 object-contain"
          />
        </div>
        
        {/* Right links - Desktop */}
        <div className="hidden md:flex items-center gap-6">
          <a 
            href="#features" 
            className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            Features
          </a>
          <button 
            onClick={() => navigate("/auth")}
            className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            Login
          </button>
        </div>

        {/* Mobile menu + CTA */}
        <div className="flex items-center gap-2">
          {/* Mobile hamburger */}
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon" className="text-gray-700 hover:bg-gray-100">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="top" className="bg-white/95 backdrop-blur-xl border-gray-200">
              {/* Mobile UNext Logo */}
              <div className="flex justify-center py-4 border-b border-gray-200 mb-4">
                <img 
                  src={unextMabLogo} 
                  alt="UNext | Manipal Academy of BFSI" 
                  className="h-8 object-contain"
                />
              </div>
              <nav className="flex flex-col gap-4">
                <a 
                  href="#features" 
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-lg text-gray-700 hover:text-gray-900 transition-colors"
                >
                  Features
                </a>
                <button 
                  onClick={() => { navigate("/auth"); setMobileMenuOpen(false); }}
                  className="text-lg text-gray-700 hover:text-gray-900 transition-colors text-left"
                >
                  Login
                </button>
              </nav>
            </SheetContent>
          </Sheet>

          {/* CTA button */}
          <Button 
            onClick={() => navigate("/auth?signup=true")}
            className="text-sm bg-primary text-white hover:bg-primary/90 rounded-full px-5 h-9"
          >
            Get started
          </Button>
        </div>
      </div>
    </nav>
  );
}
