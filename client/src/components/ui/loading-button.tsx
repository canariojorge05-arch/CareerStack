import * as React from "react";
import { Button, ButtonProps } from "./button";
import { LoadingSpinner } from "./loading-spinner";
import { cn } from "@/lib/utils";

interface LoadingButtonProps extends ButtonProps {
  loading?: boolean;
  loadingText?: string;
  children: React.ReactNode;
}

export const LoadingButton = React.forwardRef<
  HTMLButtonElement,
  LoadingButtonProps
>(({ className, loading = false, loadingText, children, disabled, ...props }, ref) => {
  return (
    <Button
      className={cn(className)}
      disabled={disabled || loading}
      ref={ref}
      {...props}
    >
      {loading ? (
        <div className="flex items-center gap-2">
          <LoadingSpinner size="sm" />
          {loadingText || children}
        </div>
      ) : (
        children
      )}
    </Button>
  );
});

LoadingButton.displayName = "LoadingButton";
