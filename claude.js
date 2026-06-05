/**
 * InAble — Anthropic API Proxy
 * Vercel Edge Function: /api/claude
 *
 * SETUP:
 *   1. Add this file to your repo at /api/claude.js
 *   2. In Vercel dashboard → Settings → Environment Variables, add:
 *        ANTHROPIC_API_KEY = sk-ant-...
 *   3. Deploy. The function is live at https://inable.app/api/claude
 *
 * The landing page and inable-watch.html should call /api/claude
 * instead of https://api.anthropic.com/v1/messages directly.
 *
 * Supports streaming (text/event-stream) — required for the demo's
 * real-time typewriter effect.
 */

export const config = { runtime: 'edge' };

const ALLOWED_ORIGINS = [
  'https://inable.app',
  'https://www.inable.app',
  'https://inable.aricciviclabs.org',
  'https://aricciviclabs.org',
  'http://localhost:3000',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
];

const MAX_TOKENS_CAP = 500;

export default async function handler(req) {
  const origin = req.headers.get('origin') || '';

  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders(origin),
    });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405, origin);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return json({ error: 'API key not configured' }, 500, origin);
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400, origin);
  }

  if (!body.messages || !Array.isArray(body.messages)) {
    return json({ error: 'messages array required' }, 400, origin);
  }

  // Enforce safe defaults
  body.model = 'claude-sonnet-4-20250514';
  body.max_tokens = Math.min(body.max_tokens || 300, MAX_TOKENS_CAP);

  // Forward to Anthropic
  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  // Stream or pass through
  const isStream = body.stream === true;
  if (isStream) {
    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        ...corsHeaders(origin),
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'X-Accel-Buffering': 'no',
      },
    });
  }

  const data = await upstream.json();
  return json(data, upstream.status, origin);
}

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
}

function json(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders(origin),
      'Content-Type': 'application/json',
    },
  });
}
