import { LoadingSpinner } from "./loading-spinner";
import { cn } from "@/lib/utils";
import { Progress } from "./progress";

interface LoadingOverlayProps {
  isLoading: boolean;
  text?: string;
  subText?: string;
  progress?: number;
  className?: string;
  variant?: "default" | "blur" | "dark";
  children: React.ReactNode;
}

export function LoadingOverlay({
  isLoading,
  text = "Loading...",
  subText,
  progress,
  className,
  variant = "default",
  children
}: LoadingOverlayProps) {
  const overlayClasses = {
    default: "bg-background/80 backdrop-blur-sm",
    blur: "bg-background/60 backdrop-blur-md",
    dark: "bg-black/50 backdrop-blur-sm"
  };

  return (
    <div className={cn("relative", className)}>
      {children}
      
      {isLoading && (
        <div className={cn(
          "absolute inset-0 z-50 flex items-center justify-center",
          overlayClasses[variant]
        )}>
          <div className="bg-card border rounded-lg p-6 shadow-lg max-w-sm w-full mx-4">
            <div className="flex flex-col items-center gap-4">
              <LoadingSpinner size="lg" />
              
              <div className="text-center">
                <p className="text-lg font-medium text-foreground">{text}</p>
                {subText && (
                  <p className="text-sm text-muted-foreground mt-1">{subText}</p>
                )}
              </div>
              
              {progress !== undefined && (
                <div className="w-full space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="text-foreground font-medium">{progress}%</span>
                  </div>
                  <Progress value={progress} className="w-full" />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
