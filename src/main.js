// Made by U2derscore //
(() => {
  const WATCHED_URL = /\/youtubei\/v1\/(comment|backstage)\//;
  const CREATE_URL = /\/youtubei\/v1\/(comment|backstage)\/create/;
  const MARKER = /\[\[gif:(\d{1,20}):([a-z0-9]{8,32})\]\]/;
  const ARM_TTL_MS = 3 * 60 * 1000;
  const armed = new Map();

  const toContent = (msg) => window.postMessage({ gcfy: 'to-content', ...msg }, location.origin);

  window.addEventListener('message', (e) => {
    if (e.source !== window || e.origin !== location.origin) return;
    const msg = e.data;
    if (!msg || msg.gcfy !== 'to-main') return;
    if (msg.type === 'arm' && /^\d{1,20}$/.test(msg.id) && /^[a-z0-9]{8,32}$/.test(msg.nonce)) {
      armed.set(msg.nonce, { id: msg.id, expires: Date.now() + ARM_TTL_MS });
      toContent({ type: 'armed', nonce: msg.nonce });
    } else if (msg.type === 'disarm') {
      armed.delete(msg.nonce);
    }
  });

  async function readBody(input, init) {
    const isRequest = input instanceof Request;
    const headers = new Headers(isRequest ? input.headers : (init && init.headers) || {});
    let buf;
    if (isRequest) buf = await input.clone().arrayBuffer();
    else if (init && init.body != null) buf = await new Response(init.body).arrayBuffer();
    else return null;
    const text = headers.get('content-encoding') === 'gzip'
      ? await new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).text()
      : new TextDecoder().decode(buf);
    return { headers, text };
  }

  function findMarker(obj, marker, path) {
    if (!obj || typeof obj !== 'object') return null;
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      const p = path ? path + '.' + key : key;
      if (typeof val === 'string' && val.includes(marker)) return { path: p, key, parent: obj };
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        const found = findMarker(val, marker, p);
        if (found) return found;
      }
    }
    return null;
  }

  const originalFetch = window.fetch;

  window.fetch = function (input, init) {
    let url = '';
    try {
      url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input);
    } catch (e) { }
    if (!WATCHED_URL.test(url)) return originalFetch.apply(this, arguments);
    return handleWatched.call(this, url, input, init, arguments);
  };

  async function handleWatched(url, input, init, originalArgs) {
    let parsed = null;
    try { parsed = await readBody(input, init); } catch (e) { }

    const match = parsed && parsed.text.match(MARKER);
    if (!match) return originalFetch.apply(this, originalArgs);

    const [whole, id, nonce] = match;
    const entry = armed.get(nonce);
    armed.delete(nonce);

    let body = null;
    try { body = JSON.parse(parsed.text); } catch (e) { }

    const found = body ? findMarker(body, whole, '') : null;
    const rawText = found ? found.parent[found.key].trim() : '';
    const ownText = rawText.endsWith(whole) ? rawText.slice(0, -whole.length).trim() : null;

    const isCreate = CREATE_URL.test(url) || /create_comment/.test(url);
    const valid = body && isCreate
      && ownText !== null && !MARKER.test(ownText)
      && entry && entry.id === id && entry.expires >= Date.now();

    if (!valid) {
      toContent({ type: 'result', nonce, ok: false, error: 'This box cannot take a GIF, or the request expired. Nothing was posted.' });
      throw new TypeError('GIF comment marker blocked');
    }

    toContent({ type: 'seen', nonce });
    let response;
    try {
      if (found) {
        if (ownText) found.parent[found.key] = ownText;
        else delete found.parent[found.key];
      }
      body.tenorId = id;
      const headers = parsed.headers;
      headers.delete('content-encoding');
      const payload = JSON.stringify(body);
      response = input instanceof Request
        ? await originalFetch.call(this, new Request(input, { body: payload, headers }))
        : await originalFetch.call(this, input, { ...init, body: payload, headers });
    } catch (e) {
      toContent({ type: 'result', nonce, ok: false, error: 'The request could not be sent. Nothing was posted.' });
      throw e;
    }

    try {
      const json = await response.clone().json();
      const apiError = json.error && (json.error.message || json.error.status);
      const status = json?.actionResult?.status;
      const statusOk = !status || status === 'STATUS_SUCCEEDED' || status === 'STATUS_OK' || /success/i.test(status);
      const ok = response.ok && !apiError && statusOk;
      const feedback = json.actionResult?.feedbackText?.runs?.map((r) => r.text).join('') || '';
      const error = ok ? null : apiError || feedback || `YouTube rejected the GIF (HTTP ${response.status}).`;
      toContent({ type: 'result', nonce, ok, error });
    } catch (e) {
      toContent({ type: 'result', nonce, ok: response.ok, error: response.ok ? null : `YouTube returned HTTP ${response.status}.` });
    }
    return response;
  }
})();
