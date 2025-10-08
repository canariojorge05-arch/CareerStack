import { LoadingSpinner } from "./loading-spinner";
import { cn } from "@/lib/utils";
import { FileText } from "lucide-react";

interface PageLoaderProps {
  text?: string;
  subText?: string;
  className?: string;
  variant?: "default" | "minimal" | "branded";
  overlay?: boolean;
}

export function PageLoader({ 
  text = "Loading...", 
  subText,
  className,
  variant = "default",
  overlay = false
}: PageLoaderProps) {
  const baseClasses = "flex flex-col items-center justify-center gap-4";
  const containerClasses = overlay 
    ? "fixed inset-0 z-50 bg-background/80 backdrop-blur-sm"
    : "min-h-screen";

  if (variant === "minimal") {
    return (
      <div className={cn(containerClasses, baseClasses, className)}>
        <LoadingSpinner size="lg" text={text} />
      </div>
    );
  }

  if (variant === "branded") {
    return (
      <div className={cn(containerClasses, baseClasses, className)}>
        <div className="flex flex-col items-center gap-6">
          {/* Brand Logo */}
          <div className="flex items-center space-x-3">
            <div className="h-12 w-12 bg-primary rounded-lg flex items-center justify-center">
              <FileText className="text-primary-foreground" size={24} />
            </div>
            <h1 className="text-2xl font-semibold text-foreground">
              ResumeCustomizer Pro
            </h1>
          </div>
          
          {/* Loading Animation */}
          <div className="flex flex-col items-center gap-3">
            <LoadingSpinner size="lg" variant="primary" />
            <div className="text-center">
              <p className="text-lg font-medium text-foreground">{text}</p>
              {subText && (
                <p className="text-sm text-muted-foreground mt-1">{subText}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Default variant
  return (
    <div className={cn(containerClasses, baseClasses, className)}>
      <div className="flex flex-col items-center gap-4 p-8 rounded-lg bg-card border shadow-sm">
        <LoadingSpinner size="lg" />
        <div className="text-center">
          <p className="text-lg font-medium text-foreground">{text}</p>
          {subText && (
            <p className="text-sm text-muted-foreground mt-1">{subText}</p>
          )}
        </div>
      </div>
    </div>
  );
}
