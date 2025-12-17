import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import mabLogo from "@/assets/mab-logo.png";

interface LogoProps {
  to?: string;
  variant?: "light" | "dark";
  size?: "sm" | "md" | "lg";
  className?: string;
  showMabLogo?: boolean;
}

export function Logo({ to = "/", variant = "dark", size = "md", className, showMabLogo = true }: LogoProps) {
  const sizeClasses = {
    sm: "text-base",
    md: "text-lg",
    lg: "text-xl",
  };

  const logoSizes = {
    sm: "h-5 w-5",
    md: "h-6 w-6",
    lg: "h-7 w-7",
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
    <span className={cn("flex items-center gap-2", className)}>
      {showMabLogo && (
        <img 
          src={mabLogo} 
          alt="Manipal Academy of BFSI" 
          className={cn(logoSizes[size], "object-contain")}
        />
      )}
      <span className="flex items-center gap-0.5">
        <span className={cn(sizeClasses[size], "font-semibold tracking-tight", textColors[variant].primary)}>
          Clockwise
        </span>
        <span className={cn(sizeClasses[size], "font-normal", textColors[variant].secondary)}>
          for MAB
        </span>
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
