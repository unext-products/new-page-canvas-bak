import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Slider } from "@/components/ui/slider";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  ArrowRight,
  X
} from "lucide-react";
import { Input } from "@/components/ui/input";

const Pricing = () => {
  const navigate = useNavigate();
  const [userCount, setUserCount] = useState([25]);
  const [billingPeriod, setBillingPeriod] = useState<"annual" | "monthly">("annual");
  const [ctaEmail, setCtaEmail] = useState("");

  const calculatePrice = (users: number, period: "annual" | "monthly") => {
    if (users <= 5) {
      return { total: 0, perUser: 0, tier: "Free", monthlyEquivalent: 0, annualSavings: 0 };
    }

    const baseRate = users <= 50 ? 40 : 30;

    if (period === "annual") {
      const total = users * baseRate;
      const monthlyEquivalent = total / 12;
      return { 
        total, 
        perUser: baseRate, 
        tier: users <= 50 ? "Pro" : "Pro Max",
        monthlyEquivalent,
        annualSavings: 0
      };
    }

    const monthlyPerUser = users <= 50 ? 5 : 4;
    const total = users * monthlyPerUser;
    const annualCostIfMonthly = total * 12;
    const annualCostIfAnnual = users * baseRate;
    const annualSavings = annualCostIfMonthly - annualCostIfAnnual;
    
    return { 
      total, 
      perUser: monthlyPerUser, 
      tier: users <= 50 ? "Pro" : "Pro Max",
      monthlyEquivalent: total,
      annualSavings
    };
  };

  const priceInfo = calculatePrice(userCount[0], billingPeriod);

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
      users: "Up to 5 users",
      annualPricePerUser: 0,
      monthlyPricePerUser: 0,
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
      users: "6–50 users",
      annualPricePerUser: 40,
      monthlyPricePerUser: 5,
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
      users: "51+ users",
      annualPricePerUser: 30,
      monthlyPricePerUser: 4,
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
    {
      name: "Enterprise",
      description: "For complex, high-scale teams",
      users: "100+ users or custom requirements",
      annualPricePerUser: null,
      monthlyPricePerUser: null,
      cta: "Contact Sales",
      popular: false,
      features: [
        "Everything in Pro Max",
        "Custom SLAs",
        "Dedicated account manager",
        "Custom integrations & onboarding",
        "Security & compliance reviews",
        "White-label options",
      ],
    },
  ];

  const comparisonFeatures = [
    { name: "Max users", Free: "5", Pro: "50", "Pro Max": "Unlimited", Enterprise: "Unlimited" },
    { name: "Timesheet entries", Free: true, Pro: true, "Pro Max": true, Enterprise: true },
    { name: "Basic reporting", Free: true, Pro: true, "Pro Max": true, Enterprise: true },
    { name: "Advanced analytics", Free: false, Pro: true, "Pro Max": true, Enterprise: true },
    { name: "Priority support", Free: false, Pro: true, "Pro Max": true, Enterprise: true },
    { name: "Custom reporting", Free: false, Pro: true, "Pro Max": true, Enterprise: true },
    { name: "Bulk operations", Free: false, Pro: true, "Pro Max": true, Enterprise: true },
    { name: "Dedicated support", Free: false, Pro: false, "Pro Max": true, Enterprise: true },
    { name: "Custom training", Free: false, Pro: false, "Pro Max": true, Enterprise: true },
    { name: "Custom integrations", Free: false, Pro: false, "Pro Max": true, Enterprise: true },
    { name: "SLA guarantee", Free: false, Pro: false, "Pro Max": true, Enterprise: true },
    { name: "Account manager", Free: false, Pro: false, "Pro Max": false, Enterprise: true },
    { name: "White-label options", Free: false, Pro: false, "Pro Max": false, Enterprise: true },
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
      question: "What payment methods do you accept?",
      answer: "We accept all major credit cards (Visa, MasterCard, American Express) and PayPal for annual subscriptions.",
    },
    {
      question: "Do you offer discounts for non-profits or educational institutions?",
      answer: "Yes! We offer special discounts for non-profits and educational institutions. Contact our sales team for details.",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-5xl px-6">
        <div className="glass-navbar rounded-full px-6 py-3 flex items-center justify-between border border-border/50 shadow-lg">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">C</span>
            </div>
            <span className="font-semibold text-foreground">ClockWise</span>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            <Link to="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Home
            </Link>
            <Link to="/pricing" className="text-sm text-foreground font-medium">
              Pricing
            </Link>
            <button 
              onClick={() => navigate("/auth")}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Login
            </button>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Button 
              onClick={() => navigate("/auth")}
              size="sm"
              className="rounded-full"
            >
              Start Free →
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-16 px-6">
        <div className="max-w-3xl mx-auto text-center space-y-4">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
            Simple pricing
          </h1>
          <p className="text-lg text-muted-foreground">
            Start free. Scale as you grow. No hidden fees.
          </p>
        </div>
      </section>

      {/* Trust Indicators */}
      <section className="pb-12 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-sm text-muted-foreground">
            <span>500+ organizations</span>
            <span className="hidden sm:inline">•</span>
            <span>100k+ hours tracked</span>
            <span className="hidden sm:inline">•</span>
            <span>99.9% uptime</span>
          </div>
        </div>
      </section>

      {/* Billing Period Toggle */}
      <section className="pb-12 px-6">
        <div className="flex items-center justify-center">
          <div className="inline-flex items-center gap-1 rounded-full border border-border/50 bg-muted/30 px-1 py-1 text-sm">
            <button
              type="button"
              onClick={() => setBillingPeriod("monthly")}
              className={`px-4 py-2 rounded-full transition-all ${
                billingPeriod === "monthly"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setBillingPeriod("annual")}
              className={`px-4 py-2 rounded-full transition-all flex items-center gap-2 ${
                billingPeriod === "annual"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Annual
              <span className="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs font-medium">
                Save 20%
              </span>
            </button>
          </div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="pb-20 px-6">
        <div className="grid gap-6 lg:grid-cols-4 md:grid-cols-2 max-w-6xl mx-auto">
          {tiers.map((tier) => {
            const isEnterprise = tier.name === "Enterprise";
            const perUser =
              billingPeriod === "annual" ? tier.annualPricePerUser : tier.monthlyPricePerUser;

            const priceLabel = isEnterprise
              ? "Custom"
              : perUser === 0
              ? "$0"
              : billingPeriod === "annual"
              ? `$${perUser}`
              : `$${perUser.toFixed(2)}`;

            const periodLabel = isEnterprise
              ? "pricing"
              : perUser === 0
              ? "forever"
              : billingPeriod === "annual"
              ? "per user/year"
              : "per user/month";

            return (
              <Card
                key={tier.name}
                className={`relative flex flex-col transition-all hover:border-primary/50 ${
                  tier.popular ? "border-primary" : "border-border/50"
                }`}
              >
                {tier.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-3 py-1 rounded-full text-xs font-medium">
                    Most Popular
                  </div>
                )}
                <CardHeader className="pb-4">
                  <CardTitle className="text-xl">{tier.name}</CardTitle>
                  <CardDescription>{tier.description}</CardDescription>
                  <div className="pt-4">
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-bold">{priceLabel}</span>
                      <span className="text-muted-foreground text-sm">/{periodLabel}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{tier.users}</p>
                  </div>
                </CardHeader>
                <CardContent className="flex-1">
                  <ul className="space-y-2.5">
                    {tier.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2">
                        <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button
                    className="w-full"
                    variant={tier.popular ? "default" : "outline"}
                    onClick={() =>
                      tier.name === "Enterprise"
                        ? (window.location.href = "mailto:sales@clockwise.com?subject=Enterprise%20Pricing")
                        : navigate("/auth")
                    }
                  >
                    {tier.cta}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Calculator */}
      <section className="pb-20 px-6">
        <Card className="max-w-2xl mx-auto border border-border/50">
          <CardHeader>
            <CardTitle className="text-xl">Calculate your price</CardTitle>
            <CardDescription>
              Adjust the slider to see how pricing scales with your team
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Number of Users</label>
                <span className="text-xl font-bold text-primary">{userCount[0]}</span>
              </div>
              <Slider
                value={userCount}
                onValueChange={setUserCount}
                max={200}
                min={1}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>1 user</span>
                <span>200 users</span>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-muted/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Recommended plan:</span>
                <span className="font-semibold text-primary">{priceInfo.tier}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {billingPeriod === "annual" ? "Annual cost:" : "Monthly cost:"}
                </span>
                <span className="font-bold text-xl">
                  ${priceInfo.total.toFixed(2)}
                </span>
              </div>
              {billingPeriod === "monthly" && priceInfo.annualSavings > 0 && (
                <div className="flex items-center justify-between pt-2 border-t border-border/50">
                  <span className="text-xs text-muted-foreground">
                    Save with annual billing:
                  </span>
                  <span className="text-sm font-medium text-primary">
                    ${priceInfo.annualSavings.toFixed(2)}/year
                  </span>
                </div>
              )}
            </div>
          </CardContent>
          <CardFooter>
            <Button className="w-full" onClick={() => navigate("/auth")}>
              Get Started
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardFooter>
        </Card>
      </section>

      {/* Feature Comparison Table */}
      <section className="pb-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold mb-2">Compare plans</h2>
            <p className="text-muted-foreground">
              See exactly what you get with each plan
            </p>
          </div>
          <div className="overflow-x-auto rounded-lg border border-border/50">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="w-1/4 text-left font-medium">Feature</TableHead>
                  <TableHead className="text-center font-medium">Free</TableHead>
                  <TableHead className="text-center font-medium">Pro</TableHead>
                  <TableHead className="text-center font-medium">Pro Max</TableHead>
                  <TableHead className="text-center font-medium">Enterprise</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {comparisonFeatures.map((feature) => (
                  <TableRow key={feature.name}>
                    <TableCell className="font-medium text-left">{feature.name}</TableCell>
                    {["Free", "Pro", "Pro Max", "Enterprise"].map((tierName) => {
                      const value = (feature as any)[tierName];
                      return (
                        <TableCell key={tierName} className="text-center">
                          {typeof value === "boolean" ? (
                            value ? (
                              <Check className="mx-auto h-4 w-4 text-primary" />
                            ) : (
                              <X className="mx-auto h-4 w-4 text-muted-foreground/30" />
                            )
                          ) : (
                            <span className="text-sm">{value}</span>
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </section>

      {/* All Features */}
      <section className="pb-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold mb-2">Everything you need</h2>
            <p className="text-muted-foreground">
              Powerful features for modern time tracking
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {allFeatures.map((feature, index) => (
              <div
                key={index}
                className="flex items-center gap-3 p-4 rounded-lg border border-border/50"
              >
                <feature.icon className="h-5 w-5 text-primary shrink-0" />
                <span className="text-sm">{feature.text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="pb-20 px-6">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold mb-2">Frequently asked questions</h2>
            <p className="text-muted-foreground">
              Got questions? We've got answers.
            </p>
          </div>
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((faq, index) => (
              <AccordionItem key={index} value={`item-${index}`} className="border-border/50">
                <AccordionTrigger className="text-left">
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
      <section className="py-20 px-6 border-t border-border/50">
        <div className="max-w-xl mx-auto text-center space-y-6">
          <h2 className="text-2xl font-bold">
            Ready to simplify time tracking?
          </h2>
          <p className="text-muted-foreground">
            Join teams already using ClockWise. Start free today.
          </p>
          <form 
            className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto"
            onSubmit={(e) => {
              e.preventDefault();
              navigate("/auth");
            }}
          >
            <Input
              type="email"
              placeholder="Enter your work email"
              value={ctaEmail}
              onChange={(e) => setCtaEmail(e.target.value)}
              className="flex-1"
            />
            <Button type="submit">
              Get Started →
            </Button>
          </form>
          <p className="text-xs text-muted-foreground">
            Free for up to 5 users. No credit card required.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-12 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                  <span className="text-primary-foreground font-bold text-sm">C</span>
                </div>
                <span className="font-semibold">ClockWise</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Simple time tracking for teams.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <div className="space-y-2 text-sm">
                <Link to="/" className="block text-muted-foreground hover:text-foreground transition-colors">
                  Home
                </Link>
                <Link to="/pricing" className="block text-muted-foreground hover:text-foreground transition-colors">
                  Pricing
                </Link>
                <button 
                  onClick={() => navigate("/auth")}
                  className="block text-muted-foreground hover:text-foreground transition-colors text-left"
                >
                  Login
                </button>
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Legal</h4>
              <div className="space-y-2 text-sm">
                <a href="#" className="block text-muted-foreground hover:text-foreground transition-colors">
                  Privacy
                </a>
                <a href="#" className="block text-muted-foreground hover:text-foreground transition-colors">
                  Terms
                </a>
              </div>
            </div>
          </div>

          <div className="pt-8 border-t border-border/50 text-center text-sm text-muted-foreground">
            © 2025 ClockWise. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Pricing;
