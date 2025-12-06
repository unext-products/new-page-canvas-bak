const steps = [
  {
    number: "01",
    title: "Log",
    description: "Team members enter time in seconds. No training needed.",
  },
  {
    number: "02", 
    title: "Approve",
    description: "Managers review with one click. Instant notifications.",
  },
  {
    number: "03",
    title: "Analyze",
    description: "Generate reports, export data, gain actionable insights.",
  },
];

export function HowItWorksMinimal() {
  return (
    <section className="py-24 px-6 bg-landing-dark">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white mb-4 font-display">
            How it works
          </h2>
          <p className="text-landing-secondary max-w-md mx-auto">
            Three simple steps to transform how your team tracks time.
          </p>
        </div>
        
        <div className="grid md:grid-cols-3 gap-8 md:gap-12">
          {steps.map((step, index) => (
            <div key={step.number} className="relative text-center md:text-left">
              {/* Connector line */}
              {index < steps.length - 1 && (
                <div className="hidden md:block absolute top-8 left-[calc(50%+60px)] w-[calc(100%-60px)] h-px bg-landing-border" />
              )}
              
              <div className="inline-block mb-4">
                <span className="text-5xl font-bold text-landing-muted/20 font-display">
                  {step.number}
                </span>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">{step.title}</h3>
              <p className="text-landing-secondary text-sm leading-relaxed">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
