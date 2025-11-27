import timesheetMockup from "@/assets/timesheet-entry-mockup.jpg";
import approvalsMockup from "@/assets/approvals-mockup.jpg";
import analyticsMockup from "@/assets/analytics-mockup.jpg";

export function HowItWorks() {
  const steps = [
    {
      number: "1",
      title: "Log",
      description: "Employee enters time in 30 sec.",
      image: timesheetMockup
    },
    {
      number: "2",
      title: "Approve",
      description: "Manager reviews with one click.",
      image: approvalsMockup
    },
    {
      number: "3",
      title: "Analyze",
      description: "Export reports, spot patterns.",
      image: analyticsMockup
    }
  ];

  return (
    <section className="py-24 px-6 bg-muted/30">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl font-bold text-center mb-16">How It Works</h2>
        
        <div className="grid md:grid-cols-3 gap-12 relative">
          {/* Connecting line - desktop only */}
          <div className="hidden md:block absolute top-20 left-0 right-0 h-0.5 bg-border -z-10" />
          
          {steps.map((step, index) => (
            <div key={index} className="text-center space-y-4">
              <div className="relative inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary text-primary-foreground font-bold text-lg mb-4">
                {step.number}
              </div>
              
              <h3 className="text-xl font-semibold">{step.title}</h3>
              <p className="text-muted-foreground">{step.description}</p>
              
              <div className="mt-6 rounded-lg overflow-hidden border border-border shadow-lg">
                <img 
                  src={step.image} 
                  alt={`Step ${step.number}: ${step.title}`}
                  className="w-full h-auto"
                  style={{ maxHeight: '200px', objectFit: 'cover', objectPosition: 'top' }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
