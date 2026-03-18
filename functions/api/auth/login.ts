import { signJwt } from '../../_middleware';
import bcrypt from 'bcryptjs';

interface Env {
  DB: D1Database;
  JWT_SECRET: string;
}

// Verify password using bcryptjs
async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(password, hash);
  } catch (err) {
    console.error('[login] Password verification error:', err);
    return false;
  }
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    console.log('[login] Starting login request');
    const body = await request.json() as any;
    const { email, password } = body;
    console.log('[login] Parsed body, email:', email);

    if (!email || !password) {
      return new Response(JSON.stringify({ error: 'Email and password required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log('[login] Querying database for user');
    // Query users table from D1
    const { results } = await env.DB.prepare(
      'SELECT id, email, password_hash, role, active FROM users WHERE email = ? AND active = 1'
    ).bind(email).all() as { results: Array<{ id: string; email: string; password_hash: string; role: string; active: number }> };

    console.log('[login] Query complete, found users:', results?.length || 0);

    if (!results || results.length === 0) {
      return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const user = results[0];
    console.log('[login] User found, verifying password');

    // Verify password against stored hash
    const isValid = await verifyPassword(password, user.password_hash);
    console.log('[login] Password verification result:', isValid);

    if (!isValid) {
      return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log('[login] Password valid, generating JWT');
    // Generate JWT token
    const token = await signJwt({ sub: user.id, role: user.role }, env.JWT_SECRET);
    console.log('[login] JWT generated successfully');

    return new Response(JSON.stringify({
      user: {
        id: user.id,
        email: user.email,
        role: user.role
      }
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': `session_token=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=86400`
      }
    });

  } catch (err) {
    console.error('[login] Error:', err);
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error('[login] Error message:', errorMessage);

    return new Response(JSON.stringify({
      error: 'Internal Server Error',
      details: errorMessage
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
