import { cx } from "../../utils/helpers";

interface BadgeProps {
  children: React.ReactNode;
  color?: string;
}

export function Badge({ children, color = "blue" }: BadgeProps) {
  const colorMap: Record<string, string> = {
    blue: "bg-blue-100 text-blue-700",
    green: "bg-emerald-100 text-emerald-700",
    purple: "bg-violet-100 text-violet-700",
    amber: "bg-amber-100 text-amber-700",
    red: "bg-rose-100 text-rose-700",
    gray: "bg-slate-100 text-slate-600",
  };

  return (
    <span
      className={cx(
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold",
        colorMap[color] ?? colorMap.blue
      )}
    >
      {children}
    </span>
  );
}
