import { useState, useEffect } from "react";
import Joyride, { CallBackProps, STATUS, Step } from "react-joyride";
import { useAuth } from "@/contexts/AuthContext";

const TOUR_STORAGE_KEY = "timesheet-onboarding-completed";

interface OnboardingTourProps {
  run?: boolean;
  onComplete?: () => void;
}

export function OnboardingTour({ run: externalRun, onComplete }: OnboardingTourProps) {
  const { userWithRole } = useAuth();
  const [run, setRun] = useState(false);

  const steps: Step[] = [
    {
      target: '[data-tour="new-entry"]',
      content: "Click here to log a new timesheet entry. You can record your work activities, class hours, and more.",
      placement: "bottom",
      disableBeacon: true,
    },
    {
      target: '[data-tour="mark-leave"]',
      content: "Need to mark a day off? Use this button to record leave days like sick leave, vacation, or personal time.",
      placement: "bottom",
    },
    {
      target: '[data-tour="entries-list"]',
      content: "All your timesheet entries appear here. You can see their status, edit drafts, or track approved hours.",
      placement: "top",
    },
  ];

  useEffect(() => {
    // Check if user has completed the tour
    const hasCompletedTour = localStorage.getItem(TOUR_STORAGE_KEY);
    
    // Only auto-run for members who haven't completed the tour
    if (!hasCompletedTour && userWithRole?.role === "member") {
      // Small delay to ensure DOM elements are ready
      const timer = setTimeout(() => setRun(true), 500);
      return () => clearTimeout(timer);
    }
  }, [userWithRole]);

  // Allow external control
  useEffect(() => {
    if (externalRun !== undefined) {
      setRun(externalRun);
    }
  }, [externalRun]);

  const handleCallback = (data: CallBackProps) => {
    const { status } = data;
    
    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      setRun(false);
      localStorage.setItem(TOUR_STORAGE_KEY, "true");
      onComplete?.();
    }
  };

  return (
    <Joyride
      steps={steps}
      run={run}
      continuous
      showProgress
      showSkipButton
      callback={handleCallback}
      styles={{
        options: {
          primaryColor: "hsl(var(--primary))",
          textColor: "hsl(var(--foreground))",
          backgroundColor: "hsl(var(--background))",
          arrowColor: "hsl(var(--background))",
          overlayColor: "rgba(0, 0, 0, 0.5)",
          zIndex: 10000,
        },
        tooltip: {
          borderRadius: "0.75rem",
          padding: "1rem",
        },
        buttonNext: {
          borderRadius: "0.5rem",
          padding: "0.5rem 1rem",
        },
        buttonBack: {
          borderRadius: "0.5rem",
          padding: "0.5rem 1rem",
          marginRight: "0.5rem",
        },
        buttonSkip: {
          borderRadius: "0.5rem",
          padding: "0.5rem 1rem",
        },
      }}
      locale={{
        back: "Back",
        close: "Close",
        last: "Got it!",
        next: "Next",
        skip: "Skip tour",
      }}
    />
  );
}

// Hook to manually trigger the tour
export function useOnboardingTour() {
  const resetTour = () => {
    localStorage.removeItem(TOUR_STORAGE_KEY);
  };

  const hasSeen = () => {
    return localStorage.getItem(TOUR_STORAGE_KEY) === "true";
  };

  return { resetTour, hasSeen };
}
