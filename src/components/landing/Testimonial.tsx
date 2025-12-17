import { Quote } from "lucide-react";

export function Testimonial() {
  return (
    <section className="py-24 px-6 bg-landing-darker border-y border-landing-border">
      <div className="max-w-3xl mx-auto text-center">
        <Quote className="h-10 w-10 text-primary/30 mx-auto mb-6" />
        
        <blockquote className="text-2xl sm:text-3xl font-medium text-gray-900 leading-relaxed mb-8 font-display">
          "We saved 40+ hours per month on timesheet administration. 
          The approval workflow alone was worth the switch."
        </blockquote>
        
        <div className="flex items-center justify-center gap-4">
          <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
            <span className="text-sm font-semibold text-primary">SC</span>
          </div>
          <div className="text-left">
            <p className="text-gray-900 font-medium">Sarah Chen</p>
            <p className="text-landing-muted text-sm">Department Head, Stanford University</p>
          </div>
        </div>
      </div>
    </section>
  );
}
