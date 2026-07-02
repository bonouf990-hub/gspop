import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";

// AI Resident Concierge — understands a maintenance issue described in any
// language, classifies it into the building's own complaint taxonomy, suggests
// a safe self-fix where one exists, and replies in the resident's language.
// A single stateless Claude call; the client creates the complaint on confirm.

type Category = { id: string; name: string };
type Subissue = { id: string; categoryId: string; name: string };

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    detected_language: { type: "string", description: "Language the resident wrote in, in English (e.g. Arabic, Hindi, English)." },
    reply_to_resident: { type: "string", description: "A short, warm reply in the resident's OWN language, confirming you understood." },
    summary_for_staff: { type: "string", description: "One or two clear sentences in English describing the problem, for the maintenance team." },
    category_id: { type: ["string", "null"], description: "The best-matching category id from the provided list, or null if none fit." },
    subissue_id: { type: ["string", "null"], description: "The best-matching sub-issue id under that category, or null." },
    priority: { type: "string", enum: ["low", "medium", "high", "emergency"] },
    self_fix: { type: ["string", "null"], description: "A safe, simple self-fix in the resident's language if one plausibly resolves it (e.g. reset the AC breaker), else null. Never suggest anything unsafe." },
    needs_technician: { type: "boolean" },
  },
  required: [
    "detected_language", "reply_to_resident", "summary_for_staff",
    "category_id", "subissue_id", "priority", "self_fix", "needs_technician",
  ],
} as const;

export async function POST(req: Request) {
  try {
    const { text, categories, subissues } = (await req.json()) as {
      text: string; categories: Category[]; subissues: Subissue[];
    };

    if (!text || text.trim().length < 3) {
      return NextResponse.json({ error: "Please describe the problem." }, { status: 400 });
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "The assistant is not configured yet." }, { status: 503 });
    }

    const taxonomy = (categories ?? [])
      .map((c) => {
        const subs = (subissues ?? []).filter((s) => s.categoryId === c.id);
        const subList = subs.map((s) => `    - ${s.name} [id:${s.id}]`).join("\n");
        return `- ${c.name} [id:${c.id}]\n${subList}`;
      })
      .join("\n");

    const system =
      "You are ARENCO Real Estate's resident help assistant for a residential building in Dubai. " +
      "Residents describe a maintenance problem in their own language (Arabic, Hindi, Urdu, Tagalog, English, etc.). " +
      "Understand the issue, then classify it using ONLY the category and sub-issue ids from the taxonomy provided — " +
      "return the exact id strings, never invent ids. If nothing fits, use null and set needs_technician true. " +
      "Set priority by real urgency: a gas smell, flooding, or no power in summer is emergency; a dripping tap is low. " +
      "Offer self_fix ONLY when it is genuinely safe and simple (e.g. 'your AC may have tripped — check the breaker labelled AC and switch it back on'); " +
      "never suggest touching gas, main electrical panels, or anything hazardous. Always write reply_to_resident and self_fix in the resident's own language.";

    const user =
      `TAXONOMY (category then its sub-issues):\n${taxonomy}\n\n` +
      `RESIDENT MESSAGE:\n${text.trim()}`;

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const msg = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 1024,
      thinking: { type: "disabled" }, // fast classification, no deliberation needed
      system,
      output_config: { format: { type: "json_schema", schema: SCHEMA } },
      messages: [{ role: "user", content: user }],
    });

    const block = msg.content.find((b) => b.type === "text");
    const raw = block && block.type === "text" ? block.text : "{}";
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    // Validate the ids actually exist in the taxonomy; drop anything invented.
    const catIds = new Set((categories ?? []).map((c) => c.id));
    const subIds = new Set((subissues ?? []).map((s) => s.id));
    let categoryId = typeof parsed.category_id === "string" && catIds.has(parsed.category_id) ? parsed.category_id : null;
    let subissueId = typeof parsed.subissue_id === "string" && subIds.has(parsed.subissue_id) ? parsed.subissue_id : null;
    // A sub-issue must belong to the chosen category.
    if (subissueId) {
      const sub = (subissues ?? []).find((s) => s.id === subissueId);
      if (!sub || (categoryId && sub.categoryId !== categoryId)) subissueId = null;
      else if (sub && !categoryId) categoryId = sub.categoryId;
    }

    return NextResponse.json({
      detectedLanguage: parsed.detected_language ?? null,
      replyToResident: parsed.reply_to_resident ?? "",
      summaryForStaff: parsed.summary_for_staff ?? text.trim(),
      categoryId,
      subissueId,
      priority: parsed.priority ?? "medium",
      selfFix: parsed.self_fix ?? null,
      needsTechnician: parsed.needs_technician ?? true,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "The assistant could not process that." },
      { status: 500 }
    );
  }
}
