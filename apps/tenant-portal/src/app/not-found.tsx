import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm elevated-card rounded-2xl p-8 text-center">
        <p className="text-[10px] tracking-[0.3em] uppercase text-[var(--gold)] font-medium mb-3">
          Golden Sands Residences
        </p>
        <h1 className="font-display text-2xl font-semibold text-[#eef1f6] mb-2">
          Page not found
        </h1>
        <p className="text-sm text-[var(--muted)] mb-6">
          The page you are looking for does not exist or has been moved.
        </p>
        <Link
          href="/"
          className="btn-gold block w-full p-3 text-sm"
        >
          Back to home
        </Link>
      </div>
    </main>
  );
}
