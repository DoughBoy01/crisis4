import bcrypt from 'bcryptjs';

interface Env {
  DB: D1Database;
}

interface User {
  id: string;
  role: string;
}

export const onRequestPost: PagesFunction<Env, any, { user: User }> = async ({ request, env, data }) => {
  try {
    const { password } = await request.json() as any;

    if (!password || password.length < 8) {
       return new Response(JSON.stringify({ error: 'Password must be at least 8 characters' }), { status: 400 });
    }

    const userId = data.user?.id;
    if (!userId) {
       return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    // Hash the password securely using bcryptjs
    const hashedPassword = await bcrypt.hash(password, 10);

    // Update password in D1 users table
    await env.DB.prepare('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .bind(hashedPassword, userId)
      .run();

    return new Response(JSON.stringify({ success: true }), { status: 200 });
  } catch (error) {
    console.error('[update_password] Error:', error);
    return new Response(JSON.stringify({ error: 'Failed to update password' }), { status: 500 });
  }
};
