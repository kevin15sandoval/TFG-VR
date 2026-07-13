import { cx } from "../../utils/helpers";
import { AVATAR_COLORS } from "../../constants";

interface AvatarIconProps {
  initials: string;
  colorIdx?: number;
  size?: "sm" | "md" | "lg";
}

export function AvatarIcon({ initials, colorIdx = 0, size = "md" }: AvatarIconProps) {
  const sizes = {
    sm: "w-8 h-8 text-xs",
    md: "w-10 h-10 text-sm",
    lg: "w-12 h-12 text-base",
  };

  return (
    <div
      className={cx(
        "rounded-full flex items-center justify-center font-bold flex-shrink-0",
        sizes[size],
        AVATAR_COLORS[colorIdx % AVATAR_COLORS.length]
      )}
    >
      {initials}
    </div>
  );
}
