// Critter Sounds on the web (sounds.crittervtt.com): serves the page that `node build.mjs --web` puts into ../web,
// and passes sounds and catalogues through /proxy?u=<address>, as the desktop app's app://music/remote does. The page
// routes every sound through Web Audio (effects, the stream to the table), which only works for sounds from its own
// address. Nothing is stored here; the page keeps your own sound files in your browser.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36 CritterSounds';
// the catalogues and search APIs the page reads (as main.js's CATALOG_HOSTS)
const TEXT_HOSTS = /^https:\/\/((www\.)?tabletopaudio\.com|incompetech\.com|api\.openverse\.org|freesound\.org)\//i;
const MIME = { mp3: 'audio/mpeg', ogg: 'audio/ogg', oga: 'audio/ogg', opus: 'audio/ogg', wav: 'audio/wav', flac: 'audio/flac', m4a: 'audio/mp4', aac: 'audio/aac', webm: 'audio/webm' };

async function proxy(req) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return new Response('GET only', { status: 405 });
  const u = new URL(req.url).searchParams.get('u') || '';
  let target; try { target = new URL(u); } catch { return new Response('Bad address', { status: 400 }); }
  if (!/^https?:$/.test(target.protocol) || /^(localhost|127\.|10\.|192\.168\.|169\.254\.|\[)/.test(target.hostname)) return new Response('Not allowed', { status: 403 });
  const text = TEXT_HOSTS.test(u), headers = { 'User-Agent': UA };
  const range = req.headers.get('range'); if (range) headers.Range = range;
  // a Freesound key goes to Freesound's own API, never anywhere else
  const auth = req.headers.get('authorization'); if (auth && /^https:\/\/freesound\.org\/apiv2\//i.test(u)) headers.Authorization = auth;
  let r; try { r = await fetch(target, { method: req.method, headers, redirect: 'follow' }); } catch { return new Response('Could not reach it', { status: 502 }); }
  let type = r.headers.get('content-type') || '';
  if (!type || /octet-stream/.test(type)) { const ext = (target.pathname.split('.').pop() || '').toLowerCase(); if (MIME[ext]) type = MIME[ext]; }
  // anything but sound and pictures only from the catalogues: this is no open proxy for web pages
  if (!text && !/^(audio\/|image\/|application\/ogg|video\/webm)/i.test(type)) return new Response('Only sound and pictures pass through here', { status: 415 });
  const h = new Headers({ 'content-type': type || 'application/octet-stream', 'cache-control': text ? 'no-store' : 'public, max-age=86400', 'x-content-type-options': 'nosniff' });
  for (const k of ['content-length', 'content-range', 'accept-ranges', 'x-ratelimit-available-anon_burst']) { const v = r.headers.get(k); if (v) h.set(k, v); }
  return new Response(r.body, { status: r.status, headers: h });
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === '/proxy') return proxy(req);
    const res = await env.ASSETS.fetch(req);
    // the page asks for the microphone-free things it needs and nothing else
    const h = new Headers(res.headers);
    h.set('permissions-policy', 'camera=(), microphone=(), geolocation=()');
    h.set('referrer-policy', 'no-referrer');
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
  }
};
