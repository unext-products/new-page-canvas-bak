import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
  Sparkles,
  ArrowRight,
  Star,
  X
} from "lucide-react";

const Pricing = () => {
  const navigate = useNavigate();
  const [userCount, setUserCount] = useState([25]);
  const [billingPeriod, setBillingPeriod] = useState<"annual" | "monthly">("annual");

  const calculatePrice = (users: number, period: "annual" | "monthly") => {
    if (users <= 5) {
      return { total: 0, perUser: 0, tier: "Free", monthlyEquivalent: 0, annualSavings: 0 };
    }

    const baseRate = users <= 50 ? 20 : 15; // per user / year

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

    // Monthly pricing (20% more expensive than annual equivalent)
    const monthlyPerUser = (baseRate / 12) * 1.2;
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
      annualPricePerUser: 20,
      monthlyPricePerUser: 2,
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
      annualPricePerUser: 15,
      monthlyPricePerUser: 1.5,
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

  const testimonials = [
    {
      quote: "ClockWise has completely transformed how we manage timesheets and approvals. Our team loves it!",
      author: "Sarah Johnson",
      role: "HR Director",
      company: "TechCorp",
    },
    {
      quote: "Our team adopted it in days and we've saved hours each week. The ROI was immediate.",
      author: "Michael Chen",
      role: "Operations Manager",
      company: "Bright Logistics",
    },
    {
      quote: "The reports give us the visibility we were missing. Game changer for our finance team.",
      author: "Priya Singh",
      role: "Head of Finance",
      company: "FinEdge",
    },
  ];

  const trustIndicators = [
    { label: "500+ organizations", detail: "across industries" },
    { label: "100k+ hours", detail: "tracked every month" },
    { label: "4.9 / 5", detail: "average rating from admins" },
    { label: "99.9% uptime", detail: "for peace of mind" },
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
    {
      question: "Do you offer onboarding support?",
      answer: "Yes! All paid plans include onboarding support. Pro Max and Enterprise plans include dedicated onboarding sessions and custom training.",
    },
    {
      question: "Can I export my data?",
      answer: "Absolutely. You can export your data at any time in CSV, Excel, or PDF formats. We believe your data is yours.",
    },
    {
      question: "Do you have an API?",
      answer: "Yes, we offer a REST API for Pro Max and Enterprise plans. API documentation is available in your dashboard after upgrading.",
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

        {/* Trust Indicators */}
        <section className="container pb-10">
          <div className="max-w-4xl mx-auto grid gap-4 sm:grid-cols-4 text-center text-sm">
            {trustIndicators.map((item) => (
              <div key={item.label} className="space-y-1">
                <p className="font-semibold text-lg">{item.label}</p>
                <p className="text-muted-foreground text-xs">{item.detail}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Billing Period Toggle */}
        <section className="container pb-8">
          <div className="flex items-center justify-center">
            <div className="inline-flex items-center gap-2 rounded-full border bg-card px-1 py-1 text-xs sm:text-sm shadow-sm">
              <button
                type="button"
                onClick={() => setBillingPeriod("monthly")}
                className={`px-4 py-2 rounded-full transition-all duration-200 ${
                  billingPeriod === "monthly"
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setBillingPeriod("annual")}
                className={`px-4 py-2 rounded-full transition-all duration-200 flex items-center gap-2 ${
                  billingPeriod === "annual"
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Annual
                <span className="rounded-full bg-green-500/20 text-green-600 dark:text-green-400 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                  Save 20%
                </span>
              </button>
            </div>
          </div>
        </section>

        {/* Pricing Cards */}
        <section className="container pb-20">
          <div className="grid gap-8 lg:grid-cols-4 md:grid-cols-2 max-w-7xl mx-auto">
            {tiers.map((tier, index) => {
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
                  className={`relative flex flex-col transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${
                    tier.popular
                      ? "border-primary shadow-lg scale-105 bg-gradient-to-br from-background to-primary/5"
                      : "hover:border-primary/50"
                  }`}
                  style={{
                    animationDelay: `${index * 100}ms`,
                  }}
                >
                  {tier.popular && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-primary to-purple-500 text-primary-foreground px-4 py-1 rounded-full text-sm font-semibold flex items-center gap-1 shadow-lg">
                      <Sparkles className="h-3 w-3" />
                      Most Popular
                    </div>
                  )}
                  <CardHeader>
                    <CardTitle className="text-2xl">{tier.name}</CardTitle>
                    <CardDescription className="text-base">{tier.description}</CardDescription>
                    <div className="pt-4">
                      <div className="flex items-baseline gap-1">
                        <span className="text-5xl font-bold tracking-tight">{priceLabel}</span>
                        <span className="text-muted-foreground text-sm">/{periodLabel}</span>
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
                      className="w-full group"
                      variant={tier.popular ? "default" : "outline"}
                      size="lg"
                      onClick={() =>
                        tier.name === "Enterprise"
                          ? (window.location.href = "mailto:sales@clockwise.com?subject=Enterprise%20Pricing")
                          : navigate("/auth")
                      }
                    >
                      {tier.cta}
                      <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        </section>

        {/* Enhanced Calculator */}
        <section className="container pb-20">
          <Card className="max-w-3xl mx-auto border-2 shadow-xl">
            <CardHeader>
              <CardTitle className="text-2xl">Calculate Your Price</CardTitle>
              <CardDescription>
                Adjust the slider to see how pricing scales with your team size
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Number of Users</label>
                  <span className="text-2xl font-bold text-primary">{userCount[0]}</span>
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

              <div className="p-6 rounded-lg bg-muted/50 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Recommended plan:</span>
                  <span className="font-semibold text-lg text-primary">{priceInfo.tier}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {billingPeriod === "annual" ? "Annual cost:" : "Monthly cost:"}
                  </span>
                  <span className="font-bold text-2xl">
                    ${priceInfo.total.toFixed(2)}
                  </span>
                </div>
                {billingPeriod === "annual" && priceInfo.total > 0 && (
                  <div className="flex items-center justify-between pt-2 border-t">
                    <span className="text-xs text-muted-foreground">Monthly equivalent:</span>
                    <span className="text-sm font-medium">
                      ${priceInfo.monthlyEquivalent.toFixed(2)}/month
                    </span>
                  </div>
                )}
                {billingPeriod === "monthly" && priceInfo.annualSavings > 0 && (
                  <div className="flex items-center justify-between pt-2 border-t">
                    <span className="text-xs text-green-600 dark:text-green-400">
                      Save with annual billing:
                    </span>
                    <span className="text-sm font-semibold text-green-600 dark:text-green-400">
                      ${priceInfo.annualSavings.toFixed(2)}/year
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
            <CardFooter>
              <Button className="w-full" size="lg" onClick={() => navigate("/auth")}>
                Get Started Now
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardFooter>
          </Card>
        </section>

        {/* Feature Comparison Table */}
        <section className="container pb-20">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="text-3xl font-bold tracking-tight mb-3">Compare Plans</h2>
              <p className="text-muted-foreground text-lg">
                See exactly what you get with each plan
              </p>
            </div>
            <div className="overflow-x-auto rounded-lg border shadow-lg">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-1/4 text-left font-semibold">Feature</TableHead>
                    <TableHead className="text-center font-semibold">Free</TableHead>
                    <TableHead className="text-center font-semibold">Pro</TableHead>
                    <TableHead className="text-center font-semibold">Pro Max</TableHead>
                    <TableHead className="text-center font-semibold">Enterprise</TableHead>
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
                                <Check className="mx-auto h-5 w-5 text-primary" />
                              ) : (
                                <X className="mx-auto h-4 w-4 text-muted-foreground/40" />
                              )
                            ) : (
                              <span className="font-medium">{value}</span>
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

        {/* Testimonials */}
        <section className="container pb-20">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="text-3xl font-bold tracking-tight mb-3">Teams Love ClockWise</h2>
              <p className="text-muted-foreground text-lg">
                Hear from organizations who streamlined their time tracking
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              {testimonials.map((t) => (
                <Card key={t.author} className="h-full flex flex-col hover:shadow-lg transition-shadow">
                  <CardContent className="pt-6 flex flex-col flex-1">
                    <div className="flex gap-1 text-yellow-400 mb-4">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className="h-4 w-4 fill-yellow-400" />
                      ))}
                    </div>
                    <p className="text-sm text-muted-foreground mb-6 flex-1 leading-relaxed">
                      "{t.quote}"
                    </p>
                    <div className="mt-auto pt-4 border-t">
                      <p className="font-semibold text-sm">{t.author}</p>
                      <p className="text-xs text-muted-foreground">
                        {t.role}, {t.company}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
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

        {/* All Features */}
        <section className="container pb-20">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="text-3xl font-bold tracking-tight mb-3">Everything You Need</h2>
              <p className="text-muted-foreground text-lg">
                Powerful features for modern time tracking
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
