import { cx } from "../../utils/helpers";

interface ProgressBarProps {
  value: number;
  colorClass?: string;
}

export function ProgressBar({
  value,
  colorClass = "bg-emerald-500",
}: ProgressBarProps) {
  return (
    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
      <div
        className={cx(
          "h-full rounded-full transition-all duration-700",
          colorClass
        )}
        style={{ width: `${Math.min(value, 100)}%` }}
      />
    </div>
  );
}
