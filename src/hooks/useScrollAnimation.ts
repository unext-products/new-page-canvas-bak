import { useEffect, useState, RefObject } from "react";

export function useScrollAnimation(ref: RefObject<HTMLElement>, threshold = 0.1) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold }
    );

    const currentRef = ref.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    // Fallback timeout to ensure content becomes visible
    const fallbackTimer = setTimeout(() => {
      setIsVisible(true);
    }, 500);

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
      clearTimeout(fallbackTimer);
    };
  }, [ref, threshold]);

  return isVisible;
}
