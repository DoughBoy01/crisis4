import { useState, useEffect, useCallback, useRef } from "react";
import { getDailyBrief as fetchApiDailyBrief } from "@/lib/api";
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

// Note: AI brief generation is currently disabled in the Cloudflare Pages version
// The original Supabase Edge Function for ai-brief is not available
// For now, we only return cached briefs from the database
const BRIEF_API_URL = '/api/daily_brief';

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export function useDailyBrief(persona: PersonaId): DailyBriefState {
  const [brief, setBrief] = useState<DailyBrief | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cached, setCached] = useState(false);
  const generatingRef = useRef(false);

  useEffect(() => {
    async function checkCache() {
      setLoading(true);
      setBrief(null);
      try {
        const data = await fetchApiDailyBrief();

        if (data && data.brief_date === todayUtc() && data.persona === persona) {
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
    if (generatingRef.current) return;
    generatingRef.current = true;

    setGenerating(true);
    setError(null);

    try {
      // AI brief generation via OpenAI is not currently available in Cloudflare Pages deployment
      // This would require porting the Supabase Edge Function logic to a Cloudflare Worker
      // For now, we only return cached briefs from the database
      console.warn('[useDailyBrief] AI brief generation not available - database-only mode');

      const data = await fetchApiDailyBrief();
      if (data && data.brief_date === todayUtc() && data.persona === triggerPersona) {
        setBrief(data as DailyBrief);
        setCached(true);
      } else {
        setError('No cached brief available for today. AI generation not yet implemented.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGenerating(false);
      generatingRef.current = false;
    }
  }, []);

  return { brief, loading, generating, error, cached, trigger };
}
