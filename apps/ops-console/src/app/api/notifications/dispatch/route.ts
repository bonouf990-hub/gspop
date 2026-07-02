import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";

// Called every 15 minutes by the Supabase cron heartbeat (migration 0039).
// Sends email (Resend) and WhatsApp (Twilio) for notifications that haven't
// been delivered externally yet. Providers activate only when their env vars
// are present, so this endpoint is always safe to call.

type NotificationRow = {
  id: string;
  recipient_id: string;
  type: string;
  title: string | null;
  message: string;
  link: string | null;
  created_at: string;
};

const TYPE_SUBJECTS: Record<string, string> = {
  work_order_assigned: "New job assigned to you",
  work_order_completed: "Work order completed",
  rent_overdue: "Rent payment overdue",
  rent_cleared: "Rent payment received",
  lease_expiry_warning: "Lease expiring soon",
  visit_booked: "New visit request",
  visit_confirmed: "Your visit is confirmed",
  visit_cancelled: "Visit cancelled",
  notice_posted: "New building notice",
  complaint_status_update: "Update on your request",
};

async function sendEmail(to: string, subject: string, message: string, link: string | null) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;

  const from = process.env.NOTIFY_FROM_EMAIL ?? "GSPOP <onboarding@resend.dev>";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const cta = link && appUrl
    ? `<p style="margin-top:24px"><a href="${appUrl}${link}" style="background:#b8902f;color:#0f1626;font-weight:bold;padding:10px 24px;border-radius:8px;text-decoration:none">View details</a></p>`
    : "";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to,
      subject,
      html: `<div style="font-family:Arial,sans-serif;background:#0f1626;color:#f0ece4;padding:32px;border-radius:12px">
        <p style="color:#b8902f;font-size:11px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;margin:0 0 12px">Golden Sands</p>
        <h2 style="margin:0 0 16px;font-size:18px">${subject}</h2>
        <p style="color:#a0977e;line-height:1.6;margin:0">${message}</p>
        ${cta}
      </div>`,
    }),
  });
  return res.ok;
}

async function sendWhatsApp(phone: string, subject: string, message: string) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_WHATSAPP_FROM; // e.g. whatsapp:+14155238886
  if (!sid || !token || !fromNumber) return false;

  const to = `whatsapp:${phone.startsWith("+") ? phone : `+971${phone.replace(/^0/, "")}`}`;
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      From: fromNumber,
      To: to,
      Body: `*Golden Sands — ${subject}*\n\n${message}`,
    }),
  });
  return res.ok;
}

export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Only recent, undelivered notifications; cap the batch.
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: pending, error } = await supabase
    .from("notifications")
    .select("id, recipient_id, type, title, message, link, created_at")
    .is("dispatched_at", null)
    .gte("created_at", cutoff)
    .order("created_at", { ascending: true })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (pending ?? []) as NotificationRow[];
  if (rows.length === 0) {
    return NextResponse.json({ processed: 0, emailed: 0, whatsapped: 0 });
  }

  // Resolve recipient contact details once per user.
  const recipientIds = [...new Set(rows.map((r) => r.recipient_id))];
  const { data: profiles } = await supabase
    .from("user_profiles")
    .select("id, full_name, phone")
    .in("id", recipientIds);
  const phoneById = new Map((profiles ?? []).map((p) => [p.id as string, p.phone as string | null]));

  const emailById = new Map<string, string | null>();
  for (const id of recipientIds) {
    const { data } = await supabase.auth.admin.getUserById(id);
    emailById.set(id, data.user?.email ?? null);
  }

  let emailed = 0;
  let whatsapped = 0;

  for (const n of rows) {
    const subject = n.title ?? TYPE_SUBJECTS[n.type] ?? "New notification";
    const email = emailById.get(n.recipient_id);
    const phone = phoneById.get(n.recipient_id);

    if (email && (await sendEmail(email, subject, n.message, n.link).catch(() => false))) emailed++;
    if (phone && (await sendWhatsApp(phone, subject, n.message).catch(() => false))) whatsapped++;
  }

  // Mark the whole batch dispatched (even contacts without email/phone),
  // so nothing loops forever.
  await supabase
    .from("notifications")
    .update({ dispatched_at: new Date().toISOString() })
    .in("id", rows.map((r) => r.id));

  return NextResponse.json({ processed: rows.length, emailed, whatsapped });
}
