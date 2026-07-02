import type { ReactNode } from "react";

type IconType = React.ComponentType<{ size?: number | string; className?: string }>;

/**
 * PageHeader — the shared page-title lockup used across flagship surfaces.
 * Purely presentational: eyebrow + display title + description, an optional
 * dimensional icon chip, and a right-aligned actions slot. No data flow.
 */
export default function PageHeader({
  eyebrow,
  title,
  description,
  icon: Icon,
  actions,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  icon?: IconType;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="mb-8">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-4 min-w-0">
          {Icon && (
            <span className="icon-chip icon-chip-lg shrink-0 mt-0.5" aria-hidden="true">
              <Icon size={22} />
            </span>
          )}
          <div className="min-w-0">
            {eyebrow && <p className="eyebrow mb-1.5">{eyebrow}</p>}
            <h1 className="text-[#16233c]">{title}</h1>
            {description && (
              <p className="text-[#5b6b85] mt-1.5 max-w-2xl leading-relaxed">{description}</p>
            )}
            {children}
          </div>
        </div>
        {actions && <div className="flex gap-2 items-center flex-wrap shrink-0">{actions}</div>}
      </div>
      <div className="gold-rule mt-5 max-w-[7rem]" />
    </div>
  );
}
