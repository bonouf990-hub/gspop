import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-[#f4f6fa] text-[#16233c] px-6">
      <div className="w-full max-w-sm lux-card p-8 text-center">
        <p className="eyebrow mb-3">
          GSPOP
        </p>
        <h1 className="text-2xl font-extrabold mb-2">Page not found</h1>
        <p className="text-sm text-[#5b6b85] mb-6">
          The page you are looking for does not exist or has been moved.
        </p>
        <Link
          href="/"
          className="block w-full btn-gold p-3"
        >
          Back to home
        </Link>
      </div>
    </main>
  );
}
