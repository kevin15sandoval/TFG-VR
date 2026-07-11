import { cx } from "../../utils/helpers";

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export function Card({ children, className }: CardProps) {
  return (
    <div
      className={cx(
        "bg-white rounded-xl border border-slate-100 shadow-sm",
        className
      )}
    >
      {children}
    </div>
  );
}
