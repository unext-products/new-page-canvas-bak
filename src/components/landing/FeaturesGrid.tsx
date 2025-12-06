import { Clock, CheckCircle, BarChart3, Users, Zap, Shield } from "lucide-react";
import timesheetMockup from "@/assets/timesheet-entry-mockup.jpg";
import analyticsMockup from "@/assets/analytics-mockup.jpg";

const features = [
  {
    icon: Clock,
    title: "Fast Time Entry",
    description: "Log hours in under 30 seconds with keyboard shortcuts and smart defaults.",
  },
  {
    icon: CheckCircle,
    title: "One-Click Approvals",
    description: "Managers review and approve from a single dashboard. No more email chains.",
  },
  {
    icon: Users,
    title: "Team Hierarchy",
    description: "Organize by departments and programs. Each team gets their own workflow.",
  },
  {
    icon: Shield,
    title: "Role-Based Access",
    description: "Admins, managers, and members see exactly what they need. Nothing more.",
  },
];

export function FeaturesGrid() {
  return (
    <section id="features" className="py-24 px-6 bg-landing-darker">
      <div className="max-w-6xl mx-auto">
        {/* Section header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white mb-4 font-display">
            Everything your team needs.
            <br />
            <span className="text-landing-secondary">Nothing it doesn't.</span>
          </h2>
        </div>
        
        {/* Bento grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Feature cards - top row */}
          {features.slice(0, 2).map((feature) => (
            <div 
              key={feature.title}
              className="group p-6 rounded-2xl bg-landing-card border border-landing-border hover:border-landing-border-hover transition-all duration-300"
            >
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <feature.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
              <p className="text-landing-secondary text-sm leading-relaxed">{feature.description}</p>
            </div>
          ))}
          
          {/* Large feature card with screenshot */}
          <div className="md:col-span-2 lg:col-span-1 lg:row-span-2 p-6 rounded-2xl bg-landing-card border border-landing-border hover:border-landing-border-hover transition-all duration-300 flex flex-col">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
              <BarChart3 className="h-5 w-5 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Reports That Make Sense</h3>
            <p className="text-landing-secondary text-sm leading-relaxed mb-6">
              Export weekly summaries, spot trends, share insights with stakeholders. All in a few clicks.
            </p>
            <div className="flex-1 rounded-lg overflow-hidden border border-landing-border mt-auto">
              <img 
                src={analyticsMockup} 
                alt="Analytics dashboard showing time tracking reports" 
                className="w-full h-full object-cover"
              />
            </div>
          </div>
          
          {/* Feature cards - bottom row */}
          {features.slice(2, 4).map((feature) => (
            <div 
              key={feature.title}
              className="group p-6 rounded-2xl bg-landing-card border border-landing-border hover:border-landing-border-hover transition-all duration-300"
            >
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <feature.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
              <p className="text-landing-secondary text-sm leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
        
        {/* Large timesheet feature */}
        <div className="mt-4 p-6 rounded-2xl bg-landing-card border border-landing-border hover:border-landing-border-hover transition-all duration-300">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Zap className="h-5 w-5 text-primary" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">Timesheet Entry Made Simple</h3>
              <p className="text-landing-secondary leading-relaxed mb-4">
                No more complex forms or confusing interfaces. Your team logs their hours with a clean, 
                intuitive interface that gets out of the way.
              </p>
              <ul className="space-y-2">
                {["Autosave as you type", "Copy from last week", "Keyboard shortcuts"].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm text-landing-secondary">
                    <CheckCircle className="h-4 w-4 text-success" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-lg overflow-hidden border border-landing-border">
              <img 
                src={timesheetMockup} 
                alt="Timesheet entry interface" 
                className="w-full h-auto"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
