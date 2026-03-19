interface Env {
  DB: D1Database;
}

interface User {
  id: string;
  role: string;
}

export const onRequestGet: PagesFunction<Env, any, { user: User }> = async ({ env, data }) => {
  try {
    const sessionId = data.user?.id;
    if (!sessionId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { results } = await env.DB.prepare(
      'SELECT * FROM user_settings WHERE session_id = ?'
    )
      .bind(sessionId)
      .all();

    if (!results || results.length === 0) {
      return new Response(JSON.stringify({ error: 'Settings not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify(results[0]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to fetch user settings' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const onRequestPatch: PagesFunction<Env, any, { user: User }> = async ({ request, env, data }) => {
  try {
    const sessionId = data.user.id;
    const body = await request.json() as any;
    
    // Validate we only update allowed fields
    const { timezone } = body;
    
    if (timezone) {
      await env.DB.prepare(
        'UPDATE user_settings SET timezone = ?, updated_at = ? WHERE session_id = ?'
      )
        .bind(timezone, new Date().toISOString(), sessionId)
        .run();
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to update user settings' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
