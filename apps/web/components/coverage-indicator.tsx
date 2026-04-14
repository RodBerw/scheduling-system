interface CoverageIndicatorProps {
  filled: number;
  required: number;
}

export function CoverageIndicator({ filled, required }: CoverageIndicatorProps) {
  if (required <= 0) return null;

  return (
    <div className="flex items-center justify-between mb-1 px-1">
      <span className={`text-[10px] font-medium ${filled >= required
          ? "text-emerald-600"
          : filled > 0
            ? "text-amber-600"
            : "text-red-400"
        }`}>
        {filled}/{required}
      </span>
      <div className="w-10 h-1 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${filled >= required
              ? "bg-emerald-500"
              : filled > 0
                ? "bg-amber-500"
                : "bg-red-300"
            }`}
          style={{
            width: `${Math.min(100, (filled / required) * 100)}%`,
          }}
        />
      </div>
    </div>
  );
}
