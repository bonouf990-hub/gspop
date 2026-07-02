"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";

type Requirement = {
  id: string;
  category: string;
  title: string;
  is_mandatory: boolean;
  weight: number;
};

type SubmissionResponse = {
  requirement_id: string;
  response: string | null;
  document_url: string | null;
};

type Submission = {
  id: string;
  vendor_name: string;
  proposed_amount: number;
  proposed_timeline_days: number | null;
  cover_letter: string | null;
  technical_approach: string | null;
  status: string;
};

function analyzeSubmission(
  sub: Submission,
  responses: SubmissionResponse[],
  requirements: Requirement[],
  allSubmissions: Submission[],
  budgetEstimate: number | null
) {
  const responseMap = new Map(responses.map((r) => [r.requirement_id, r]));
  const totalWeight = requirements.reduce((s, r) => s + r.weight, 0);

  let weightedScore = 0;
  const missingItems: string[] = [];
  const strengths: string[] = [];
  const weaknesses: string[] = [];

  for (const req of requirements) {
    const resp = responseMap.get(req.id);
    const hasResponse = resp && (resp.response?.trim() || resp.document_url);

    if (!hasResponse) {
      if (req.is_mandatory) {
        missingItems.push(`${req.title} (MANDATORY — not addressed)`);
      } else {
        missingItems.push(`${req.title} (optional — not addressed)`);
        weightedScore += (req.weight / totalWeight) * 20;
      }
    } else {
      const responseLength = (resp?.response?.length ?? 0) + (resp?.document_url ? 50 : 0);
      let reqScore: number;

      if (responseLength > 200) {
        reqScore = 90;
        strengths.push(`Thorough response for ${req.title}`);
      } else if (responseLength > 50) {
        reqScore = 70;
      } else {
        reqScore = 45;
        weaknesses.push(`Brief/incomplete response for ${req.title}`);
      }

      if (resp?.document_url) {
        reqScore = Math.min(100, reqScore + 10);
      }

      weightedScore += (req.weight / totalWeight) * reqScore;
    }
  }

  const amounts = allSubmissions.map((s) => Number(s.proposed_amount));
  const minAmount = Math.min(...amounts);
  const maxAmount = Math.max(...amounts);
  const amount = Number(sub.proposed_amount);

  let priceScore = 70;
  if (amounts.length > 1 && maxAmount > minAmount) {
    priceScore = 100 - ((amount - minAmount) / (maxAmount - minAmount)) * 60;
  }

  if (budgetEstimate && amount <= budgetEstimate) {
    priceScore = Math.min(100, priceScore + 10);
    strengths.push(`Within budget estimate (${((amount / budgetEstimate) * 100).toFixed(0)}% of budget)`);
  } else if (budgetEstimate && amount > budgetEstimate) {
    priceScore = Math.max(0, priceScore - 15);
    weaknesses.push(`Exceeds budget by ${(((amount - budgetEstimate) / budgetEstimate) * 100).toFixed(0)}%`);
  }

  if (amount === minAmount && amounts.length > 1) {
    strengths.push("Most competitive pricing");
  }

  let completenessBonus = 0;
  if (sub.cover_letter && sub.cover_letter.length > 100) completenessBonus += 3;
  if (sub.technical_approach && sub.technical_approach.length > 100) {
    completenessBonus += 5;
    strengths.push("Detailed technical approach provided");
  }

  if (sub.proposed_timeline_days) {
    const timelines = allSubmissions
      .filter((s) => s.proposed_timeline_days)
      .map((s) => s.proposed_timeline_days!);
    if (timelines.length > 0) {
      const fastest = Math.min(...timelines);
      if (sub.proposed_timeline_days === fastest && timelines.length > 1) {
        strengths.push("Fastest proposed timeline");
        completenessBonus += 3;
      }
    }
  }

  const mandatoryMissing = requirements
    .filter((r) => r.is_mandatory)
    .filter((r) => !responseMap.get(r.id)?.response?.trim() && !responseMap.get(r.id)?.document_url);

  let mandatoryPenalty = 0;
  if (mandatoryMissing.length > 0) {
    mandatoryPenalty = mandatoryMissing.length * 15;
    weaknesses.push(`Missing ${mandatoryMissing.length} mandatory requirement${mandatoryMissing.length > 1 ? "s" : ""}`);
  }

  const requirementWeight = 0.6;
  const priceWeight = 0.3;
  const completenessWeight = 0.1;

  let finalScore =
    weightedScore * requirementWeight +
    priceScore * priceWeight +
    (completenessBonus / 11) * 100 * completenessWeight -
    mandatoryPenalty;

  finalScore = Math.max(0, Math.min(100, finalScore));

  let summary = `${sub.vendor_name} submitted a bid of AED ${Number(sub.proposed_amount).toLocaleString()}`;
  if (sub.proposed_timeline_days) {
    summary += ` with a ${sub.proposed_timeline_days}-day timeline`;
  }
  summary += `. `;

  if (mandatoryMissing.length === 0 && missingItems.length === 0) {
    summary += "All requirements fully addressed. ";
  } else if (mandatoryMissing.length > 0) {
    summary += `Submission is missing ${mandatoryMissing.length} mandatory requirement${mandatoryMissing.length > 1 ? "s" : ""}, which significantly impacts eligibility. `;
  }

  if (finalScore >= 80) {
    summary += "Strong overall submission with competitive positioning.";
  } else if (finalScore >= 60) {
    summary += "Adequate submission but has areas for improvement.";
  } else if (finalScore >= 40) {
    summary += "Below average submission — review carefully before shortlisting.";
  } else {
    summary += "Weak submission — significant gaps in requirements compliance.";
  }

  return {
    score: Math.round(finalScore * 100) / 100,
    summary,
    missingItems: missingItems.length > 0 ? missingItems.join("\n") : null,
    strengths: strengths.length > 0 ? strengths.join("\n") : null,
    weaknesses: weaknesses.length > 0 ? weaknesses.join("\n") : null,
    meetsRequirements: new Map(
      requirements.map((req) => {
        const resp = responseMap.get(req.id);
        const has = !!(resp && (resp.response?.trim() || resp.document_url));
        return [req.id, has];
      })
    ),
  };
}

