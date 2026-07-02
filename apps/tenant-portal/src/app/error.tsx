"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm elevated-card rounded-2xl p-8 text-center">
        <p className="text-[10px] tracking-[0.3em] uppercase text-[var(--gold)] font-medium mb-3">
          Golden Sands Residences
        </p>
        <h1 className="font-display text-2xl font-semibold text-[#eef1f6] mb-2">
          Something went wrong
        </h1>
        <p className="text-sm text-[var(--muted)] mb-6">
          An unexpected error occurred. Try again, or head back home if the
          problem persists.
        </p>
        <button
          onClick={reset}
          className="btn-gold w-full p-3 text-sm"
        >
          Try again
        </button>
        <Link
          href="/"
          className="block mt-4 text-xs text-[var(--muted)] hover:text-[#eef1f6] transition-colors"
        >
          Back to home
        </Link>
      </div>
    </main>
  );
}
