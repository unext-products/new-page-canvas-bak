import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

interface LogoProps {
  to?: string;
  variant?: "light" | "dark";
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function Logo({ to = "/", variant = "dark", size = "md", className }: LogoProps) {
  const sizeClasses = {
    sm: "text-base",
    md: "text-lg",
    lg: "text-xl",
  };

  const textColors = {
    light: {
      primary: "text-white",
      secondary: "text-white/80",
    },
    dark: {
      primary: "text-foreground",
      secondary: "text-muted-foreground",
    },
  };

  const content = (
    <span className={cn("flex items-center gap-0.5", className)}>
      <span className={cn(sizeClasses[size], "font-semibold italic tracking-tight", textColors[variant].primary)}>
        Clock
      </span>
      <span className={cn(sizeClasses[size], "font-normal", textColors[variant].secondary)}>
        Wise
      </span>
    </span>
  );

  if (to) {
    return (
      <Link to={to} className="flex items-center">
        {content}
      </Link>
    );
  }

  return content;
}
