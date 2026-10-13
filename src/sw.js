// Made by U2derscore //
const TENOR = 'https://tenor.com';
const CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_RESULTS = 50;
const cache = new Map();

var browserAPI = typeof browser !== 'undefined' ? browser : chrome;

browserAPI.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (sender.id !== browserAPI.runtime.id) return false;
  handle(msg).then(
    (result) => sendResponse({ ok: true, ...result }),
    (e) => sendResponse({ ok: false, error: String((e && e.message) || e) }),
  );
  return true;
});

async function handle(msg) {
  if (!msg || typeof msg !== 'object') throw new Error('Bad request.');
  if (msg.type === 'featured') return { gifs: await featured() };
  if (msg.type === 'search' && typeof msg.query === 'string') return { gifs: await search(msg.query) };
  if (msg.type === 'resolve' && typeof msg.input === 'string') return { gifs: await resolve(msg.input) };
  throw new Error('Bad request.');
}

async function fetchHtml(url) {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.time < CACHE_TTL_MS) return hit.value;
  const res = await fetch(url, { credentials: 'omit', redirect: 'follow' });
  if (!res.ok) throw new Error(res.status === 404 ? 'Tenor could not find that GIF.' : `Tenor returned HTTP ${res.status}.`);
  if (new URL(res.url).origin !== TENOR) throw new Error('Tenor redirected somewhere unexpected.');
  const html = await res.text();
  cache.set(url, { time: Date.now(), value: html });
  if (cache.size > 40) cache.delete(cache.keys().next().value);
  return html;
}

function tryJson(str) {
  try { return JSON.parse(str); } catch (e) { return null; }
}

