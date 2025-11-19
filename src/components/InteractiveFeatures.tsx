import { useState } from "react";
import { Button } from "@/components/ui/button";
import { BrowserMockup } from "@/components/BrowserMockup";
import { ArrowRight } from "lucide-react";
import dashboardMockup from "@/assets/dashboard-mockup.jpg";
import timesheetMockup from "@/assets/timesheet-entry-mockup.jpg";
import approvalsMockup from "@/assets/approvals-mockup.jpg";
import analyticsMockup from "@/assets/analytics-mockup.jpg";

const features = [
  {
    id: "dashboard",
    title: "Smart Time Tracking",
    description: "Intuitive dashboard for team members to log hours with precision. Track activities, monitor progress, and manage time entries effortlessly with real-time visibility.",
    image: dashboardMockup,
  },
  {
    id: "timesheet",
    title: "Effortless Entry",
    description: "Streamlined timesheet entry with smart forms and calendar integration. Submit timesheets in seconds with intelligent validation and activity categorization.",
    image: timesheetMockup,
  },
  {
    id: "approvals",
    title: "Approval Workflows",
    description: "Powerful approval system for managers with bulk actions, advanced filters, and real-time notifications. Approve or reject with complete context and audit trails.",
    image: approvalsMockup,
  },
  {
    id: "analytics",
    title: "Advanced Analytics",
    description: "Comprehensive insights with interactive charts and custom reports. Make data-driven decisions with real-time visibility into workforce utilization and trends.",
    image: analyticsMockup,
  },
];

export function InteractiveFeatures() {
  const [activeFeature, setActiveFeature] = useState(features[0].id);
  const currentFeature = features.find((f) => f.id === activeFeature) || features[0];

  return (
    <section className="py-24 px-4 sm:px-6 bg-gradient-to-b from-background via-background to-muted/20">
      <div className="container mx-auto max-w-[1400px]">
        {/* Section Header */}
        <header className="text-center mb-20 animate-fade-in-up">
          <h2 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">
            See ClockWise in Action
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Real product. Real results. Built for enterprise scale.
          </p>
        </header>

        {/* Features Grid with Side Navigation */}
        <div className="grid lg:grid-cols-[300px_1fr] gap-12 items-start">
          {/* Vertical Navigation */}
          <nav className="lg:sticky lg:top-24 space-y-2">
            {features.map((feature) => (
              <button
                key={feature.id}
                onClick={() => setActiveFeature(feature.id)}
                className={`
                  w-full text-left px-6 py-4 rounded-lg transition-all duration-300
                  ${
                    activeFeature === feature.id
                      ? "bg-primary/5 border-l-4 border-primary text-foreground"
                      : "border-l-4 border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  }
                `}
              >
                <div className="font-semibold text-base">{feature.title}</div>
              </button>
            ))}
          </nav>

          {/* Content Area */}
          <div className="min-h-[600px]">
            {features.map((feature) => (
              <div
                key={feature.id}
                className={`
                  transition-all duration-500
                  ${activeFeature === feature.id ? "block animate-fade-in" : "hidden"}
                `}
              >
                <div className="grid lg:grid-cols-2 gap-16 items-start">
                  {/* Left: Feature Info */}
                  <div className="space-y-8 lg:sticky lg:top-24">
                    <div>
                      <h3 className="text-3xl md:text-4xl font-bold mb-4 tracking-tight">
                        {feature.title}
                      </h3>
                      <p className="text-lg text-muted-foreground leading-relaxed">
                        {feature.description}
                      </p>
                    </div>

                    <Button size="lg" variant="default" className="gap-2 group">
                      Explore Feature
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </Button>
                  </div>

                  {/* Right: Product Screenshot */}
                  <div className="relative group">
                    <div className="absolute -inset-4 bg-primary/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <BrowserMockup title="app.clockwise.com">
                      <div className="relative aspect-[16/10] overflow-hidden">
                        <img
                          src={feature.image}
                          alt={`${feature.title} interface`}
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                          loading="lazy"
                        />
                        {/* Subtle overlay gradient */}
                        <div className="absolute inset-0 bg-gradient-to-t from-background/10 to-transparent pointer-events-none" />
                      </div>
                    </BrowserMockup>
                    
                    {/* Real-time badge */}
                    <div className="absolute top-2 right-2 bg-background/95 backdrop-blur-sm px-3 py-1.5 rounded-full border border-border/50 shadow-lg">
                      <span className="text-xs font-medium text-foreground flex items-center gap-2">
                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                        Live Preview
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Trust Metrics */}
        <div className="mt-24 pt-16 border-t border-border/50">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              { label: "Active Users", value: "10K+" },
              { label: "Hours Tracked", value: "2M+" },
              { label: "Departments", value: "500+" },
              { label: "Uptime", value: "99.9%" },
            ].map((metric, idx) => (
              <div key={idx} className="text-center">
                <div className="text-4xl md:text-5xl font-bold text-foreground mb-2">
                  {metric.value}
                </div>
                <div className="text-sm text-muted-foreground">{metric.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
