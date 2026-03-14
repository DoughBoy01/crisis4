import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";

const SESSION_KEY = "clearbid_session_id";
const DEFAULT_TZ = "Europe/London";

function getOrCreateSessionId(): string {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export interface UserSettings {
  timezone: string;
}

export interface UserSettingsState {
  settings: UserSettings;
  loading: boolean;
  updateTimezone: (tz: string) => Promise<void>;
}

export function useUserSettings(): UserSettingsState {
  const [settings, setSettings] = useState<UserSettings>({ timezone: DEFAULT_TZ });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sessionId = getOrCreateSessionId();
    (async () => {
      try {
        const { data } = await supabase
          .from("user_settings")
          .select("timezone")
          .eq("session_id", sessionId)
          .maybeSingle();
        if (data?.timezone) {
          setSettings({ timezone: data.timezone });
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const updateTimezone = useCallback(async (tz: string) => {
    setSettings({ timezone: tz });
    const sessionId = getOrCreateSessionId();
    await supabase.from("user_settings").upsert(
      { session_id: sessionId, timezone: tz, updated_at: new Date().toISOString() },
      { onConflict: "session_id" }
    );
  }, []);

  return { settings, loading, updateTimezone };
}
