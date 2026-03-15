import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

type PersonaId = "general" | "trader" | "agri" | "logistics" | "analyst";

interface TopDecision {
  signal: "BUY" | "HOLD" | "ACT" | "WATCH";
  headline: string;
  deadline: string;
  market: string;
  gbp_impact: string;
  rationale: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
}

interface PriceSnapshotEntry {
  label: string;
  price: number;
  change_pct: number | null;
  currency: string;
}

interface DailyBrief {
  id: string;
  brief_date: string;
  generated_at: string;
  feed_snapshot_at: string | null;
  narrative: string;
  three_things: string[];
  action_rationale: Record<string, string>;
  geopolitical_context: string;
  procurement_actions: string[];
  market_outlook: string;
  sector_news_digest: Record<string, string[]> | null;
  sector_forward_outlook: Record<string, string> | null;
  compounding_risk: string | null;
  top_decision: TopDecision | null;
  model: string;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  price_snapshot: PriceSnapshotEntry[] | null;
}

interface EmailSubscription {
  id: string;
  email: string;
  name: string;
  active: boolean;
  send_hour_utc: number;
  last_sent_at: string | null;
  unsubscribe_token: string;
  persona: PersonaId;
}

const SIGNAL_CONFIG: Record<TopDecision["signal"], {
  bg: string;
  border: string;
  badgeBg: string;
  badgeText: string;
  label: string;
  icon: string;
}> = {
  BUY: {
    bg: "#052e16",
    border: "#16a34a",
    badgeBg: "#16a34a",
    badgeText: "#ffffff",
    label: "BUY",
    icon: "&#9650;",
  },
  ACT: {
    bg: "#1c0a0a",
    border: "#dc2626",
    badgeBg: "#dc2626",
    badgeText: "#ffffff",
    label: "ACT NOW",
    icon: "&#9888;",
  },
  WATCH: {
    bg: "#0c1a2e",
    border: "#f59e0b",
    badgeBg: "#f59e0b",
    badgeText: "#0f172a",
    label: "WATCH",
    icon: "&#9679;",
  },
  HOLD: {
    bg: "#0f172a",
    border: "#334155",
    badgeBg: "#334155",
    badgeText: "#94a3b8",
    label: "HOLD",
    icon: "&#8212;",
  },
};

const CONFIDENCE_LABEL: Record<TopDecision["confidence"], string> = {
  HIGH: "HIGH CONFIDENCE",
  MEDIUM: "MEDIUM CONFIDENCE",
  LOW: "LOW CONFIDENCE — WATCH CLOSELY",
};

const PERSONA_META: Record<PersonaId, {
  label: string;
  accentColor: string;
  accentDark: string;
  headerBg: string;
  borderColor: string;
  focusLabel: string;
  focusDesc: string;
  sectors: string[];
}> = {
  general: {
    label: "Business Overview",
    accentColor: "#0ea5e9",
    accentDark: "#0284c7",
    headerBg: "#0c1929",
    borderColor: "#1e3a5f",
    focusLabel: "What This Means for Your Business",
    focusDesc: "Key impacts on UK operating costs and supply chains today.",
    sectors: ["energy", "fx", "freight"],
  },
  trader: {
    label: "Commodity Trader",
    accentColor: "#f87171",
    accentDark: "#dc2626",
    headerBg: "#1c0a0a",
    borderColor: "#7f1d1d",
    focusLabel: "Trader Focus — Price Signals & Crisis Context",
    focusDesc: "Energy, FX, and metals attribution. Review before the 07:00 standup.",
    sectors: ["energy", "fx", "metals"],
  },
  agri: {
    label: "Agri Buyer",
    accentColor: "#34d399",
    accentDark: "#059669",
    headerBg: "#052e16",
    borderColor: "#14532d",
    focusLabel: "Agri Buyer Focus — Grain, Fertilizer & Black Sea",
    focusDesc: "Wheat, fertilizer input costs, and supply corridor status.",
    sectors: ["agricultural", "fertilizer", "energy"],
  },
  logistics: {
    label: "Logistics Director",
    accentColor: "#38bdf8",
    accentDark: "#0284c7",
    headerBg: "#0c1a2e",
    borderColor: "#0c4a6e",
    focusLabel: "Logistics Focus — Shipping Lanes & Bunker Costs",
    focusDesc: "Red Sea status, rerouting signals, and freight rate context.",
    sectors: ["freight", "energy", "policy"],
  },
  analyst: {
    label: "Risk Analyst",
    accentColor: "#fbbf24",
    accentDark: "#d97706",
    headerBg: "#1c1207",
    borderColor: "#78350f",
    focusLabel: "Risk Analyst Focus — Full Sector Intelligence",
    focusDesc: "All monitored sectors with citable context for client reporting.",
    sectors: ["energy", "agricultural", "freight", "fertilizer", "metals", "fx", "policy"],
  },
};

const SECTOR_LABELS: Record<string, string> = {
  energy: "Energy",
  agricultural: "Agricultural / Grain",
  freight: "Freight & Shipping",
  fertilizer: "Fertilizers",
  metals: "Metals",
  fx: "FX / GBP",
  policy: "Policy / Macro",
};

