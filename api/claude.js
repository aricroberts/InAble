/**
 * InAble — Anthropic API Proxy
 * Vercel Serverless Function (Node.js runtime): /api/claude.js
 *
 * No vercel.json needed. Standard Node runtime, maximum compatibility.
 * Set ANTHROPIC_API_KEY in Vercel Environment Variables.
 */

const https = require('https');

const ALLOWED_ORIGINS = [
  'https://inable.app',
  'https://www.inable.app',
  'https://inable.aricciviclabs.org',
  'https://aricciviclabs.org',
  'http://localhost:3000',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
];

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
}

module.exports = async function handler(req, res) {
  const origin = req.headers['origin'] || '';
  const headers = corsHeaders(origin);

  // CORS preflight
  if (req.method === 'OPTIONS') {
    Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));
    return res.status(500).json({ error: 'API key not configured' });
  }

  const body = req.body;

  if (!body || !body.messages || !Array.isArray(body.messages)) {
    Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));
    return res.status(400).json({ error: 'messages array required' });
  }

  // Safe defaults
  body.model = 'claude-sonnet-4-5';
  body.max_tokens = Math.min(body.max_tokens || 300, 500);

  const bodyStr = JSON.stringify(body);
  const isStream = body.stream === true;

  Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));

  if (isStream) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('X-Accel-Buffering', 'no');
  } else {
    res.setHeader('Content-Type', 'application/json');
  }

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr),
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
    };

    const proxyReq = https.request(options, (proxyRes) => {
      res.status(proxyRes.statusCode);
      proxyRes.pipe(res, { end: true });
      proxyRes.on('end', resolve);
    });

    proxyReq.on('error', (err) => {
      console.error('[proxy error]', err.message);
      res.status(502).json({ error: 'Upstream API unreachable' });
      resolve();
    });

    proxyReq.write(bodyStr);
    proxyReq.end();
  });
};
