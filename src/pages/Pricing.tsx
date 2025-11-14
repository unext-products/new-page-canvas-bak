import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Slider } from "@/components/ui/slider";
import { ThemeToggle } from "@/components/ThemeToggle";
import { 
  Check, 
  Clock, 
  BarChart3, 
  Users, 
  Shield, 
  Zap, 
  FileText,
  Mail,
  Settings,
  Sparkles,
  ArrowRight
} from "lucide-react";

const Pricing = () => {
  const navigate = useNavigate();
  const [userCount, setUserCount] = useState([25]);

  const calculatePrice = (users: number) => {
    if (users <= 5) return { total: 0, perUser: 0, tier: "Free" };
    if (users <= 50) return { total: users * 20, perUser: 20, tier: "Pro" };
    return { total: users * 15, perUser: 15, tier: "Pro Max" };
  };

  const priceInfo = calculatePrice(userCount[0]);

  const allFeatures = [
    { icon: Clock, text: "Unlimited timesheet entries" },
    { icon: BarChart3, text: "Advanced reporting & analytics" },
    { icon: Users, text: "Department management" },
    { icon: FileText, text: "Approval workflows" },
    { icon: Zap, text: "Bulk import/export (CSV/Excel)" },
    { icon: Shield, text: "Real-time sync" },
    { icon: Settings, text: "Audit trails & compliance" },
    { icon: Mail, text: "Email notifications" },
  ];

  const tiers = [
    {
      name: "Free",
      description: "Perfect for small teams",
      price: "$0",
      period: "forever",
      users: "Up to 5 users",
      cta: "Start Free",
      popular: false,
      features: [
        "All core features included",
        "Unlimited timesheet entries",
        "Basic reporting",
        "Email support",
        "Mobile-friendly",
      ],
    },
    {
      name: "Pro",
      description: "For growing teams",
      price: "$20",
      period: "per user/year",
      users: "6-50 users",
      cta: "Get Started",
      popular: true,
      features: [
        "Everything in Free",
        "Advanced analytics",
        "Priority support",
        "Custom reporting",
        "Bulk operations",
        "Role-based access control",
      ],
    },
    {
      name: "Pro Max",
      description: "For large organizations",
      price: "$15",
      period: "per user/year",
      users: "51+ users",
      cta: "Get Started",
      popular: false,
      features: [
        "Everything in Pro",
        "Volume discount pricing",
        "Dedicated support",
        "Custom training",
        "Advanced security features",
        "Custom integrations",
        "SLA guarantee",
      ],
    },
  ];

  const faqs = [
    {
      question: "Can I switch between plans?",
      answer: "Yes! You can upgrade or downgrade your plan at any time. Changes take effect at the start of your next billing cycle.",
    },
    {
      question: "What happens when I exceed my user limit?",
      answer: "We'll automatically upgrade you to the next tier based on your user count. You'll be notified before any changes to your billing.",
    },
    {
      question: "Do you offer refunds?",
      answer: "Yes, we offer a 30-day money-back guarantee for all paid plans. If you're not satisfied, contact us for a full refund.",
    },
    {
      question: "Is there a setup fee?",
      answer: "No, there are no setup fees or hidden costs. You only pay the subscription fee for your chosen plan.",
    },
    {
      question: "Can I pay monthly instead of annually?",
      answer: "Currently, we offer annual billing to provide the best value. Monthly billing options may be available in the future.",
    },
    {
      question: "What payment methods do you accept?",
      answer: "We accept all major credit cards (Visa, MasterCard, American Express) and PayPal for annual subscriptions.",
    },
    {
      question: "Do you offer discounts for non-profits or educational institutions?",
      answer: "Yes! We offer special discounts for non-profits and educational institutions. Contact our sales team for details.",
    },
  ];

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background Effects */}
      <div className="fixed inset-0 z-0 bg-gradient-mesh animate-gradient-shift bg-[length:200%_200%] opacity-30" />
      <div className="fixed inset-0 z-0 bg-background/98 backdrop-blur-sm" />

      {/* Navigation */}
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/40 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate("/")}>
            <Clock className="h-6 w-6 text-primary" />
            <span className="text-lg font-semibold">ClockWise</span>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate("/")}>Home</Button>
            <ThemeToggle />
            <Button onClick={() => navigate("/auth")}>Sign In</Button>
          </div>
        </div>
      </header>

      <div className="relative z-10">
        {/* Hero Section */}
        <section className="container py-20 text-center">
          <div className="mx-auto max-w-3xl space-y-6 animate-fade-in">
            <div className="inline-block rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
              Simple, Transparent Pricing
            </div>
            <h1 className="text-5xl font-bold tracking-tight sm:text-6xl bg-gradient-to-r from-primary via-purple-500 to-pink-500 bg-clip-text text-transparent">
              Choose the Perfect Plan for Your Team
            </h1>
            <p className="text-xl text-muted-foreground">
              Start free and scale as you grow. No hidden fees, no surprises.
            </p>
          </div>
        </section>

        {/* Pricing Cards */}
        <section className="container pb-20">
          <div className="grid gap-8 md:grid-cols-3 max-w-7xl mx-auto">
            {tiers.map((tier, index) => (
              <Card
                key={tier.name}
                className={`relative flex flex-col transition-all duration-300 hover:shadow-xl ${
                  tier.popular
                    ? "border-primary shadow-lg scale-105 bg-gradient-to-br from-background to-primary/5"
                    : "hover:border-primary/50"
                }`}
                style={{
                  animationDelay: `${index * 100}ms`,
                }}
              >
                {tier.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-primary to-purple-500 text-primary-foreground px-4 py-1 rounded-full text-sm font-semibold flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    Most Popular
                  </div>
                )}
                <CardHeader>
                  <CardTitle className="text-2xl">{tier.name}</CardTitle>
                  <CardDescription className="text-base">{tier.description}</CardDescription>
                  <div className="pt-4">
                    <div className="flex items-baseline gap-1">
                      <span className="text-5xl font-bold">{tier.price}</span>
                      <span className="text-muted-foreground">/{tier.period}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">{tier.users}</p>
                  </div>
                </CardHeader>
                <CardContent className="flex-1">
                  <ul className="space-y-3">
                    {tier.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2">
                        <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button
                    className="w-full"
                    variant={tier.popular ? "default" : "outline"}
                    size="lg"
                    onClick={() => navigate("/auth")}
                  >
                    {tier.cta}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </section>

        {/* Pricing Calculator */}
        <section className="container pb-20">
          <Card className="max-w-3xl mx-auto bg-gradient-to-br from-background to-primary/5 border-primary/20">
            <CardHeader className="text-center">
              <CardTitle className="text-3xl">Calculate Your Cost</CardTitle>
              <CardDescription>
                See exactly how much you'll pay based on your team size
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              <div className="space-y-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Number of users</span>
                  <span className="font-semibold text-lg">{userCount[0]}</span>
                </div>
                <Slider
                  value={userCount}
                  onValueChange={setUserCount}
                  min={1}
                  max={100}
                  step={1}
                  className="w-full"
                />
              </div>
              
              <div className="space-y-4 p-6 rounded-lg bg-background/50 border border-border/50">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Selected Tier:</span>
                  <span className="font-semibold text-xl text-primary">{priceInfo.tier}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Price per user/year:</span>
                  <span className="font-semibold">${priceInfo.perUser}</span>
                </div>
                <div className="flex justify-between items-center pt-4 border-t border-border/50">
                  <span className="font-semibold text-lg">Total Annual Cost:</span>
                  <span className="text-3xl font-bold bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
                    ${priceInfo.total}
                  </span>
                </div>
                {priceInfo.total > 0 && (
                  <p className="text-sm text-muted-foreground text-center">
                    That's just ${(priceInfo.total / 12 / userCount[0]).toFixed(2)} per user per month
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Features Comparison */}
        <section className="container pb-20">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4">All Plans Include</h2>
            <p className="text-xl text-muted-foreground">
              Full access to all essential features, regardless of your plan
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 max-w-6xl mx-auto">
            {allFeatures.map((feature, index) => (
              <Card
                key={index}
                className="text-center p-6 hover:shadow-lg transition-all duration-300 hover:scale-105 hover:border-primary/50"
              >
                <feature.icon className="h-10 w-10 mx-auto mb-4 text-primary" />
                <p className="font-medium">{feature.text}</p>
              </Card>
            ))}
          </div>
        </section>

        {/* FAQ Section */}
        <section className="container pb-20">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold mb-4">Frequently Asked Questions</h2>
              <p className="text-xl text-muted-foreground">
                Got questions? We've got answers.
              </p>
            </div>
            <Accordion type="single" collapsible className="w-full">
              {faqs.map((faq, index) => (
                <AccordionItem key={index} value={`item-${index}`}>
                  <AccordionTrigger className="text-left text-lg">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        {/* CTA Section */}
        <section className="container pb-20">
          <Card className="max-w-4xl mx-auto text-center bg-gradient-to-br from-primary/10 to-purple-500/10 border-primary/20">
            <CardHeader className="space-y-6 py-12">
              <CardTitle className="text-4xl font-bold">
                Ready to Transform Your Time Tracking?
              </CardTitle>
              <CardDescription className="text-lg">
                Join teams already using ClockWise to streamline their workflow.
                Start free today—no credit card required.
              </CardDescription>
              <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
                <Button size="lg" onClick={() => navigate("/auth")} className="text-lg px-8">
                  Start Free Trial
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                <Button size="lg" variant="outline" onClick={() => navigate("/")} className="text-lg px-8">
                  Learn More
                </Button>
              </div>
              <p className="text-sm text-muted-foreground pt-4">
                ✓ No credit card required • ✓ 30-day money-back guarantee • ✓ Cancel anytime
              </p>
            </CardHeader>
          </Card>
        </section>

        {/* Footer */}
        <footer className="border-t border-border/40 bg-background/40 backdrop-blur-xl">
          <div className="container py-8 text-center text-muted-foreground">
            <p>&copy; 2024 ClockWise. All rights reserved.</p>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default Pricing;
