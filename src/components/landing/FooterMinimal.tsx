import { Link } from "react-router-dom";
import { Clock } from "lucide-react";

const footerLinks = {
  Product: [
    { label: "Features", href: "#features" },
    { label: "Pricing", href: "/pricing" },
    { label: "Changelog", href: "#" },
  ],
  Resources: [
    { label: "Documentation", href: "#" },
    { label: "Help Center", href: "#" },
    { label: "Contact", href: "#" },
  ],
  Legal: [
    { label: "Privacy", href: "#" },
    { label: "Terms", href: "#" },
  ],
};

export function FooterMinimal() {
  return (
    <footer className="py-16 px-6 bg-landing-darker border-t border-landing-border">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link to="/" className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <Clock className="h-4 w-4 text-white" />
              </div>
              <span className="text-lg font-semibold text-white">ClockWise</span>
            </Link>
            <p className="text-sm text-landing-muted max-w-xs">
              Modern time tracking for teams that value simplicity.
            </p>
          </div>
          
          {/* Links */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h4 className="text-sm font-semibold text-white mb-4">{category}</h4>
              <ul className="space-y-3">
                {links.map((link) => (
                  <li key={link.label}>
                    {link.href.startsWith("/") ? (
                      <Link 
                        to={link.href} 
                        className="text-sm text-landing-muted hover:text-white transition-colors"
                      >
                        {link.label}
                      </Link>
                    ) : (
                      <a 
                        href={link.href} 
                        className="text-sm text-landing-muted hover:text-white transition-colors"
                      >
                        {link.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        
        {/* Bottom bar */}
        <div className="pt-8 border-t border-landing-border">
          <p className="text-sm text-landing-muted text-center">
            © {new Date().getFullYear()} ClockWise. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
