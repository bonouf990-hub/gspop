import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-[#0f1626] text-[#f0ece4] px-6">
      <div className="w-full max-w-sm bg-[#1a2640] border border-[rgba(184,144,47,0.15)] rounded-2xl p-8 text-center shadow-xl">
        <p className="text-xs text-[#b8902f] tracking-[0.3em] uppercase font-semibold mb-3">
          GSPOP
        </p>
        <h1 className="text-2xl font-extrabold mb-2">Page not found</h1>
        <p className="text-sm text-[#a0977e] mb-6">
          The page you are looking for does not exist or has been moved.
        </p>
        <Link
          href="/"
          className="block w-full bg-[#b8902f] text-[#0f1626] rounded-xl p-3 font-bold tracking-wide shadow-md"
        >
          Back to home
        </Link>
      </div>
    </main>
  );
}
