import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

export function FinalCTA() {
  const [email, setEmail] = useState("");
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      toast.success("Great! Redirecting to signup...");
      setTimeout(() => navigate("/auth"), 500);
    }
  };

  return (
    <section className="py-32 px-6">
      <div className="max-w-2xl mx-auto text-center space-y-8">
        <h2 className="text-4xl font-bold">Ready to simplify time tracking?</h2>
        
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
          <Input
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="flex-1 h-12"
          />
          <Button type="submit" size="lg" className="sm:w-auto">
            Start Free Trial
          </Button>
        </form>
        
        <p className="text-sm text-muted-foreground">
          No credit card required. 14-day trial.
        </p>
      </div>
    </section>
  );
}
