import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, Users, CheckCircle, BarChart3, Upload, Shield, ArrowRight } from "lucide-react";

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

  const features = [
    {
      icon: Clock,
      title: "Timesheet Tracking",
      description: "Easy-to-use interface for faculty to log their hours with detailed activity tracking"
    },
    {
      icon: CheckCircle,
      title: "Approval Workflows",
      description: "Streamlined approval process for HODs to review and approve faculty timesheets"
    },
    {
      icon: Users,
      title: "Department Management",
      description: "Organize faculty by departments with role-based access control"
    },
    {
      icon: BarChart3,
      title: "Comprehensive Reports",
      description: "Generate detailed reports with analytics on faculty hours and activities"
    },
    {
      icon: Upload,
      title: "Bulk Import",
      description: "Import multiple timesheets at once using CSV or Excel files"
    },
    {
      icon: Shield,
      title: "Secure & Reliable",
      description: "Enterprise-grade security with role-based permissions and data protection"
    }
  ];

  const steps = [
    {
      number: "01",
      title: "Faculty Log Hours",
      description: "Instructors easily record their teaching and administrative hours"
    },
    {
      number: "02",
      title: "HODs Review",
      description: "Department heads review and approve submitted timesheets"
    },
    {
      number: "03",
      title: "Admins Manage",
      description: "Administrators generate reports and manage the entire system"
    }
  ];

  const benefits = [
    "Save hours on manual timesheet tracking and data entry",
    "Reduce errors and disputes with accurate digital records",
    "Real-time visibility into faculty hours and workload",
    "Streamlined approval process with automated notifications",
    "Data-driven insights for better resource planning"
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">ClockWise</span>
          </div>
          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => navigate("/auth")}>
              Login
            </Button>
            <Button onClick={() => navigate("/auth")}>
              Sign Up
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 md:py-32">
        <div className="text-center space-y-6 max-w-4xl mx-auto">
          <div className="flex justify-center">
            <div className="p-4 bg-primary/10 rounded-full animate-fade-in">
              <Clock className="h-16 w-16 text-primary" />
            </div>
          </div>
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight animate-fade-in">
            Streamlined Faculty Timesheet Management
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto animate-fade-in">
            Transform how your coaching institute tracks faculty hours. ClockWise makes timesheet management effortless with intelligent workflows and real-time insights.
          </p>
          <div className="flex gap-4 justify-center pt-4 animate-fade-in">
            <Button size="lg" onClick={() => navigate("/auth")} className="gap-2">
              Get Started Free <ArrowRight className="h-4 w-4" />
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate("/auth")}>
              Login to Your Account
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-20 bg-muted/30">
        <div className="text-center space-y-4 mb-12">
          <h2 className="text-3xl md:text-4xl font-bold">Everything You Need</h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Powerful features designed specifically for coaching institutes
          </p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {features.map((feature, index) => (
            <Card key={index} className="hover-scale">
              <CardHeader>
                <div className="p-2 bg-primary/10 rounded-lg w-fit mb-2">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>{feature.title}</CardTitle>
                <CardDescription>{feature.description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      {/* How It Works Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="text-center space-y-4 mb-12">
          <h2 className="text-3xl md:text-4xl font-bold">How It Works</h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Simple, efficient workflow in three steps
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {steps.map((step, index) => (
            <div key={index} className="text-center space-y-4">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary text-primary-foreground text-2xl font-bold">
                {step.number}
              </div>
              <h3 className="text-xl font-semibold">{step.title}</h3>
              <p className="text-muted-foreground">{step.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Benefits Section */}
      <section className="container mx-auto px-4 py-20 bg-muted/30">
        <div className="max-w-4xl mx-auto">
          <div className="text-center space-y-4 mb-12">
            <h2 className="text-3xl md:text-4xl font-bold">Why Choose ClockWise?</h2>
            <p className="text-muted-foreground text-lg">
              Unlock the full potential of your institute's time management
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {benefits.map((benefit, index) => (
              <div key={index} className="flex gap-3 items-start">
                <CheckCircle className="h-6 w-6 text-success flex-shrink-0 mt-0.5" />
                <p className="text-foreground">{benefit}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-background rounded-2xl p-12 text-center space-y-6 max-w-4xl mx-auto border border-primary/20">
          <h2 className="text-3xl md:text-4xl font-bold">Ready to Get Started?</h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Join coaching institutes that are already saving time and reducing errors with ClockWise
          </p>
          <div className="flex gap-4 justify-center pt-4">
            <Button size="lg" onClick={() => navigate("/auth")} className="gap-2">
              Start Using ClockWise <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p>&copy; 2025 ClockWise. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
