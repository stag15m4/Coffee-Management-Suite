import React from "react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  tip?: string;
}

const accent = "var(--color-accent)";
const primary = "var(--color-primary)";
const secondary = "var(--color-secondary)";

export function EmptyState({ icon, title, description, action, secondaryAction, tip }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div
        className="flex items-center justify-center w-20 h-20 rounded-full mb-5"
        style={{ backgroundColor: accent, color: primary }}
      >
        {icon}
      </div>

      <h3 className="text-xl font-semibold mb-2" style={{ color: secondary }}>
        {title}
      </h3>

      <p className="text-sm max-w-sm mb-6" style={{ color: secondary, opacity: 0.7 }}>
        {description}
      </p>

      {action && (
        <Button onClick={action.onClick} className="mb-3" style={{ backgroundColor: primary, color: "#fff" }}>
          {action.label}
        </Button>
      )}

      {secondaryAction && (
        <button
          onClick={secondaryAction.onClick}
          className="text-sm mb-6 hover:underline bg-transparent border-none cursor-pointer"
          style={{ color: primary }}
        >
          {secondaryAction.label}
        </button>
      )}

      {tip && (
        <div
          className="text-xs rounded-lg px-4 py-2.5 max-w-sm"
          style={{ backgroundColor: "var(--color-accent-dark)" }}
        >
          <span className="mr-1.5">💡</span>{tip}
        </div>
      )}
    </div>
  );
}
