import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { NavBar } from "@/components/landing/NavBar";
import { HeroSection } from "@/components/landing/HeroSection";

import { FeaturesGrid } from "@/components/landing/FeaturesGrid";
import { HowItWorksMinimal } from "@/components/landing/HowItWorksMinimal";
import { Testimonial } from "@/components/landing/Testimonial";
import { FinalCTA } from "@/components/landing/FinalCTA";
import { FooterMinimal } from "@/components/landing/FooterMinimal";

export default function Index() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && session) {
      navigate("/dashboard");
    }
  }, [session, loading, navigate]);

  if (loading) {
    return null;
  }

  return (
    <div className="min-h-screen bg-landing-dark">
      <NavBar />
      <HeroSection />
      
      <FeaturesGrid />
      <HowItWorksMinimal />
      <Testimonial />
      <FinalCTA />
      <FooterMinimal />
    </div>
  );
}