export default function AnalyzeTender({ tenderId }: { tenderId: string }) {
  const router = useRouter();
  const [analyzing, setAnalyzing] = useState(false);

  async function runAnalysis() {
    setAnalyzing(true);
    const supabase = createClient();

    const [{ data: tender }, { data: requirements }, { data: submissions }] = await Promise.all([
      supabase.from("tenders").select("budget_estimate").eq("id", tenderId).single(),
      supabase
        .from("tender_requirements")
        .select("id, category, title, is_mandatory, weight")
        .eq("tender_id", tenderId)
        .order("sort_order"),
      supabase
        .from("tender_submissions")
        .select("id, vendor_name, proposed_amount, proposed_timeline_days, cover_letter, technical_approach, status")
        .eq("tender_id", tenderId),
    ]);

    const reqs = (requirements ?? []) as Requirement[];
    const subs = (submissions ?? []) as Submission[];

    const submissionIds = subs.map((s) => s.id);
    let allResponses: (SubmissionResponse & { submission_id: string })[] = [];
    if (submissionIds.length > 0) {
      const { data: responses } = await supabase
        .from("tender_submission_responses")
        .select("submission_id, requirement_id, response, document_url")
        .in("submission_id", submissionIds);
      allResponses = (responses ?? []) as (SubmissionResponse & { submission_id: string })[];
    }

    for (const sub of subs) {
      const subResponses = allResponses.filter((r) => r.submission_id === sub.id);
      const analysis = analyzeSubmission(
        sub,
        subResponses,
        reqs,
        subs,
        tender?.budget_estimate ? Number(tender.budget_estimate) : null
      );

      await supabase
        .from("tender_submissions")
        .update({
          ai_score: analysis.score,
          ai_summary: analysis.summary,
          ai_missing_items: analysis.missingItems,
          ai_strengths: analysis.strengths,
          ai_weaknesses: analysis.weaknesses,
        })
        .eq("id", sub.id);

      for (const [reqId, meets] of analysis.meetsRequirements) {
        await supabase
          .from("tender_submission_responses")
          .update({ meets_requirement: meets })
          .eq("submission_id", sub.id)
          .eq("requirement_id", reqId);
      }
    }

    const sorted = subs
      .map((s) => {
        const subResponses = allResponses.filter((r) => r.submission_id === s.id);
        const analysis = analyzeSubmission(s, subResponses, reqs, subs, tender?.budget_estimate ? Number(tender.budget_estimate) : null);
        return { ...s, score: analysis.score };
      })
      .sort((a, b) => b.score - a.score);

    if (sorted.length > 0) {
      const winner = sorted[0];
      const runnerUp = sorted[1];

      let reason = `AI EXECUTIVE SUMMARY\n\n`;
      reason += `Winner: ${winner.vendor_name}\n`;
      reason += `Score: ${winner.score.toFixed(1)}/100\n`;
      reason += `Bid Amount: AED ${Number(winner.proposed_amount).toLocaleString()}\n\n`;
      reason += `RECOMMENDATION RATIONALE:\n`;
      reason += `${winner.vendor_name} achieved the highest composite score based on weighted evaluation of technical requirements (60%), pricing competitiveness (30%), and submission completeness (10%).\n\n`;

      if (runnerUp) {
        reason += `Runner-up: ${runnerUp.vendor_name} (Score: ${runnerUp.score.toFixed(1)}/100, Bid: AED ${Number(runnerUp.proposed_amount).toLocaleString()})\n`;
        const scoreDiff = winner.score - runnerUp.score;
        if (scoreDiff > 15) {
          reason += `The winning submission leads by a significant margin of ${scoreDiff.toFixed(1)} points.\n`;
        } else {
          reason += `The margin between top submissions is ${scoreDiff.toFixed(1)} points — purchasing team should review both closely.\n`;
        }
      }

      reason += `\nAll ${sorted.length} submissions were evaluated against ${reqs.length} requirements. `;
      const mandatoryCount = reqs.filter((r) => r.is_mandatory).length;
      if (mandatoryCount > 0) {
        reason += `${mandatoryCount} mandatory criteria were checked for compliance.`;
      }

      await supabase
        .from("tenders")
        .update({
          status: "evaluating",
          decided_reason: reason,
        })
        .eq("id", tenderId);
    }

    setAnalyzing(false);
    router.refresh();
  }

  return (
    <button
      onClick={runAnalysis}
      disabled={analyzing}
      className="text-xs font-bold px-4 py-2 rounded-lg bg-[#b8902f] text-[#0f1626] disabled:opacity-50"
    >
      {analyzing ? "Analyzing…" : "Run AI Analysis"}
    </button>
  );
}
