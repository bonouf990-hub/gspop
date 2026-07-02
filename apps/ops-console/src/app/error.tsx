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
    <main className="min-h-screen flex items-center justify-center bg-[#0f1626] text-[#f0ece4] px-6">
      <div className="w-full max-w-sm lux-card p-8 text-center">
        <p className="eyebrow mb-3">
          GSPOP
        </p>
        <h1 className="text-2xl font-extrabold mb-2">Something went wrong</h1>
        <p className="text-sm text-[#a0977e] mb-6">
          An unexpected error occurred. Try again, or head back home if the
          problem persists.
        </p>
        <button
          onClick={reset}
          className="w-full btn-gold p-3"
        >
          Try again
        </button>
        <Link
          href="/"
          className="block mt-4 text-xs text-[#a0977e] hover:text-[#f0ece4] transition-colors"
        >
          Back to home
        </Link>
      </div>
    </main>
  );
}
