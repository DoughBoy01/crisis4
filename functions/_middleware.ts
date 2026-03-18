import type { Env, JwtPayload } from './types';

export type { JwtPayload };

// Simple base64url encode/decode functions for JWT
function base64urlEncode(source: Uint8Array | ArrayBuffer | string): string {
  let encoded: string;
  if (typeof source === 'string') {
    encoded = btoa(source);
  } else {
    encoded = btoa(String.fromCharCode(...new Uint8Array(source)));
  }
  return encoded.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function base64urlDecode(encoded: string): string {
  const pad = encoded.length % 4;
  let b64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
  if (pad) {
    b64 += '='.repeat(4 - pad);
  }
  return atob(b64);
}

export async function verifyJwt(token: string, secret: string): Promise<JwtPayload | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [headerB64, payloadB64, signatureB64] = parts;

    // Verify signature
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const data = encoder.encode(`${headerB64}.${payloadB64}`);
    const signature = Uint8Array.from(atob(signatureB64.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));

    const isValid = await crypto.subtle.verify('HMAC', key, signature, data);
    if (!isValid) return null;

    // Parse payload
    const payloadStr = base64urlDecode(payloadB64);
    const payload = JSON.parse(payloadStr) as JwtPayload;

    // Check expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  } catch (error) {
    return null;
  }
}

export async function signJwt(payload: object, secret: string, expiresInSeconds = 86400): Promise<string> {
  const encoder = new TextEncoder();
  
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = base64urlEncode(JSON.stringify(header));
  
  const finalPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + expiresInSeconds
  };
  const encodedPayload = base64urlEncode(JSON.stringify(finalPayload));
  
  const datatoSign = encoder.encode(`${encodedHeader}.${encodedPayload}`);
  
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, datatoSign);
  const encodedSignature = base64urlEncode(signatureBuffer);
  
  return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env, next } = context;

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
      status: 204,
    });
  }

  // Skip auth for specific routes
  const url = new URL(request.url);
  const publicRoutes = [
    '/api/auth/login',
    '/api/feed_cache/trigger',  // RSS feed fetcher
    '/api/feed_cache/connect',  // WebSocket upgrade
  ];

  if (publicRoutes.includes(url.pathname)) {
    const response = await next();
    response.headers.set('Access-Control-Allow-Origin', '*');
    return response;
  }

  // Only validate auth for /api/* routes
  if (url.pathname.startsWith('/api/')) {
    // Check for token in Authorization header or Cookie
    let token = '';
      
    const authHeader = request.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else {
      const cookieHeader = request.headers.get('Cookie');
      if (cookieHeader) {
        const cookies = Object.fromEntries(
          cookieHeader.split('; ').map(c => {
            const parts = c.split('=');
            return [parts[0], parts.slice(1).join('=')];
          })
        );
        if (cookies['session_token']) {
           token = cookies['session_token'];
        }
      }
    }

    if (!token) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    const payload = await verifyJwt(token, env.JWT_SECRET);
    if (!payload) {
       return new Response(JSON.stringify({ error: 'Invalid or expired token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    // Attach user to context for downstream functions
    context.data.user = { id: payload.sub, role: payload.role };
  }

  const response = await next();
  
  // Add CORS headers to final response
  response.headers.set('Access-Control-Allow-Origin', '*');
  return response;
};
