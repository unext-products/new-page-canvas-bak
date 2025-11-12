import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Clock } from "lucide-react";

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      navigate("/dashboard");
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-muted/30 to-background">
      <div className="text-center space-y-6 px-4">
        <div className="flex justify-center">
          <div className="p-4 bg-primary/10 rounded-full">
            <Clock className="h-16 w-16 text-primary" />
          </div>
        </div>
        <div className="space-y-2">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
            ClockWise
          </h1>
          <p className="text-xl text-muted-foreground max-w-md mx-auto">
            Streamlined faculty timesheet management for coaching institutes
          </p>
        </div>
        <div className="flex gap-4 justify-center pt-4">
          <Button size="lg" onClick={() => navigate("/auth")}>
            Get Started
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Index;
