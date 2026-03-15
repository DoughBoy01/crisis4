import { useCallback, useState } from 'react';
import { supabase } from '@/lib/supabase';

const DELETE_STORY_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-story`;

interface UseDeleteStoryReturn {
  deleteStory: (title: string) => Promise<boolean>;
  deleting: boolean;
}

export function useDeleteStory(): UseDeleteStoryReturn {
  const [deleting, setDeleting] = useState(false);

  const deleteStory = useCallback(async (title: string): Promise<boolean> => {
    setDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return false;

      const res = await fetch(DELETE_STORY_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ title }),
      });

      const json = await res.json();
      return res.ok && json.success === true;
    } catch {
      return false;
    } finally {
      setDeleting(false);
    }
  }, []);

  return { deleteStory, deleting };
}
