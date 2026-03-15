import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { TopicIntelligence } from '@/types';

export interface DismissedIntelRecord {
  id: string;
  type: 'scout_topic' | 'news_story';
  ref_id: string;
  ref_label: string;
  category: string | null;
  signal: string | null;
  reason: string | null;
  dismissed_by: string | null;
  dismissed_at: string;
  scouting_run_id: string | null;
}

interface UseDismissedIntelReturn {
  dismissed: DismissedIntelRecord[];
  loading: boolean;
  dismissTopic: (topic: TopicIntelligence, runId: string, reason?: string) => Promise<void>;
  undismiss: (id: string) => Promise<void>;
  isDismissed: (type: 'scout_topic' | 'news_story', refId: string) => boolean;
}

export function useDismissedIntel(): UseDismissedIntelReturn {
  const [dismissed, setDismissed] = useState<DismissedIntelRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('dismissed_intel')
        .select('*')
        .order('dismissed_at', { ascending: false });
      setDismissed((data as DismissedIntelRecord[]) ?? []);
      setLoading(false);
    })();
  }, []);

  const dismissTopic = useCallback(async (topic: TopicIntelligence, runId: string, reason?: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const record = {
      type: 'scout_topic' as const,
      ref_id: topic.topic_id,
      ref_label: topic.topic_label,
      category: topic.category,
      signal: topic.signal,
      reason: reason ?? null,
      dismissed_by: user.id,
      scouting_run_id: runId,
    };

    const { data, error } = await supabase
      .from('dismissed_intel')
      .insert(record)
      .select()
      .single();

    if (!error && data) {
      setDismissed(prev => [data as DismissedIntelRecord, ...prev]);
    }
  }, []);

  const undismiss = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('dismissed_intel')
      .delete()
      .eq('id', id);

    if (!error) {
      setDismissed(prev => prev.filter(d => d.id !== id));
    }
  }, []);

  const isDismissed = useCallback((type: 'scout_topic' | 'news_story', refId: string): boolean => {
    return dismissed.some(d => d.type === type && d.ref_id === refId);
  }, [dismissed]);

  return { dismissed, loading, dismissTopic, undismiss, isDismissed };
}
