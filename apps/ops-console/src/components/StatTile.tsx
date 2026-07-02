import type { ReactNode } from "react";

type IconType = React.ComponentType<{ size?: number | string; className?: string }>;

export type StatTone = "gold" | "navy" | "green" | "amber" | "red" | "muted";

const TONE_CLASS: Record<StatTone, string> = {
  gold: "",
  navy: "stat-tile-navy",
  green: "stat-tile-green",
  amber: "stat-tile-amber",
  red: "stat-tile-red",
  muted: "stat-tile-muted",
};

const CHIP_CLASS: Record<StatTone, string> = {
  gold: "icon-chip",
  navy: "icon-chip icon-chip-navy",
  green: "icon-chip icon-chip-neutral",
  amber: "icon-chip icon-chip-neutral",
  red: "icon-chip",
  muted: "icon-chip icon-chip-neutral",
};

const VALUE_COLOR: Partial<Record<StatTone, string>> = {
  green: "text-green-700",
  amber: "text-amber-700",
  red: "text-red-600",
};

/**
 * StatTile — the reusable KPI surface. Numbers render as clean, tabular sans
 * digits (never the display serif). Optional dimensional icon chip, tonal
 * accent bar, and a detail/trend line. Purely presentational.
 */
export default function StatTile({
  label,
  value,
  detail,
  detailColor,
  icon: Icon,
  tone = "gold",
  valueClassName,
  className = "",
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  detailColor?: string;
  icon?: IconType;
  tone?: StatTone;
  valueClassName?: string;
  className?: string;
}) {
  return (
    <div className={`stat-tile stat-tile-hover ${TONE_CLASS[tone]} p-4 pl-5 ${className}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-bold tracking-[0.16em] uppercase text-[#8b97ab]">{label}</p>
        {Icon && (
          <span className={`${CHIP_CLASS[tone]} !w-8 !h-8 !rounded-lg shrink-0`} aria-hidden="true">
            <Icon size={15} />
          </span>
        )}
      </div>
      <p className={`stat-value text-[2rem] mt-2 ${valueClassName ?? VALUE_COLOR[tone] ?? "text-[#16233c]"}`}>
        {value}
      </p>
      {detail && (
        <p className={`text-[11px] mt-1.5 ${detailColor ?? "text-[#8b97ab]"}`}>{detail}</p>
      )}
    </div>
  );
}
