import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Clock, CheckCircle2, BarChart3, Shield } from "lucide-react";
import dashboardMockup from "@/assets/dashboard-mockup.jpg";
import timesheetMockup from "@/assets/timesheet-entry-mockup.jpg";
import approvalsMockup from "@/assets/approvals-mockup.jpg";
import analyticsMockup from "@/assets/analytics-mockup.jpg";

const features = [
  {
    id: "dashboard",
    icon: Clock,
    title: "Smart Time Tracking",
    description: "Intuitive dashboard for team members to log hours with precision. Track activities, monitor progress, and manage time entries effortlessly.",
    image: dashboardMockup,
    stats: [
      { label: "Time Saved", value: "40%" },
      { label: "Accuracy", value: "99.9%" },
    ],
  },
  {
    id: "timesheet",
    icon: CheckCircle2,
    title: "Effortless Entry",
    description: "Streamlined timesheet entry with smart forms, calendar integration, and activity categorization. Submit timesheets in seconds.",
    image: timesheetMockup,
    stats: [
      { label: "Entry Speed", value: "3x Faster" },
      { label: "User Satisfaction", value: "95%" },
    ],
  },
  {
    id: "approvals",
    icon: Shield,
    title: "Approval Workflows",
    description: "Powerful approval system for managers with bulk actions, filters, and real-time notifications. Approve or reject with context.",
    image: approvalsMockup,
    stats: [
      { label: "Approval Speed", value: "5x Faster" },
      { label: "Compliance", value: "100%" },
    ],
  },
  {
    id: "analytics",
    icon: BarChart3,
    title: "Advanced Analytics",
    description: "Comprehensive insights with interactive charts, custom reports, and data exports. Make data-driven decisions with real-time visibility.",
    image: analyticsMockup,
    stats: [
      { label: "Report Types", value: "50+" },
      { label: "Export Formats", value: "5" },
    ],
  },
];

export function InteractiveFeatures() {
  const [activeFeature, setActiveFeature] = useState(features[0].id);
  const currentFeature = features.find((f) => f.id === activeFeature) || features[0];
  const Icon = currentFeature.icon;

  return (
    <section className="py-12 sm:py-16 md:py-20 px-4 sm:px-6">
      <div className="container mx-auto max-w-7xl">
        <div className="text-center mb-8 sm:mb-12 md:mb-16 animate-fade-in-up">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-3 sm:mb-4">
            Powerful Features
          </h2>
          <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
            Everything you need to manage workforce time effectively. Built for enterprise scale.
          </p>
        </div>

        <Tabs value={activeFeature} onValueChange={setActiveFeature} className="w-full">
          {/* Feature Navigation */}
          <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4 gap-2 h-auto bg-muted/50 p-2 mb-8">
            {features.map((feature) => {
              const FeatureIcon = feature.icon;
              return (
                <TabsTrigger
                  key={feature.id}
                  value={feature.id}
                  className="flex flex-col items-center gap-2 p-4 data-[state=active]:bg-background data-[state=active]:shadow-sm"
                >
                  <FeatureIcon className="h-5 w-5" />
                  <span className="text-sm font-medium hidden sm:block">{feature.title}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>

          {/* Feature Content */}
          {features.map((feature) => (
            <TabsContent key={feature.id} value={feature.id} className="mt-0">
              <div className="grid lg:grid-cols-2 gap-8 items-center">
                {/* Left: Feature Info */}
                <div className="space-y-6 order-2 lg:order-1">
                  <div className="inline-flex p-3 rounded-2xl bg-primary/10">
                    <Icon className="h-8 w-8 text-primary" />
                  </div>
                  
                  <div>
                    <h3 className="text-2xl sm:text-3xl font-bold mb-3">{feature.title}</h3>
                    <p className="text-lg text-muted-foreground leading-relaxed">
                      {feature.description}
                    </p>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-4 pt-4">
                    {feature.stats.map((stat, idx) => (
                      <Card key={idx} className="border-border/50">
                        <CardContent className="p-4">
                          <div className="text-2xl font-bold text-primary mb-1">
                            {stat.value}
                          </div>
                          <div className="text-sm text-muted-foreground">{stat.label}</div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>

                {/* Right: Product UI Mockup */}
                <div className="order-1 lg:order-2">
                  <Card className="overflow-hidden border-border/50 shadow-2xl">
                    <div className="relative aspect-video bg-muted">
                      <img
                        src={feature.image}
                        alt={`${feature.title} interface`}
                        className="w-full h-full object-cover animate-fade-in"
                      />
                      {/* Overlay gradient for depth */}
                      <div className="absolute inset-0 bg-gradient-to-t from-background/20 to-transparent pointer-events-none" />
                    </div>
                  </Card>
                </div>
              </div>
            </TabsContent>
          ))}
        </Tabs>

        {/* Feature Highlights */}
        <div className="mt-12 sm:mt-16 grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Active Users", value: "10K+" },
            { label: "Hours Tracked", value: "2M+" },
            { label: "Departments", value: "500+" },
            { label: "Uptime", value: "99.9%" },
          ].map((metric, idx) => (
            <Card key={idx} className="text-center border-border/50">
              <CardContent className="p-6">
                <div className="text-3xl font-bold text-primary mb-2">{metric.value}</div>
                <div className="text-sm text-muted-foreground">{metric.label}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
