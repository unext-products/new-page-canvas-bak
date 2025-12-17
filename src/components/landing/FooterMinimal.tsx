import { Link } from "react-router-dom";
import { Logo } from "@/components/Logo";

const footerLinks = {
  Product: [
    { label: "Features", href: "#features" },
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
            <Logo to="/" variant="dark" className="mb-4" />
            <p className="text-sm text-landing-muted max-w-xs">
              Modern time tracking for teams that value simplicity.
            </p>
          </div>
          
          {/* Links */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h4 className="text-sm font-semibold text-gray-900 mb-4">{category}</h4>
              <ul className="space-y-3">
                {links.map((link) => (
                  <li key={link.label}>
                    {link.href.startsWith("/") ? (
                      <Link 
                        to={link.href} 
                        className="text-sm text-landing-muted hover:text-gray-900 transition-colors"
                      >
                        {link.label}
                      </Link>
                    ) : (
                      <a 
                        href={link.href} 
                        className="text-sm text-landing-muted hover:text-gray-900 transition-colors"
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
            © {new Date().getFullYear()} Clockwise for MAB. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