function extractJsonBlocks(html) {
  const out = [];
  const re = /<script(?:[^>]*type=["'][^"']*(?:json|x-cache)[^"']*["'])?[^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const text = m[1].trim();
    if (text.startsWith('{') || text.startsWith('[')) {
      const data = tryJson(text);
      if (data) out.push(data);
    }
  }
  return out;
}

function metaAttr(html, prop) {
  for (const attr of ['property', 'name']) {
    const a = html.match(new RegExp(`<meta[^>]+${attr}=["']${prop}["'][^>]+content=["']([^"'<>]+)["']`, 'i'));
    const b = html.match(new RegExp(`<meta[^>]+content=["']([^"'<>]+)["'][^>]+${attr}=["']${prop}["']`, 'i'));
    const m = a || b;
    if (m) return m[1];
  }
  return null;
}

function toGif(r) {
  if (!r || !/^\d{1,20}$/.test(String(r.id)) || !r.media_formats) return null;
  const flags = r.flags || [];
  if (flags.includes('sticker') || flags.includes('static')) return null;
  const f = r.media_formats.tinygif || r.media_formats.tinywebp || r.media_formats.gif || r.media_formats.mediumgif || r.media_formats.nanogif;
  if (!f || typeof f.url !== 'string' || !/^https:\/\/[\w.-]*tenor\.com\//.test(f.url)) return null;
  const dims = Array.isArray(f.dims) ? f.dims : [];
  return {
    id: String(r.id),
    title: String(r.content_description || r.h1_title || r.title || 'GIF').slice(0, 200),
    preview: f.url,
    width: dims[0] || 220,
    height: dims[1] || 124,
  };
}

const toGifs = (results) => (results || []).map(toGif).filter(Boolean).slice(0, MAX_RESULTS);

function deepSearch(obj, depth = 0) {
  if (!obj || depth > 8 || typeof obj !== 'object') return [];
  if (Array.isArray(obj)) {
    const direct = toGifs(obj);
    if (direct.length) return direct;
    for (const item of obj.slice(0, 20)) {
      const found = deepSearch(item, depth + 1);
      if (found.length) return found;
    }
    return [];
  }
  if (obj.media_formats && obj.id) {
    const g = toGif(obj);
    return g ? [g] : [];
  }
  for (const key of ['results', 'gifs', 'items', 'data', 'featured', 'trending']) {
    if (obj[key]) {
      const found = deepSearch(obj[key], depth + 1);
      if (found.length) return found;
    }
  }
  for (const val of Object.values(obj).slice(0, 30)) {
    if (val && typeof val === 'object') {
      const found = deepSearch(val, depth + 1);
      if (found.length) return found;
    }
  }
  return [];
}

async function getGifs(url, mode) {
  const html = await fetchHtml(url);
  const blocks = extractJsonBlocks(html);

  for (const block of blocks) {
    let gifs = [];
    if (mode === 'featured') {
      gifs = toGifs(block?.gifs?.featured?.results)
        || deepSearch(block?.gifs?.featured)
        || deepSearch(block?.featured);
    } else if (mode === 'search') {
      const searches = Object.values((block?.universal?.search) || {});
      gifs = toGifs(searches[0]?.results);
      if (!gifs.length) gifs = deepSearch(block?.universal?.search || block?.search || block);
    } else {
      const entries = Object.values((block?.gifs?.byId) || {});
      gifs = toGifs(entries.flatMap((e) => e?.results || []).slice(0, 1));
      if (!gifs.length) gifs = deepSearch(block);
    }
    if (gifs.length) return gifs.slice(0, MAX_RESULTS);
  }

  if (mode === 'resolve') {
    const imgUrl = metaAttr(html, 'og:image');
    const title = (metaAttr(html, 'og:title') || metaAttr(html, 'title') || 'GIF')
      .replace(/ GIF.*$/i, '').trim();
    const w = parseInt(metaAttr(html, 'og:image:width') || '220');
    const h = parseInt(metaAttr(html, 'og:image:height') || '160');
    if (imgUrl && /^https:\/\/[\w.-]*tenor\.com\//.test(imgUrl)) {
      const idMatch = url.match(/(\d{10,20})(?:[^\d]|$)/);
      const id = idMatch ? idMatch[1] : String(Date.now());
      return [{ id, title, preview: imgUrl, width: w || 220, height: h || 160 }];
    }
    throw new Error('That link does not point at a GIF.');
  }

  throw new Error('Tenor changed its page format; search is unavailable.');
}

async function featured() {
  return getGifs(`${TENOR}/`, 'featured');
}

async function search(query) {
  const slug = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
    .map((w) => encodeURIComponent(w)).join('-');
  if (!slug) return featured();
  return getGifs(`${TENOR}/search/${slug}-gifs`, 'search');
}

async function resolve(input) {
  const text = input.trim();
  let pageUrl;
  if (/^\d{1,20}$/.test(text)) {
    pageUrl = `${TENOR}/view/x-gif-${text}`;
  } else {
    let url;
    try { url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`); } catch (e) { throw new Error('That is not a Tenor link.'); }
    if (/^media\d*\.tenor\.com$/.test(url.hostname)) {
      const mediaId = url.pathname.split('/').filter(Boolean).find((p) => /^[A-Za-z0-9_-]{16}$/.test(p));
      if (!mediaId) throw new Error('That is not a Tenor GIF link.');
      pageUrl = `${TENOR}/view/x-gif-${decodeMediaId(mediaId)}`;
    } else if (url.hostname === 'tenor.com' || url.hostname === 'www.tenor.com') {
      pageUrl = `${TENOR}${url.pathname}`;
    } else {
      throw new Error('That is not a Tenor link.');
    }
  }
  return getGifs(pageUrl, 'resolve');
}

function decodeMediaId(mediaId) {
  const bin = atob(mediaId.slice(0, 11).replace(/-/g, '+').replace(/_/g, '/') + '=');
  let n = 0n;
  for (let i = 0; i < 8; i++) n = (n << 8n) | BigInt(bin.charCodeAt(i));
  return n.toString();
}