const PERSONA_PRICE_GROUPS: Record<PersonaId, string[]> = {
  general:   ["Brent Crude Oil (ICE)", "WTI Crude Oil", "Natural Gas (NYMEX)", "GBP/USD", "GBP/EUR"],
  trader:    ["Brent Crude Oil (ICE)", "WTI Crude Oil", "Natural Gas (NYMEX)", "GBP/USD", "GBP/EUR", "EUR/USD", "Gold", "Silver", "Copper", "US Dollar Index"],
  agri:      ["Wheat (CBOT)", "Corn (CBOT)", "Soybeans (CBOT)", "Rough Rice (CBOT)", "Brent Crude Oil (ICE)", "Natural Gas (NYMEX)", "GBP/USD"],
  logistics: ["Baltic Dry Index", "Brent Crude Oil (ICE)", "Heating Oil (NYMEX)", "RBOB Gasoline", "GBP/USD", "GBP/EUR"],
  analyst:   [],
};

function formatPrice(price: number, currency: string): string {
  if (["USX"].includes(currency)) return `${(price / 100).toFixed(2)}`;
  if (currency === "GBp") return `${price.toFixed(0)}p`;
  if (currency === "pts") return `${price.toFixed(0)}`;
  if (price > 1000) return price.toFixed(0);
  if (price > 100) return price.toFixed(2);
  return price.toFixed(4);
}

function changeBadge(pct: number | null): string {
  if (pct == null) return `<span style="color:#64748b;font-size:12px;">—</span>`;
  const abs = Math.abs(pct);
  const formatted = `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`;
  if (pct > 0.5) return `<span style="color:#34d399;font-size:12px;font-weight:700;">${formatted}</span>`;
  if (pct < -0.5) return `<span style="color:#f87171;font-size:12px;font-weight:700;">${formatted}</span>`;
  if (abs > 0) return `<span style="color:#94a3b8;font-size:12px;">${formatted}</span>`;
  return `<span style="color:#64748b;font-size:12px;">0.00%</span>`;
}

function arrowIcon(pct: number | null): string {
  if (pct == null || pct === 0) return `<span style="color:#475569;">&#8212;</span>`;
  if (pct > 0) return `<span style="color:#34d399;">&#9650;</span>`;
  return `<span style="color:#f87171;">&#9660;</span>`;
}

function buildDecisionBlock(decision: TopDecision, accentColor: string): string {
  const cfg = SIGNAL_CONFIG[decision.signal] ?? SIGNAL_CONFIG.WATCH;
  const confidenceText = CONFIDENCE_LABEL[decision.confidence] ?? "MEDIUM CONFIDENCE";
  const isHold = decision.signal === "HOLD";

  return `
    <tr>
      <td style="padding:0 0 0 0;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:${cfg.bg};border:2px solid ${cfg.border};border-radius:8px;overflow:hidden;">

          <!-- Decision label bar -->
          <tr>
            <td style="background:${cfg.badgeBg};padding:8px 20px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="font-size:11px;font-weight:800;color:${cfg.badgeText};letter-spacing:0.14em;text-transform:uppercase;">
                      ${cfg.icon}&nbsp;&nbsp;TODAY'S PROCUREMENT DECISION &mdash; ${cfg.label}
                    </span>
                  </td>
                  <td align="right">
                    <span style="font-size:10px;font-weight:700;color:${isHold ? "#64748b" : cfg.badgeText};letter-spacing:0.1em;opacity:0.85;">${confidenceText}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Headline -->
          <tr>
            <td style="padding:20px 20px 4px;">
              <p style="margin:0;font-size:22px;font-weight:800;color:#f1f5f9;line-height:1.25;letter-spacing:-0.02em;">${decision.headline}</p>
            </td>
          </tr>

          <!-- Market + Deadline -->
          <tr>
            <td style="padding:8px 20px 14px;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding-right:16px;">
                    <span style="font-size:10px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:0.1em;">Market</span><br />
                    <span style="font-size:13px;font-weight:600;color:#cbd5e1;">${decision.market}</span>
                  </td>
                  <td style="padding-right:16px;border-left:1px solid #1e293b;padding-left:16px;">
                    <span style="font-size:10px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:0.1em;">Act by</span><br />
                    <span style="font-size:13px;font-weight:700;color:${isHold ? "#475569" : cfg.border};">${decision.deadline}</span>
                  </td>
                  ${decision.gbp_impact ? `
                  <td style="border-left:1px solid #1e293b;padding-left:16px;">
                    <span style="font-size:10px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:0.1em;">£ Exposure</span><br />
                    <span style="font-size:13px;font-weight:700;color:${isHold ? "#475569" : "#fbbf24"};">${decision.gbp_impact}</span>
                  </td>` : ""}
                </tr>
              </table>
            </td>
          </tr>

          <!-- Rationale -->
          ${decision.rationale ? `
          <tr>
            <td style="padding:0 20px 18px;">
              <div style="border-top:1px solid #1e293b;padding-top:12px;">
                <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.65;">${decision.rationale}</p>
              </div>
            </td>
          </tr>` : ""}

        </table>
      </td>
    </tr>`;
}

