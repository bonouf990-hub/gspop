"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "Home", icon: "⌂" },
  { href: "/gate", label: "Gate", icon: "⚿" },
  { href: "/complaints", label: "Requests", icon: "▤" },
  { href: "/rent", label: "Rent", icon: "◈" },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 px-4 pb-4 pt-2">
      <div className="glass-card mx-auto max-w-md rounded-2xl shadow-2xl shadow-black/40 flex items-center justify-around py-2">
        {NAV_ITEMS.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-colors"
            >
              <span
                className={`text-lg leading-none ${active ? "text-[var(--gold)]" : "text-[#8B94A8]"}`}
              >
                {item.icon}
              </span>
              <span
                className={`text-[10px] tracking-wide ${
                  active ? "text-[var(--gold-soft)] font-medium" : "text-[#6B7488]"
                }`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
