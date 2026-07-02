import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Liveness/readiness probe. Uses a plain anon-key client (no cookie context)
// so it works from load balancers and uptime monitors without a session.
export const dynamic = "force-dynamic";

const DB_TIMEOUT_MS = 5000;

export async function GET() {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } }
    );

    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`Database check timed out after ${DB_TIMEOUT_MS}ms`)),
        DB_TIMEOUT_MS
      );
    });

    const { error } = await Promise.race([
      supabase.from("tenants").select("id").limit(1),
      timeout,
    ]);
    if (error) throw new Error(error.message);

    return NextResponse.json({
      ok: true,
      db: "up",
      time: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        db: "down",
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 503 }
    );
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