function buildCompoundingRiskBlock(risk: string, accentColor: string): string {
  return `
    <tr>
      <td style="padding:0;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#1c0a00;border:1px solid #dc2626;border-radius:6px;overflow:hidden;">
          <tr>
            <td style="padding:5px 16px;background:#dc2626;">
              <span style="font-size:10px;font-weight:800;color:#fff;letter-spacing:0.12em;text-transform:uppercase;">&#9888;&nbsp; COMPOUNDING COST ALERT</span>
            </td>
          </tr>
          <tr>
            <td style="padding:12px 16px;">
              <p style="margin:0;font-size:13px;color:#fca5a5;line-height:1.65;">${risk}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;
}

function buildPriceTable(snapshot: PriceSnapshotEntry[], persona: PersonaId): string {
  if (!snapshot || snapshot.length === 0) return "";

  const allowed = PERSONA_PRICE_GROUPS[persona];
  const rows = snapshot.filter(p =>
    allowed.length === 0 || allowed.some(a => p.label.includes(a) || a.includes(p.label))
  );

  if (rows.length === 0) return "";

  const rowHtml = rows.map((p, i) => {
    const bg = i % 2 === 0 ? "#0f172a" : "#111827";
    const currencyLabel = ["USD", "USX"].includes(p.currency) ? "USD" : p.currency;
    return `
      <tr style="background:${bg};">
        <td style="padding:9px 16px;font-size:13px;color:#cbd5e1;border-bottom:1px solid #1e293b;">${p.label}</td>
        <td style="padding:9px 16px;font-size:13px;color:#f1f5f9;font-weight:600;text-align:right;border-bottom:1px solid #1e293b;font-variant-numeric:tabular-nums;">${formatPrice(p.price, p.currency)} <span style="font-size:10px;color:#475569;font-weight:400;">${currencyLabel}</span></td>
        <td style="padding:9px 16px;text-align:right;border-bottom:1px solid #1e293b;">${arrowIcon(p.change_pct)} ${changeBadge(p.change_pct)}</td>
      </tr>`;
  }).join("");

  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #1e293b;border-radius:8px;overflow:hidden;">
      <thead>
        <tr style="background:#1e293b;">
          <th style="padding:8px 16px;font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.1em;text-align:left;border-bottom:1px solid #334155;">Instrument</th>
          <th style="padding:8px 16px;font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.1em;text-align:right;border-bottom:1px solid #334155;">Last Price</th>
          <th style="padding:8px 16px;font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.1em;text-align:right;border-bottom:1px solid #334155;">vs Prev Close</th>
        </tr>
      </thead>
      <tbody>
        ${rowHtml}
      </tbody>
    </table>`;
}

const SECTOR_ICONS: Record<string, string> = {
  energy: "&#9889;",
  agricultural: "&#127806;",
  freight: "&#9875;",
  fertilizer: "&#127807;",
  metals: "&#9874;",
  fx: "&#163;",
  policy: "&#127963;",
};

function parseSourceTag(headline: string): { source: string; text: string } {
  const m = /^\[([^\]]+)\]\s*(.*)$/.exec(headline);
  if (m) return { source: m[1], text: m[2] };
  return { source: "", text: headline };
}

function buildSectorRows(brief: DailyBrief, sectors: string[], accentColor: string): string {
  const rationale = brief.action_rationale ?? {};
  const digest = brief.sector_news_digest ?? {};
  const outlook = brief.sector_forward_outlook ?? {};

  const rows = sectors
    .filter(k => rationale[k] && rationale[k].length > 5)
    .map((k, idx) => {
      const headlines = (digest[k] ?? []).filter(h => h.length > 0);
      const forwardText = outlook[k] ?? "";
      const isLast = idx === sectors.filter(s => rationale[s] && rationale[s].length > 5).length - 1;
      const icon = SECTOR_ICONS[k] ?? "&#8226;";

      const headlinesHtml = headlines.length > 0
        ? `<div style="margin-top:12px;">
            ${headlines.map(h => {
              const { source, text } = parseSourceTag(h);
              return `<table cellpadding="0" cellspacing="0" style="margin-bottom:6px;width:100%;">
                <tr>
                  <td style="vertical-align:top;padding-right:8px;white-space:nowrap;">
                    ${source ? `<span style="display:inline-block;background:#0f172a;border:1px solid #1e293b;color:#475569;font-size:9px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;padding:2px 6px;border-radius:3px;white-space:nowrap;">${source.replace(" RSS", "").replace(" Business", "")}</span>` : ""}
                  </td>
                  <td style="font-size:12px;color:#64748b;line-height:1.5;font-style:italic;">${text}</td>
                </tr>
              </table>`;
            }).join("")}
          </div>`
        : "";

      const forwardHtml = forwardText && forwardText.length > 5
        ? `<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;">
            <tr>
              <td style="background:#060f1f;border:1px solid #1e3a5f;border-left:3px solid ${accentColor};border-radius:4px;padding:8px 12px;">
                <span style="font-size:10px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:0.08em;">2-5 Day Outlook</span>
                <p style="margin:4px 0 0;font-size:12px;color:#93c5fd;line-height:1.6;">${forwardText}</p>
              </td>
            </tr>
          </table>`
        : "";

      return `
      <tr>
        <td colspan="2" style="padding:0;${isLast ? "" : "border-bottom:1px solid #1e293b;"}">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding:16px 16px 4px;vertical-align:top;width:124px;">
                <span style="font-size:16px;line-height:1;">${icon}</span>
                <p style="margin:4px 0 0;font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;">${SECTOR_LABELS[k] ?? k}</p>
              </td>
              <td style="padding:16px 16px 16px 0;vertical-align:top;">
                <p style="margin:0;font-size:13px;color:#cbd5e1;line-height:1.7;">${rationale[k]}</p>
                ${headlinesHtml}
                ${forwardHtml}
              </td>
            </tr>
          </table>
        </td>
      </tr>`;
    })
    .join("");
  return rows;
}

