import { Building2 } from "lucide-react";

const logos = [
  { name: "Stanford University", icon: Building2 },
  { name: "MIT", icon: Building2 },
  { name: "Harvard", icon: Building2 },
  { name: "Berkeley", icon: Building2 },
  { name: "Oxford", icon: Building2 },
];

export function LogoBar() {
  return (
    <section className="py-16 px-6 bg-landing-dark border-y border-landing-border">
      <div className="max-w-5xl mx-auto">
        <p className="text-center text-sm text-landing-muted uppercase tracking-wider mb-8">
          Trusted by teams at leading institutions
        </p>
        
        <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6">
          {logos.map((logo) => (
            <div 
              key={logo.name}
              className="flex items-center gap-2 text-landing-muted/50 hover:text-landing-muted transition-colors"
            >
              <logo.icon className="h-5 w-5" />
              <span className="text-sm font-medium">{logo.name}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
