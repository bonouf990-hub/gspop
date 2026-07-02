"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, KeyRound, ClipboardList, CreditCard } from "lucide-react";

const NAV_ITEMS = [
  { href: "/", label: "Home", Icon: Home },
  { href: "/gate", label: "Gate", Icon: KeyRound },
  { href: "/complaints", label: "Requests", Icon: ClipboardList },
  { href: "/rent", label: "Rent", Icon: CreditCard },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 px-4 pb-5 pt-2">
      <div className="elevated-card mx-auto max-w-md rounded-[28px] flex items-center justify-around py-2.5">
        {NAV_ITEMS.map(({ href, label, Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link key={href} href={href} className="flex flex-col items-center gap-1 px-4 py-1">
              <Icon
                size={20}
                strokeWidth={active ? 2.4 : 1.8}
                className={active ? "text-[var(--gold)]" : "text-[#5b6b85]"}
              />
              <span
                className={`text-[10px] tracking-wide ${
                  active ? "text-[#16233c] font-semibold" : "text-[#5b6b85]"
                }`}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
