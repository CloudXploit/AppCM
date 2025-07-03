import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/utils";

const statusIndicatorVariants = cva(
  "inline-flex items-center gap-2",
  {
    variants: {
      status: {
        healthy: "text-success",
        warning: "text-warning",
        critical: "text-destructive",
        unknown: "text-muted-foreground",
        offline: "text-muted-foreground",
      },
      size: {
        sm: "text-xs",
        md: "text-sm",
        lg: "text-base",
      },
    },
    defaultVariants: {
      status: "unknown",
      size: "md",
    },
  }
);

const dotVariants = cva(
  "rounded-full",
  {
    variants: {
      status: {
        healthy: "bg-success",
        warning: "bg-warning",
        critical: "bg-destructive",
        unknown: "bg-muted-foreground",
        offline: "bg-muted-foreground",
      },
      size: {
        sm: "h-2 w-2",
        md: "h-2.5 w-2.5",
        lg: "h-3 w-3",
      },
      pulse: {
        true: "animate-pulse",
        false: "",
      },
    },
    defaultVariants: {
      status: "unknown",
      size: "md",
      pulse: false,
    },
  }
);

export interface StatusIndicatorProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof statusIndicatorVariants> {
  pulse?: boolean;
  label?: string;
}

export function StatusIndicator({
  className,
  status,
  size,
  pulse = false,
  label,
  ...props
}: StatusIndicatorProps) {
  const statusLabels = {
    healthy: "Healthy",
    warning: "Warning",
    critical: "Critical",
    unknown: "Unknown",
    offline: "Offline",
  };

  const displayLabel = label || (status ? statusLabels[status] : "Unknown");

  return (
    <div
      className={cn(statusIndicatorVariants({ status, size }), className)}
      {...props}
    >
      <span
        className={cn(dotVariants({ status, size, pulse }))}
        aria-hidden="true"
      />
      <span>{displayLabel}</span>
    </div>
  );
}