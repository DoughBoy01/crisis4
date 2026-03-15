import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import type { PersonaId } from "@/components/PersonaBar";
import type { FeedPayload } from "./useMarketFeeds";

export interface DailyBrief {
  id: string;
  brief_date: string;
  persona: string;
  generated_at: string;
  feed_snapshot_at: string | null;
  narrative: string;
  three_things: string[];
  action_rationale: Record<string, string>;
  geopolitical_context: string;
  procurement_actions: string[];
  market_outlook: string;
  sector_news_digest: Record<string, string[]>;
  sector_forward_outlook: Record<string, string>;
  compounding_risk: string;
  model: string;
  prompt_tokens: number | null;
  completion_tokens: number | null;
}

export interface DailyBriefState {
  brief: DailyBrief | null;
  loading: boolean;
  generating: boolean;
  error: string | null;
  cached: boolean;
  trigger: (feeds: FeedPayload, persona: PersonaId) => void;
}

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-brief`;
const HEADERS = {
  Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
  "Content-Type": "application/json",
};

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export function useDailyBrief(persona: PersonaId): DailyBriefState {
  const [brief, setBrief] = useState<DailyBrief | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cached, setCached] = useState(false);
  const prevPersonaRef = useRef<PersonaId | null>(null);

  useEffect(() => {
    async function checkCache() {
      setLoading(true);
      setBrief(null);
      try {
        const { data } = await supabase
          .from("daily_brief")
          .select("*")
          .eq("brief_date", todayUtc())
          .eq("persona", persona)
          .maybeSingle();

        if (data) {
          setBrief(data as DailyBrief);
          setCached(true);
        } else {
          setCached(false);
        }
      } catch {
        setCached(false);
      } finally {
        setLoading(false);
      }
    }
    checkCache();
  }, [persona]);

  const trigger = useCallback(async (feeds: FeedPayload, triggerPersona: PersonaId) => {
    if (prevPersonaRef.current === triggerPersona && brief) return;
    prevPersonaRef.current = triggerPersona;

    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(FUNCTION_URL, {
        method: "POST",
        headers: HEADERS,
        body: JSON.stringify({ feeds, persona: triggerPersona }),
      });
      if (!res.ok) throw new Error(`ai-brief returned ${res.status}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setBrief(json.brief as DailyBrief);
      setCached(json.cached === true);
    } catch (e) {
      setError(String(e));
    } finally {
      setGenerating(false);
    }
  }, [brief]);

  return { brief, loading, generating, error, cached, trigger };
}
