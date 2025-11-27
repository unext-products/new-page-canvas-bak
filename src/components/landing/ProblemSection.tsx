export function ProblemSection() {
  const problems = [
    {
      icon: "📧",
      title: "Email chaos",
      description: "Approvals buried in threads, lost to spam folders."
    },
    {
      icon: "⏱️",
      title: "Lost hours",
      description: "Employees forget to log, data is incomplete."
    },
    {
      icon: "❓",
      title: "No visibility",
      description: "Managers can't see who's on track until it's too late."
    }
  ];

  return (
    <section className="py-24 px-6 bg-muted/30">
      <div className="max-w-6xl mx-auto">
        <div className="grid md:grid-cols-3 gap-8">
          {problems.map((problem, index) => (
            <div key={index} className="text-center space-y-4">
              <div className="text-4xl mb-4">{problem.icon}</div>
              <h3 className="text-xl font-semibold">{problem.title}</h3>
              <p className="text-muted-foreground leading-relaxed">
                {problem.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