function buildHtmlEmail(
  brief: DailyBrief,
  recipientName: string,
  unsubscribeToken: string,
  supabaseUrl: string,
  persona: PersonaId,
  appUrl: string,
): string {
  const dateStr = new Date(brief.brief_date).toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
  });
  const timeStr = brief.generated_at
    ? new Date(brief.generated_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) + " UTC"
    : "07:00 UTC";

  const unsubscribeUrl = `${supabaseUrl}/functions/v1/send-morning-brief?unsubscribe=${unsubscribeToken}`;
  const meta = PERSONA_META[persona] ?? PERSONA_META.general;
  const greeting = recipientName ? `Hi ${recipientName},` : "Good morning,";

  const priceTable = buildPriceTable(brief.price_snapshot ?? [], persona);
  const sectorRows = buildSectorRows(brief, meta.sectors, meta.accentColor);

  const decisionBlock = brief.top_decision
    ? buildDecisionBlock(brief.top_decision, meta.accentColor)
    : "";

  const compoundingBlock = brief.compounding_risk && brief.compounding_risk.length > 10
    ? buildCompoundingRiskBlock(brief.compounding_risk, meta.accentColor)
    : "";

  const threeThingsBlocks = (brief.three_things ?? []).map((thing, i) => {
    const isObj = thing && typeof thing === "object" && !Array.isArray(thing);
    const title = isObj ? (thing as Record<string, string>).title ?? "" : "";
    const body = isObj ? (thing as Record<string, string>).body ?? String(thing) : String(thing);
    const isLast = i === (brief.three_things ?? []).length - 1;
    return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:${isLast ? "0" : "10px"};">
      <tr>
        <td style="vertical-align:top;width:40px;padding-top:2px;">
          <span style="display:inline-block;width:28px;height:28px;background:${meta.accentColor};color:#0f172a;font-size:13px;font-weight:800;border-radius:50%;text-align:center;line-height:28px;">${i + 1}</span>
        </td>
        <td style="vertical-align:top;background:#060f1f;border:1px solid #1e293b;border-left:3px solid ${meta.accentColor};border-radius:6px;padding:12px 16px;">
          ${title ? `<p style="margin:0 0 6px;font-size:14px;font-weight:700;color:#f1f5f9;line-height:1.3;">${title}</p>` : ""}
          <p style="margin:0;font-size:13px;color:#94a3b8;line-height:1.7;">${body}</p>
        </td>
      </tr>
    </table>`;
  }).join("");

  const personaTagHtml = persona !== "general"
    ? `<span style="display:inline-block;background:${meta.accentColor};color:#0f172a;font-size:10px;font-weight:700;letter-spacing:0.07em;text-transform:uppercase;padding:3px 9px;border-radius:20px;margin-left:10px;vertical-align:middle;">${meta.label}</span>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Morning Brief — ${dateStr}</title>
</head>
<body style="margin:0;padding:0;background:#060d1a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',sans-serif;">

<table width="100%" cellpadding="0" cellspacing="0" style="background:#060d1a;padding:24px 16px 40px;">
  <tr>
    <td align="center">
      <table width="620" cellpadding="0" cellspacing="0" style="max-width:620px;width:100%;">

        <!-- Top accent bar -->
        <tr>
          <td style="background:linear-gradient(90deg,${meta.accentColor},${meta.accentDark});height:3px;border-radius:4px 4px 0 0;"></td>
        </tr>

        <!-- Header -->
        <tr>
          <td style="background:${meta.headerBg};border:1px solid ${meta.borderColor};border-top:none;border-bottom:none;padding:24px 32px 16px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td valign="middle">
                  <p style="margin:0 0 3px;font-size:10px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:0.14em;">DawnSignal &middot; Procurement Intelligence</p>
                  <h1 style="margin:0;font-size:22px;font-weight:800;color:#f1f5f9;letter-spacing:-0.02em;line-height:1.2;">Morning Brief${personaTagHtml}</h1>
                  <p style="margin:5px 0 0;font-size:12px;color:#64748b;">${dateStr} &middot; Generated ${timeStr}</p>
                </td>
                <td align="right" valign="top" style="padding-left:16px;white-space:nowrap;">
                  <span style="display:inline-block;background:#0ea5e9;color:#fff;font-size:9px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;padding:4px 10px;border-radius:20px;">LIVE DATA</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        ${decisionBlock ? `
        <!-- TODAY'S DECISION — hero block -->
        <tr>
          <td style="background:${meta.headerBg};border-left:1px solid ${meta.borderColor};border-right:1px solid ${meta.borderColor};padding:0 24px 20px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              ${decisionBlock}
            </table>
          </td>
        </tr>` : ""}

        ${compoundingBlock ? `
        <!-- Compounding Risk Alert -->
        <tr>
          <td style="background:#0d1627;border-left:1px solid ${meta.borderColor};border-right:1px solid ${meta.borderColor};border-top:1px solid #1e293b;padding:0 24px 16px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              ${compoundingBlock}
            </table>
          </td>
        </tr>` : ""}

        <!-- Divider -->
        <tr><td style="background:${meta.headerBg};border-left:1px solid ${meta.borderColor};border-right:1px solid ${meta.borderColor};padding:0 32px;">
          <div style="border-top:1px solid ${meta.borderColor};"></div>
        </td></tr>

        <!-- Greeting + Narrative -->
        <tr>
          <td style="background:#0d1627;border-left:1px solid ${meta.borderColor};border-right:1px solid ${meta.borderColor};padding:24px 32px 20px;">
            <p style="margin:0 0 14px;font-size:13px;color:#64748b;">${greeting}</p>
            <p style="margin:0;font-size:15px;font-weight:500;color:#e2e8f0;line-height:1.75;">${brief.narrative}</p>
          </td>
        </tr>

        ${brief.geopolitical_context ? `
        <!-- Geopolitical Context -->
        <tr>
          <td style="background:#0d1627;border-left:1px solid ${meta.borderColor};border-right:1px solid ${meta.borderColor};padding:0 32px 20px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#0c1a0a;border:1px solid #1e3b1e;border-left:3px solid #ef4444;border-radius:6px;overflow:hidden;">
              <tr>
                <td style="padding:6px 14px;background:#1a0a0a;border-bottom:1px solid #2d1515;">
                  <span style="font-size:9px;font-weight:800;color:#ef4444;letter-spacing:0.14em;text-transform:uppercase;">&#9679;&nbsp; Geopolitical Risk Context</span>
                </td>
              </tr>
              <tr>
                <td style="padding:12px 14px;">
                  <p style="margin:0;font-size:13px;color:#fca5a5;line-height:1.7;">${brief.geopolitical_context}</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>` : ""}

        ${priceTable ? `
        <!-- Price Snapshot -->
        <tr>
          <td style="background:#0d1627;border-left:1px solid ${meta.borderColor};border-right:1px solid ${meta.borderColor};padding:0 32px 24px;">
            <p style="margin:0 0 10px;font-size:10px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:0.12em;">Overnight Price Snapshot</p>
            ${priceTable}
          </td>
        </tr>` : ""}

        ${threeThingsBlocks ? `
        <!-- 3 Things -->
        <tr>
          <td style="background:#0a111e;border-left:1px solid ${meta.borderColor};border-right:1px solid ${meta.borderColor};border-top:1px solid #1e293b;padding:22px 32px 24px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:14px;">
              <tr>
                <td>
                  <span style="font-size:10px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:0.12em;">3 Things That Matter Today</span>
                </td>
                <td align="right">
                  <span style="font-size:9px;font-weight:700;color:${meta.accentColor};text-transform:uppercase;letter-spacing:0.1em;">For your role specifically</span>
                </td>
              </tr>
            </table>
            ${threeThingsBlocks}
          </td>
        </tr>` : ""}

        ${sectorRows ? `
        <!-- Sector Intelligence -->
        <tr>
          <td style="background:#0d1627;border-left:1px solid ${meta.borderColor};border-right:1px solid ${meta.borderColor};border-top:1px solid #1e293b;padding:22px 32px 24px;">
            <p style="margin:0 0 3px;font-size:10px;font-weight:700;color:${meta.accentColor};text-transform:uppercase;letter-spacing:0.12em;">${meta.focusLabel}</p>
            <p style="margin:0 0 16px;font-size:12px;color:#475569;">${meta.focusDesc}</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #1e293b;border-radius:8px;overflow:hidden;">
              ${sectorRows}
            </table>
          </td>
        </tr>` : ""}

        ${(brief.procurement_actions ?? []).length > 0 ? `
        <!-- Procurement Actions -->
        <tr>
          <td style="background:#0a111e;border-left:1px solid ${meta.borderColor};border-right:1px solid ${meta.borderColor};border-top:1px solid #1e293b;padding:22px 32px 24px;">
            <p style="margin:0 0 16px;font-size:10px;font-weight:700;color:${meta.accentColor};text-transform:uppercase;letter-spacing:0.12em;">Recommended Actions</p>
            ${(brief.procurement_actions ?? []).map((action, i) => {
              const upper = action.toUpperCase();
              let badgeBg = "#1e293b"; let badgeColor = "#64748b"; let badgeLabel = `${i + 1}`;
              if (upper.includes("BUY") || upper.includes("PURCHASE") || upper.includes("LOCK IN") || upper.includes("CONTRACT")) {
                badgeBg = "#052e16"; badgeColor = "#34d399"; badgeLabel = "BUY";
              } else if (upper.includes("MONITOR") || upper.includes("WATCH") || upper.includes("TRACK")) {
                badgeBg = "#172554"; badgeColor = "#60a5fa"; badgeLabel = "WATCH";
              } else if (upper.includes("HEDGE") || upper.includes("FORWARD") || upper.includes("FIX")) {
                badgeBg = "#1c1207"; badgeColor = "#fbbf24"; badgeLabel = "HEDGE";
              } else if (upper.includes("ALERT") || upper.includes("ACT") || upper.includes("URGENT") || upper.includes("REVIEW")) {
                badgeBg = "#1c0a0a"; badgeColor = "#f87171"; badgeLabel = "ACT";
              }
              return `<table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:${i < (brief.procurement_actions ?? []).length - 1 ? "10px" : "0"};">
                <tr>
                  <td style="vertical-align:top;padding-right:10px;white-space:nowrap;width:52px;">
                    <span style="display:inline-block;background:${badgeBg};border:1px solid ${badgeColor};color:${badgeColor};font-size:9px;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;padding:3px 7px;border-radius:4px;">${badgeLabel}</span>
                  </td>
                  <td style="vertical-align:top;font-size:13px;color:#cbd5e1;line-height:1.7;">${action}</td>
                </tr>
              </table>`;
            }).join("")}
          </td>
        </tr>` : ""}

        ${brief.market_outlook ? `
        <!-- Market Outlook -->
        <tr>
          <td style="background:#0d1627;border-left:1px solid ${meta.borderColor};border-right:1px solid ${meta.borderColor};border-top:1px solid #1e293b;padding:22px 32px 24px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;">
              <tr>
                <td>
                  <span style="font-size:10px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:0.12em;">What to Watch Today</span>
                  <span style="font-size:10px;color:#334155;margin-left:8px;">07:00 &ndash; 17:00 GMT</span>
                </td>
                <td align="right">
                  <span style="display:inline-block;background:#0c1a2e;border:1px solid #f59e0b;color:#f59e0b;font-size:9px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;padding:3px 8px;border-radius:3px;">&#9679; LIVE SESSION</span>
                </td>
              </tr>
            </table>
            <p style="margin:0;font-size:13px;color:#94a3b8;line-height:1.75;">${brief.market_outlook}</p>
          </td>
        </tr>` : ""}

        <!-- CTA -->
        <tr>
          <td style="background:#0a111e;border-left:1px solid ${meta.borderColor};border-right:1px solid ${meta.borderColor};border-top:1px solid #1e293b;padding:20px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <p style="margin:0 0 10px;font-size:12px;color:#475569;">For live signals, conflict maps, shipping lane status, and full market data:</p>
                  <a href="${appUrl}" style="display:inline-block;background:transparent;border:1px solid ${meta.accentColor};color:${meta.accentColor};font-size:12px;font-weight:700;text-decoration:none;padding:9px 20px;border-radius:6px;letter-spacing:-0.01em;">Open Live Dashboard &rarr;</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Disclaimer -->
        <tr>
          <td style="background:#060d1a;border-left:1px solid ${meta.borderColor};border-right:1px solid ${meta.borderColor};border-top:1px solid #1e293b;padding:14px 32px;">
            <p style="margin:0;font-size:11px;color:#334155;line-height:1.65;">
              <strong style="color:#475569;font-weight:600;">For information only.</strong> This brief is AI-generated market intelligence intended to support your own procurement judgement &mdash; not financial, legal, or trading advice. Signals, prices, and cost estimates may contain errors or omissions. Always verify with your own sources and advisors before acting. DawnSignal accepts no liability for decisions made in reliance on this content.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#060d1a;border:1px solid ${meta.borderColor};border-top:none;border-radius:0 0 6px 6px;padding:14px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <p style="margin:0;font-size:11px;color:#334155;line-height:1.6;">
                    DawnSignal Procurement Intelligence &middot; ${meta.label}
                    ${brief.model && brief.model !== "none" ? ` &middot; AI: ${brief.model}` : ""}
                  </p>
                </td>
                <td align="right" style="white-space:nowrap;">
                  <a href="${unsubscribeUrl}" style="font-size:11px;color:#334155;text-decoration:underline;">Unsubscribe</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>

</body>
</html>`;
}

function buildTextEmail(brief: DailyBrief, recipientName: string, persona: PersonaId): string {
  const dateStr = new Date(brief.brief_date).toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
  });

  const meta = PERSONA_META[persona] ?? PERSONA_META.general;
  const lines: string[] = [];
  lines.push(`DAWNSIGNAL MORNING BRIEF — ${meta.label.toUpperCase()}`);
  lines.push(dateStr);
  lines.push("=".repeat(56));
  lines.push("");

  if (brief.top_decision) {
    const d = brief.top_decision;
    lines.push(`TODAY'S DECISION: ${d.signal}`);
    lines.push("-".repeat(40));
    lines.push(d.headline);
    lines.push(`Market: ${d.market}`);
    lines.push(`Act by: ${d.deadline}`);
    if (d.gbp_impact) lines.push(`£ Exposure: ${d.gbp_impact}`);
    if (d.rationale) lines.push(`Why: ${d.rationale}`);
    lines.push(`Confidence: ${d.confidence}`);
    lines.push("");
  }

  if (brief.compounding_risk && brief.compounding_risk.length > 10) {
    lines.push("*** COMPOUNDING COST ALERT ***");
    lines.push(brief.compounding_risk);
    lines.push("");
  }

  lines.push(recipientName ? `Hi ${recipientName},` : "Good morning,");
  lines.push("");
  lines.push(brief.narrative);
  if (brief.geopolitical_context) {
    lines.push("");
    lines.push(brief.geopolitical_context);
  }

  const snapshot = brief.price_snapshot ?? [];
  const allowed = PERSONA_PRICE_GROUPS[persona];
  const priceRows = snapshot.filter(p =>
    allowed.length === 0 || allowed.some(a => p.label.includes(a) || a.includes(p.label))
  );
  if (priceRows.length > 0) {
    lines.push("");
    lines.push("OVERNIGHT PRICE SNAPSHOT");
    lines.push("-".repeat(40));
    for (const p of priceRows) {
      const chg = p.change_pct != null ? ` (${p.change_pct >= 0 ? "+" : ""}${p.change_pct.toFixed(2)}%)` : "";
      lines.push(`${p.label}: ${formatPrice(p.price, p.currency)} ${p.currency}${chg}`);
    }
  }

  if ((brief.three_things ?? []).length > 0) {
    lines.push("");
    lines.push("3 THINGS THAT MATTER TODAY");
    lines.push("-".repeat(40));
    (brief.three_things ?? []).forEach((t, i) => {
      const isObj = t && typeof t === "object" && !Array.isArray(t);
      const title = isObj ? (t as Record<string, string>).title ?? "" : "";
      const body = isObj ? (t as Record<string, string>).body ?? String(t) : String(t);
      lines.push(`${i + 1}. ${title ? title + " — " : ""}${body}`);
    });
  }

  const rationale = brief.action_rationale ?? {};
  const digest = brief.sector_news_digest ?? {};
  const outlook = brief.sector_forward_outlook ?? {};
  const relevantRows = meta.sectors
    .filter(k => rationale[k] && rationale[k].length > 5)
    .map(k => {
      let entry = `${(SECTOR_LABELS[k] ?? k).toUpperCase()}: ${rationale[k]}`;
      const headlines = (digest[k] ?? []).filter(h => h.length > 0);
      if (headlines.length > 0) entry += `\nSources: ${headlines.join(" | ")}`;
      if (outlook[k]) entry += `\nOutlook: ${outlook[k]}`;
      return entry;
    });

  if (relevantRows.length > 0) {
    lines.push("");
    lines.push(meta.focusLabel.toUpperCase());
    lines.push("-".repeat(40));
    relevantRows.forEach(r => { lines.push(r); lines.push(""); });
  }

  const actions = brief.procurement_actions ?? [];
  if (actions.length > 0) {
    lines.push("");
    lines.push("SUPPORTING ACTIONS");
    lines.push("-".repeat(40));
    actions.forEach((a, i) => { lines.push(`${i + 1}. ${a}`); lines.push(""); });
  }

  if (brief.market_outlook) {
    lines.push("");
    lines.push("WHAT TO WATCH TODAY (07:00–17:00 GMT)");
    lines.push("-".repeat(40));
    lines.push(brief.market_outlook);
  }

  lines.push("=".repeat(56));
  lines.push("DawnSignal Procurement Intelligence");
  return lines.join("\n");
}

