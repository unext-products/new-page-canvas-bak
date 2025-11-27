import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import dashboardMockup from "@/assets/dashboard-mockup.jpg";
import timesheetMockup from "@/assets/timesheet-entry-mockup.jpg";
import approvalsMockup from "@/assets/approvals-mockup.jpg";
import analyticsMockup from "@/assets/analytics-mockup.jpg";

export function ProductShowcase() {
  const [activeTab, setActiveTab] = useState("dashboard");

  const features = {
    dashboard: {
      title: "Dashboard",
      image: dashboardMockup,
      points: [
        "See today's logged hours at a glance",
        "Track weekly completion rates per team member",
        "Catch missing entries before end of week",
        "Quick actions: approve, remind, export"
      ]
    },
    timesheet: {
      title: "Time Entry",
      image: timesheetMockup,
      points: [
        "Log time in 30 seconds or less",
        "Categorize by department and activity type",
        "Add notes and context when needed",
        "Submit for approval with one click"
      ]
    },
    approvals: {
      title: "Approvals",
      image: approvalsMockup,
      points: [
        "Review all pending entries in one view",
        "Approve or request changes instantly",
        "See team member history and patterns",
        "Add feedback notes for your team"
      ]
    },
    analytics: {
      title: "Reports",
      image: analyticsMockup,
      points: [
        "Export weekly or monthly summaries",
        "Break down time by department and activity",
        "Identify trends and bottlenecks",
        "Share insights with stakeholders"
      ]
    }
  };

  return (
    <section id="showcase" className="py-24 px-6">
      <div className="max-w-6xl mx-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-4">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="timesheet">Time Entry</TabsTrigger>
            <TabsTrigger value="approvals">Approvals</TabsTrigger>
            <TabsTrigger value="analytics">Reports</TabsTrigger>
          </TabsList>

          {Object.entries(features).map(([key, feature]) => (
            <TabsContent key={key} value={key} className="space-y-6">
              <div className="rounded-2xl overflow-hidden shadow-2xl border border-border/50">
                <img 
                  src={feature.image} 
                  alt={`${feature.title} - ClockWise time tracking feature`}
                  className="w-full h-auto"
                />
              </div>
              
              <div className="grid sm:grid-cols-2 gap-4 mt-8">
                {feature.points.map((point, index) => (
                  <div key={index} className="flex gap-3">
                    <div className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center mt-0.5">
                      <svg className="w-3 h-3 text-primary" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <p className="text-muted-foreground">{point}</p>
                  </div>
                ))}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </section>
  );
}
