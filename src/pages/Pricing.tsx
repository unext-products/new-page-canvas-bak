import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Slider } from "@/components/ui/slider";
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
import { NavBar } from "@/components/landing/NavBar";
import { FooterMinimal } from "@/components/landing/FooterMinimal";

const Pricing = () => {
  const navigate = useNavigate();
  const [userCount, setUserCount] = useState([25]);
  const [billingPeriod, setBillingPeriod] = useState<"annual" | "monthly">("annual");

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
    <div className="min-h-screen bg-landing-dark">
      <NavBar />

      {/* Hero Section */}
      <section className="pt-32 pb-16 px-6">
        <div className="max-w-3xl mx-auto text-center space-y-4">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-gray-900 font-display">
            Simple pricing
          </h1>
          <p className="text-lg text-landing-secondary">
            Start free. Scale as you grow. No hidden fees.
          </p>
        </div>
      </section>

      {/* Trust Indicators */}
      <section className="pb-12 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-sm text-landing-muted">
            <span>500+ organizations</span>
            <span className="hidden sm:inline text-landing-border">•</span>
            <span>100k+ hours tracked</span>
            <span className="hidden sm:inline text-landing-border">•</span>
            <span>99.9% uptime</span>
          </div>
        </div>
      </section>

      {/* Billing Period Toggle */}
      <section className="pb-12 px-6">
        <div className="flex items-center justify-center">
          <div className="inline-flex items-center gap-1 rounded-full border border-landing-border bg-landing-card px-1 py-1 text-sm">
            <button
              type="button"
              onClick={() => setBillingPeriod("monthly")}
              className={`px-4 py-2 rounded-full transition-all ${
                billingPeriod === "monthly"
                  ? "bg-primary text-white"
                  : "text-landing-muted hover:text-gray-900"
              }`}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setBillingPeriod("annual")}
              className={`px-4 py-2 rounded-full transition-all flex items-center gap-2 ${
                billingPeriod === "annual"
                  ? "bg-primary text-white"
                  : "text-landing-muted hover:text-gray-900"
              }`}
            >
              Annual
              <span className="rounded-full bg-primary/20 text-primary px-2 py-0.5 text-xs font-medium">
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
              <div
                key={tier.name}
                className={`relative flex flex-col rounded-2xl p-6 transition-all ${
                  tier.popular 
                    ? "bg-landing-card border-2 border-primary" 
                    : "bg-landing-card border border-landing-border hover:border-landing-border-hover"
                }`}
              >
                {tier.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-white px-3 py-1 rounded-full text-xs font-medium">
                    Most Popular
                  </div>
                )}
                
                <div className="mb-6">
                  <h3 className="text-xl font-semibold text-gray-900 mb-1">{tier.name}</h3>
                  <p className="text-sm text-landing-muted">{tier.description}</p>
                </div>
                
                <div className="mb-6">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-gray-900">{priceLabel}</span>
                    <span className="text-landing-muted text-sm">/{periodLabel}</span>
                  </div>
                  <p className="text-sm text-landing-muted mt-1">{tier.users}</p>
                </div>
                
                <ul className="space-y-3 mb-8 flex-1">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <span className="text-sm text-landing-secondary">{feature}</span>
                    </li>
                  ))}
                </ul>
                
                <Button
                  className={`w-full ${
                    tier.popular 
                      ? "bg-primary text-white hover:bg-primary/90" 
                      : "bg-transparent border border-landing-border text-gray-900 hover:bg-gray-100"
                  }`}
                  onClick={() =>
                    tier.name === "Enterprise"
                      ? (window.location.href = "mailto:sales@clockwisemab.com?subject=Enterprise%20Pricing")
                      : navigate("/auth")
                  }
                >
                  {tier.cta}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Calculator */}
      <section className="pb-20 px-6">
        <div className="max-w-2xl mx-auto rounded-2xl bg-landing-card border border-landing-border p-8">
          <div className="mb-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-2">Calculate your price</h3>
            <p className="text-sm text-landing-muted">
              Adjust the slider to see how pricing scales with your team
            </p>
          </div>
          
          <div className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-landing-secondary">Number of Users</label>
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
              <div className="flex justify-between text-xs text-landing-muted">
                <span>1 user</span>
                <span>200 users</span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-gray-50 border border-landing-border space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-landing-muted">Recommended plan:</span>
                <span className="font-semibold text-primary">{priceInfo.tier}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-landing-muted">
                  {billingPeriod === "annual" ? "Annual cost:" : "Monthly cost:"}
                </span>
                <span className="font-bold text-xl text-gray-900">
                  ${priceInfo.total.toFixed(2)}
                </span>
              </div>
              {billingPeriod === "monthly" && priceInfo.annualSavings > 0 && (
                <div className="flex items-center justify-between pt-3 border-t border-landing-border">
                  <span className="text-xs text-landing-muted">
                    Save with annual billing:
                  </span>
                  <span className="text-sm font-medium text-primary">
                    ${priceInfo.annualSavings.toFixed(2)}/year
                  </span>
                </div>
              )}
            </div>
          </div>
          
          <Button 
            className="w-full mt-6 bg-primary text-white hover:bg-primary/90" 
            onClick={() => navigate("/auth")}
          >
            Get Started
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </section>

      {/* Feature Comparison Table */}
      <section className="pb-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-2 font-display">Compare plans</h2>
            <p className="text-landing-secondary">
              See exactly what you get with each plan
            </p>
          </div>
          <div className="overflow-x-auto rounded-xl border border-landing-border">
            <Table>
              <TableHeader>
                <TableRow className="bg-landing-card border-landing-border">
                  <TableHead className="w-1/4 text-left font-medium text-gray-900">Feature</TableHead>
                  <TableHead className="text-center font-medium text-gray-900">Free</TableHead>
                  <TableHead className="text-center font-medium text-gray-900">Pro</TableHead>
                  <TableHead className="text-center font-medium text-gray-900">Pro Max</TableHead>
                  <TableHead className="text-center font-medium text-gray-900">Enterprise</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {comparisonFeatures.map((feature) => (
                  <TableRow key={feature.name} className="border-landing-border">
                    <TableCell className="font-medium text-left text-landing-secondary">{feature.name}</TableCell>
                    {["Free", "Pro", "Pro Max", "Enterprise"].map((tierName) => {
                      const value = (feature as any)[tierName];
                      return (
                        <TableCell key={tierName} className="text-center">
                          {typeof value === "boolean" ? (
                            value ? (
                              <Check className="mx-auto h-4 w-4 text-primary" />
                            ) : (
                              <X className="mx-auto h-4 w-4 text-landing-muted/30" />
                            )
                          ) : (
                            <span className="text-sm text-landing-secondary">{value}</span>
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
            <h2 className="text-2xl font-bold text-gray-900 mb-2 font-display">Everything you need</h2>
            <p className="text-landing-secondary">
              Powerful features for modern time tracking
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {allFeatures.map((feature, index) => (
              <div
                key={index}
                className="flex items-center gap-3 p-4 rounded-xl bg-landing-card border border-landing-border"
              >
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <feature.icon className="h-4 w-4 text-primary" />
                </div>
                <span className="text-sm text-landing-secondary">{feature.text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="pb-20 px-6">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-2 font-display">Frequently asked questions</h2>
            <p className="text-landing-secondary">
              Got questions? We've got answers.
            </p>
          </div>
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((faq, index) => (
              <AccordionItem 
                key={index} 
                value={`item-${index}`} 
                className="border-landing-border"
              >
                <AccordionTrigger className="text-left text-gray-900 hover:text-gray-700">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-landing-secondary">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6 border-t border-landing-border">
        <div className="max-w-xl mx-auto text-center space-y-6">
          <h2 className="text-2xl font-bold text-gray-900 font-display">
            Ready to simplify time tracking?
          </h2>
          <p className="text-landing-secondary">
            Join teams already using Clockwise for MAB. Start free today.
          </p>
          <Button 
            size="lg"
            className="bg-primary text-white hover:bg-primary/90"
            onClick={() => navigate("/auth")}
          >
            Get Started
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
          <p className="text-xs text-landing-muted">
            Free for up to 5 users. No credit card required.
          </p>
        </div>
      </section>

      <FooterMinimal />
    </div>
  );
};

export default Pricing;