function buildPersonaSubjectLine(brief: DailyBrief, persona: PersonaId, dateStr: string): string {
  const personaTags: Record<PersonaId, string> = {
    general: "",
    trader: " · Trader",
    agri: " · Agri Buyer",
    logistics: " · Logistics",
    analyst: " · Risk Analyst",
  };

  if (brief.top_decision) {
    const d = brief.top_decision;
    const signalEmoji: Record<string, string> = {
      BUY: "[BUY]",
      ACT: "[ACT NOW]",
      WATCH: "[WATCH]",
      HOLD: "[HOLD]",
    };
    const tag = signalEmoji[d.signal] ?? "[WATCH]";
    const shortHeadline = d.headline.length > 50 ? d.headline.slice(0, 47) + "..." : d.headline;
    return `${tag} ${shortHeadline}${personaTags[persona]} — DawnSignal`;
  }

  return `Morning Brief — ${dateStr}${personaTags[persona]}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendKey = Deno.env.get("RESEND_API_KEY");
    const appUrl = Deno.env.get("APP_URL") ?? "https://dawnsignal.io";

    const db = createClient(supabaseUrl, serviceKey);

    const url = new URL(req.url);
    const unsubscribeToken = url.searchParams.get("unsubscribe");

    if (unsubscribeToken) {
      await db
        .from("email_subscriptions")
        .update({ active: false })
        .eq("unsubscribe_token", unsubscribeToken);
      return new Response(
        `<!DOCTYPE html><html><body style="font-family:-apple-system,sans-serif;background:#060d1a;color:#f1f5f9;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;">
          <div style="text-align:center;max-width:400px;padding:40px 24px;">
            <div style="width:48px;height:48px;background:#1e293b;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 20px;font-size:22px;">&#10003;</div>
            <h1 style="font-size:22px;margin:0 0 10px;font-weight:700;">Unsubscribed</h1>
            <p style="color:#64748b;font-size:14px;line-height:1.6;">You have been removed from the DawnSignal Morning Brief.</p>
          </div>
        </body></html>`,
        { status: 200, headers: { "Content-Type": "text/html" } },
      );
    }

    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));

      if (body.action === "preview") {
        const brief = body.brief as DailyBrief | null;
        const previewPersona: PersonaId = (["general", "trader", "agri", "logistics", "analyst"].includes(body.persona)
          ? body.persona : "general") as PersonaId;
        if (!brief) {
          return new Response(JSON.stringify({ error: "No brief provided for preview" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const html = buildHtmlEmail(brief, "Preview Subscriber", "preview-token", supabaseUrl, previewPersona, appUrl);
        return new Response(JSON.stringify({ html }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (body.action === "subscribe") {
        const email = (body.email ?? "").toLowerCase().trim();
        const name = (body.name ?? "").trim();
        const persona: PersonaId = (["general", "trader", "agri", "logistics", "analyst"].includes(body.persona)
          ? body.persona
          : "general") as PersonaId;

        if (!email || !email.includes("@")) {
          return new Response(JSON.stringify({ error: "Invalid email address" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data: existing } = await db
          .from("email_subscriptions")
          .select("id, active")
          .eq("email", email)
          .maybeSingle();

        if (existing) {
          if (!existing.active) {
            await db.from("email_subscriptions").update({ active: true, name, persona }).eq("email", email);
            return new Response(JSON.stringify({ success: true, message: "Resubscribed successfully" }), {
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
          await db.from("email_subscriptions").update({ persona }).eq("email", email);
          return new Response(JSON.stringify({ success: true, message: "Already subscribed — persona preference updated" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { error: insertErr } = await db.from("email_subscriptions").insert({ email, name, persona });
        if (insertErr) throw new Error(`Subscribe error: ${insertErr.message}`);

        return new Response(JSON.stringify({ success: true, message: "Subscribed successfully" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (body.action === "send_now" || !body.action) {
        if (!resendKey) throw new Error("RESEND_API_KEY not configured");

        const todayUtc = new Date().toISOString().slice(0, 10);

        const { data: subscribers, error: subErr } = await db
          .from("email_subscriptions")
          .select("id, email, name, unsubscribe_token, persona")
          .eq("active", true);

        if (subErr) throw new Error(`Subscribers fetch error: ${subErr.message}`);
        if (!subscribers || subscribers.length === 0) {
          return new Response(JSON.stringify({ sent: 0, message: "No active subscribers" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const dateStr = new Date(todayUtc).toLocaleDateString("en-GB", {
          weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
        });

        let sent = 0;
        let failed = 0;
        const errors: string[] = [];

        for (const sub of subscribers as EmailSubscription[]) {
          try {
            const persona: PersonaId = (sub.persona as PersonaId) ?? "general";

            const { data: personaBriefData, error: pbErr } = await db
              .from("daily_brief")
              .select("*")
              .eq("brief_date", todayUtc)
              .eq("persona", persona)
              .maybeSingle();

            if (pbErr || !personaBriefData) {
              errors.push(`${sub.email}: No brief found for persona '${persona}' on ${todayUtc}`);
              failed++;
              continue;
            }
            const personaBrief = personaBriefData as DailyBrief;

            const html = buildHtmlEmail(personaBrief, sub.name, sub.unsubscribe_token, supabaseUrl, persona, appUrl);
            const text = buildTextEmail(personaBrief, sub.name, persona);
            const subject = buildPersonaSubjectLine(personaBrief, persona, dateStr);

            const resendRes = await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${resendKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                from: "DawnSignal <onboarding@resend.dev>",
                to: [sub.email],
                subject,
                html,
                text,
              }),
            });

            if (!resendRes.ok) {
              const errText = await resendRes.text();
              throw new Error(`Resend ${resendRes.status}: ${errText}`);
            }

            await db.from("email_subscriptions").update({ last_sent_at: new Date().toISOString() }).eq("id", sub.id);
            sent++;
          } catch (e) {
            failed++;
            errors.push(`${sub.email}: ${String(e)}`);
          }
        }

        return new Response(
          JSON.stringify({ sent, failed, errors: errors.length > 0 ? errors : undefined }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
