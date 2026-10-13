// Made by U2derscore //
(() => {
  const BOX_SCOPE = 'ytd-comment-simplebox-renderer, ytd-comment-thread-renderer';
  const POST_DIALOG = 'ytd-backstage-post-dialog-renderer';
  const PICKER_W = 340;
  const PICKER_H = 440;
  const FAV_KEY = 'favorites';
  const STAR = '<svg viewBox="0 0 24 24"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/></svg>';
  const SEARCH_DEBOUNCE_MS = 350;
  const ARM_TIMEOUT_MS = 1500;
  const AUTO_SUBMIT_GRACE_MS = 4000;
  const RESULT_TIMEOUT_MS = 20000;

  const PICKER_CSS = `
    :host { all: initial; position: fixed; z-index: 2147483647; }
    .panel {
      --bg: #2b2d31; --bg2: #1e1f22; --bg3: #313338; --fg: #f2f3f5; --muted: #949ba4; --line: #1e1f22; --accent: #5865f2; --err: #f23f42; --star: #f0b232;
      box-sizing: border-box; display: flex; flex-direction: column;
      width: ${PICKER_W}px; background: var(--bg); color: var(--fg);
      border: 1px solid var(--line); border-radius: 8px; overflow: hidden;
      box-shadow: 0 8px 16px rgba(0,0,0,.4);
      font: 14px/1.4 "gg sans", "Noto Sans", Roboto, Arial, sans-serif;
    }
    .tabs { flex: none; display: flex; gap: 4px; padding: 8px 8px 0; background: var(--bg2); }
    .tab {
      margin: 0; padding: 8px 14px; border: 0; border-radius: 4px 4px 0 0; background: transparent;
      color: var(--muted); font: inherit; font-weight: 600; cursor: pointer;
    }
    .tab:hover { color: var(--fg); background: rgba(255,255,255,.06); }
    .tab[aria-selected="true"] { color: var(--fg); background: var(--bg); box-shadow: inset 0 -2px 0 var(--accent); }
    .search { flex: none; display: flex; gap: 6px; padding: 8px; background: var(--bg); }
    input {
      box-sizing: border-box; width: 100%; height: 36px; padding: 0 12px;
      border: 0; border-radius: 4px; outline: none;
      background: var(--bg2); color: var(--fg); font: inherit;
    }
    .search input { flex: 1 1 auto; width: auto; min-width: 0; }
    input:focus { box-shadow: 0 0 0 1px var(--accent); }
    input::placeholder { color: var(--muted); }
    .upload {
      flex: none; height: 36px; padding: 0 12px; border: 0; border-radius: 4px;
      background: var(--accent); color: #fff; font: inherit; font-weight: 600; cursor: pointer;
    }
    .upload:hover { filter: brightness(1.12); }
    .upload:focus-visible { outline: 2px solid var(--fg); outline-offset: 2px; }
    .status { flex: none; padding: 0 12px 6px; color: var(--muted); font-size: 12px; }
    .status:empty { display: none; }
    .status[data-kind="error"] { color: var(--err); }
    .grid {
      flex: 1; min-height: 0; overflow-x: hidden; overflow-y: auto; padding: 0 2px 8px 8px;
      display: flex; align-items: flex-start; gap: 6px; background: var(--bg);
      scrollbar-gutter: stable;
    }
    .grid::-webkit-scrollbar { width: 12px; }
    .grid::-webkit-scrollbar-track { background: transparent; }
    .grid::-webkit-scrollbar-thumb {
      border: 3px solid transparent; border-radius: 6px;
      background: #1a1b1e; background-clip: content-box;
    }
    .grid::-webkit-scrollbar-thumb:hover { background: #111214; background-clip: content-box; }
    .col { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px; }
    .item { position: relative; border-radius: 4px; overflow: hidden; background: var(--bg3); }
    .item:hover, .item:focus-within { box-shadow: 0 0 0 2px var(--accent); }
    .tile { display: block; width: 100%; margin: 0; padding: 0; border: 0; background: transparent; cursor: pointer; }
    .tile:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
    .tile img { display: block; width: 100%; height: auto; }
    .star {
      position: absolute; top: 4px; right: 4px; width: 28px; height: 28px; margin: 0; padding: 0;
      display: none; align-items: center; justify-content: center;
      border: 0; border-radius: 4px; background: rgba(0,0,0,.65); color: #fff; cursor: pointer;
    }
    .item:hover .star, .item:focus-within .star, .star[aria-pressed="true"] { display: flex; }
    .star svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2; }
    .star[aria-pressed="true"] { color: var(--star); }
    .star[aria-pressed="true"] svg { fill: currentColor; }
    .star:hover { background: rgba(0,0,0,.85); }
    .badge {
      position: absolute; left: 4px; bottom: 4px; padding: 1px 6px; border-radius: 3px;
      background: rgba(0,0,0,.7); color: #fff; font-size: 11px; font-weight: 700; pointer-events: none;
    }
    .empty { flex: 1; padding: 32px 16px; text-align: center; color: var(--muted); }
    .panel[data-busy] .item { pointer-events: none; opacity: .45; }
  `;

  const fromMain = new Map();

  window.addEventListener('message', (e) => {
    if (e.source !== window || e.origin !== location.origin) return;
    const msg = e.data;
    if (!msg || msg.gcfy !== 'to-content' || typeof msg.nonce !== 'string') return;
    const cb = fromMain.get(msg.nonce);
    if (cb) cb(msg);
  });

  const toMain = (msg) => window.postMessage({ gcfy: 'to-main', ...msg }, location.origin);

  function newNonce() {
    const bytes = crypto.getRandomValues(new Uint8Array(8));
    return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  function addButton(box) {
    if (box.querySelector('.gcfy-btn')) return;
    if (!box.closest(BOX_SCOPE) || box.closest(POST_DIALOG)) return;
    const footer = box.querySelector('#footer') || box.querySelector('#buttons') || box.querySelector('yt-buttons') || box.querySelector('.buttons') || box.querySelector('.yt-buttons');
    if (!footer) return;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'gcfy-btn';
    btn.title = 'Add a GIF';
    btn.setAttribute('aria-label', 'Add a GIF');
    btn.setAttribute('aria-haspopup', 'dialog');
    btn.setAttribute('aria-expanded', 'false');
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (picker.open && picker.anchor === btn) closePicker();
      else openPicker(btn, box);
    });
    const emoji = footer.querySelector('#emoji-button') || footer.querySelector('button[aria-label*="Emoji"]') || footer.querySelector('button[aria-label*="emoji"]');
    if (emoji && emoji.parentElement === footer) {
      emoji.after(btn);
    } else {
      footer.appendChild(btn);
    }
  }

  let scanQueued = false;
  function scan() {
    scanQueued = false;
    for (const box of document.querySelectorAll('ytd-commentbox, ytd-comment-simplebox-renderer')) addButton(box);
  }
  new MutationObserver(() => {
    if (scanQueued) return;
    scanQueued = true;
    requestAnimationFrame(scan);
  }).observe(document.documentElement, { childList: true, subtree: true });

  scan();
  setInterval(scan, 2000);

  const picker = { tab: 'trending', favs: [], open: false, busy: false, host: null, anchor: null, box: null, els: null, seq: 0, timer: 0, gifs: [], nonce: null };

  function buildPicker() {
    const host = document.createElement('div');
    const root = host.attachShadow({ mode: 'open' });
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(PICKER_CSS);
    root.adoptedStyleSheets = [sheet];

    const panel = document.createElement('div');
    panel.className = 'panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Choose a GIF');

    const tabs = document.createElement('div');
    tabs.className = 'tabs';
    tabs.setAttribute('role', 'tablist');
    const tabEls = {};
    for (const [key, label] of [['trending', 'Trending'], ['favorites', 'Favorites']]) {
      const t = document.createElement('button');
      t.type = 'button';
      t.className = 'tab';
      t.setAttribute('role', 'tab');
      t.textContent = label;
      t.addEventListener('click', () => switchTab(key));
      tabEls[key] = t;
      tabs.append(t);
    }

    const search = document.createElement('div');
    search.className = 'search';
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Search Tenor GIFs';
    input.setAttribute('aria-label', 'Search Tenor GIFs');
    input.autocomplete = 'off';
    input.spellcheck = false;

    search.append(input);

    const status = document.createElement('div');
    status.className = 'status';
    status.setAttribute('role', 'status');

    const grid = document.createElement('div');
    grid.className = 'grid';

    panel.append(tabs, search, status, grid);
    root.append(panel);

    input.addEventListener('input', () => {
      clearTimeout(picker.timer);
      picker.timer = setTimeout(() => load(input.value), SEARCH_DEBOUNCE_MS);
    });
    grid.addEventListener('click', (e) => {
      if (picker.busy) return;
      const star = e.target.closest('.star');
      if (star) {
        e.stopPropagation();
        toggleFav(picker.gifs[Number(star.dataset.index)]);
        return;
      }
      const tile = e.target.closest('.tile');
      if (tile) send(picker.gifs[Number(tile.dataset.index)]);
    });

    picker.host = host;
    picker.els = { panel, input, status, grid, tabEls };
  }

  const isFav = (gif) => picker.favs.some((f) => f.id === gif.id);

  async function loadFavs() {
    try {
      const storage = typeof browser !== 'undefined' ? browser.storage : chrome.storage;
      const data = await storage.local.get(FAV_KEY);
      picker.favs = Array.isArray(data[FAV_KEY]) ? data[FAV_KEY] : [];
    } catch (e) {
      picker.favs = [];
    }
  }

  async function toggleFav(gif) {
    if (!gif) return;
    picker.favs = isFav(gif) ? picker.favs.filter((f) => f.id !== gif.id) : [gif, ...picker.favs];
    try { 
      const storage = typeof browser !== 'undefined' ? browser.storage : chrome.storage;
      await storage.local.set({ [FAV_KEY]: picker.favs }); 
    } catch (e) { setStatus('Could not save favorites.', 'error'); }
    if (picker.tab === 'favorites') load(picker.els.input.value);
    else render(picker.gifs);
  }

  function switchTab(key) {
    picker.tab = key;
    picker.els.input.focus();
    load(picker.els.input.value);
  }

  const imgCache = new Map();

  function setStatus(text, kind) {
    picker.els.status.textContent = text || '';
    if (kind) picker.els.status.dataset.kind = kind;
    else delete picker.els.status.dataset.kind;
  }

  function setBusy(busy) {
    picker.busy = busy;
    picker.els.panel.toggleAttribute('data-busy', busy);
  }

  function place() {
    if (!picker.open) return;
    if (!picker.anchor.isConnected) { closePicker(); return; }
    const r = picker.anchor.getBoundingClientRect();
    const h = Math.min(PICKER_H, innerHeight - 16);
    picker.els.panel.style.height = `${h}px`;
    let top = r.top - h - 8;
    if (top < 8) top = Math.min(r.bottom + 8, innerHeight - h - 8);
    const left = Math.min(Math.max(8, r.left), innerWidth - PICKER_W - 8);
    picker.host.style.top = `${Math.max(8, top)}px`;
    picker.host.style.left = `${Math.max(8, left)}px`;
  }

  function openPicker(anchor, box) {
    if (!picker.host) buildPicker();
    if (picker.open) closePicker();
    picker.open = true;
    picker.tab = 'trending';
    picker.anchor = anchor;
    picker.box = box;
    anchor.setAttribute('aria-expanded', 'true');
    picker.els.panel.toggleAttribute('data-dark', document.documentElement.hasAttribute('dark'));
    document.documentElement.append(picker.host);
    setBusy(false);
    place();
    picker.els.input.focus();
    loadFavs().then(() => load(picker.els.input.value));
  }

  function closePicker() {
    if (!picker.open) return;
    picker.open = false;
    clearTimeout(picker.timer);
    picker.seq++;
    picker.anchor.setAttribute('aria-expanded', 'false');
    picker.host.remove();
    if (picker.anchor.isConnected && !picker.busy) picker.anchor.focus();
  }

  const looksLikeLink = (text) => /^\d{6,20}$/.test(text) || /^(https?:\/\/)?([\w-]+\.)*tenor\.com\//i.test(text);

  async function load(raw) {
    const text = raw.trim();
    const seq = ++picker.seq;
    for (const [key, el] of Object.entries(picker.els.tabEls)) el.setAttribute('aria-selected', String(key === picker.tab));
    if (picker.tab === 'favorites') {
      const q = text.toLowerCase();
      const list = q ? picker.favs.filter((f) => f.title.toLowerCase().includes(q)) : picker.favs;
      render(list);
      setStatus(list.length ? '' : q ? 'No favorites match.' : '');
      return;
    }

    setStatus(text ? 'Searching…' : 'Loading…');
    let reply;
    try {
      const sendMsg = typeof browser !== 'undefined' ? browser.runtime.sendMessage : chrome.runtime.sendMessage;
      reply = await sendMsg(
        !text ? { type: 'featured' } : looksLikeLink(text) ? { type: 'resolve', input: text } : { type: 'search', query: text },
      );
    } catch (e) {
      reply = { ok: false, error: 'The extension was reloaded. Refresh this page.' };
    }
    if (seq !== picker.seq || !picker.open) return;
    if (!reply || !reply.ok) {
      render([]);
      setStatus((reply && reply.error) || 'Tenor could not be reached.', 'error');
      return;
    }
    render(reply.gifs);
    setStatus(reply.gifs.length ? '' : 'No GIFs found.');
  }

  function render(gifs) {
    picker.gifs = gifs;
    const cols = [0, 1].map(() => {
      const col = document.createElement('div');
      col.className = 'col';
      return { el: col, height: 0 };
    });
    gifs.forEach((gif, i) => {
      const item = document.createElement('div');
      item.className = 'item';
      const tile = document.createElement('button');
      tile.type = 'button';
      tile.className = 'tile';
      tile.dataset.index = String(i);
      tile.title = gif.title;
      const img = document.createElement('img');
      img.alt = gif.title;
      img.width = gif.width;
      img.height = gif.height;
      img.loading = 'lazy';
      img.referrerPolicy = 'no-referrer';
      wireImage(img, gif.preview, false);
      tile.append(img);
      const star = document.createElement('button');
      star.type = 'button';
      star.className = 'star';
      star.dataset.index = String(i);
      star.innerHTML = STAR;
      const faved = isFav(gif);
      star.setAttribute('aria-pressed', String(faved));
      star.title = faved ? 'Remove from favorites' : 'Add to favorites';
      star.setAttribute('aria-label', star.title);
      item.append(tile, star);

      const col = cols[0].height <= cols[1].height ? cols[0] : cols[1];
      col.el.append(item);
      col.height += gif.height / gif.width;
    });
    if (!gifs.length && picker.tab === 'favorites') {
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = 'No favorites yet. Hover a GIF and click the star.';
      picker.els.grid.replaceChildren(empty);
      return;
    }
    picker.els.grid.replaceChildren(...cols.map((c) => c.el));
    picker.els.grid.scrollTop = 0;
  }

  function selectRange(editor, range) {
    editor.focus();
    const sel = getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }
  function appendMarker(editor, marker) {
    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    selectRange(editor, range);
    let done = false;
    try { done = document.execCommand('insertText', false, marker); } catch (e) { }
    if (!done || !editor.textContent.includes(marker)) {
      editor.append(document.createTextNode(marker));
      editor.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: marker }));
    }
  }

  function appendLink(editor, url) {
    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    selectRange(editor, range);
    const prefix = editor.textContent.trim() ? ' ' : '';
    let done = false;
    try { done = document.execCommand('insertText', false, prefix + url); } catch (e) { done = false; }
    if (!done || !editor.textContent.includes(url)) {
      editor.append(document.createTextNode(prefix + url));
      editor.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: url }));
    }
  }

  function removeMarker(editor, marker) {
    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const at = node.data.indexOf(marker);
      if (at === -1) continue;
      const range = document.createRange();
      range.setStart(node, at);
      range.setEnd(node, at + marker.length);
      selectRange(editor, range);
      let done = false;
      try { done = document.execCommand('delete', false); } catch (e) { }
      if (!done || editor.textContent.includes(marker)) {
        node.data = node.data.replace(marker, '');
        editor.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward' }));
      }
      return;
    }
  }

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  async function send(gif) {
    const box = picker.box;
    const editor = box && box.isConnected && box.querySelector('#contenteditable-root');
    const submit = box && box.querySelector('#submit-button button');
    if (!editor || !submit) {
      setStatus('The comment box was closed. Open it and try again.', 'error');
      return;
    }



    const nonce = newNonce();
    const marker = `[[gif:${gif.id}:${nonce}]]`;
    let settle;
    const settled = new Promise((resolve) => { settle = resolve; });
    let armedAck;
    const armedPromise = new Promise((resolve) => { armedAck = resolve; });
    let seen = false;
    fromMain.set(nonce, (msg) => {
      if (msg.type === 'armed') armedAck(true);
      else if (msg.type === 'seen') seen = true;
      else if (msg.type === 'result') settle(msg);
    });

    setBusy(true);
    setStatus('Posting…');
    try {
      toMain({ type: 'arm', id: gif.id, nonce });
      const armed = await Promise.race([armedPromise, sleep(ARM_TIMEOUT_MS).then(() => false)]);
      if (!armed) {
        setStatus('The page hook is not running. Refresh this page and try again.', 'error');
        return;
      }

      appendMarker(editor, marker);
      for (let i = 0; i < 20 && submit.disabled; i++) await sleep(50);
      submit.click();

      let result = await Promise.race([settled, sleep(AUTO_SUBMIT_GRACE_MS).then(() => null)]);
      if (!result && !seen) {
        const label = (submit.getAttribute('aria-label') || submit.textContent || 'Comment').trim();
        setStatus(`Press ${label} to send the GIF.`);
      }
      if (!result) result = await Promise.race([settled, sleep(RESULT_TIMEOUT_MS).then(() => null)]);

      if (result && result.ok) {
        setBusy(false);
        closePicker();
        return;
      }
      toMain({ type: 'disarm', nonce });
      if (editor.isConnected) removeMarker(editor, marker);
      setStatus((result && result.error) || 'The GIF was not sent. Nothing was posted.', 'error');
    } finally {
      fromMain.delete(nonce);
      setBusy(false);
    }
  }

  async function proxyImage(url) {
    if (imgCache.has(url)) return imgCache.get(url);
    let out = null;
    try {
      const sendMsg = typeof browser !== 'undefined' ? browser.runtime.sendMessage : chrome.runtime.sendMessage;
      const reply = await sendMsg({ type: 'image', url });
      if (reply && reply.ok && typeof reply.dataUrl === 'string') out = reply.dataUrl;
    } catch (e) { out = null; }
    if (imgCache.size > 200) imgCache.clear();
    imgCache.set(url, out);
    return out;
  }

  function wireImage(img, url, removeOnFail) {
    img.addEventListener('error', async () => {
      if (img.dataset.gcfyRetried) {
        if (removeOnFail) img.remove();
        return;
      }
      img.dataset.gcfyRetried = '1';
      const dataUrl = await proxyImage(url);
      if (dataUrl) img.src = dataUrl;
      else if (removeOnFail) img.remove();
    });
    img.src = url;
  }





  const inPicker = (e) => picker.open && e.composedPath().includes(picker.host);
  for (const type of ['keydown', 'keyup', 'keypress']) {
    window.addEventListener(type, (e) => {
      if (!inPicker(e)) return;
      e.stopImmediatePropagation();
      if (type !== 'keydown') return;
      if (e.key === 'Escape') {
        e.preventDefault();
        closePicker();
      } else if (e.key === 'Enter' && picker.gifs.length === 1 && picker.tab === 'trending' && !picker.busy) {
        e.preventDefault();
        send(picker.gifs[0]);
      }
    }, true);
  }
  window.addEventListener('wheel', (e) => { if (inPicker(e)) e.stopImmediatePropagation(); }, { capture: true, passive: true });

  window.addEventListener('pointerdown', (e) => {
    if (!picker.open || picker.busy) return;
    const path = e.composedPath();
    if (!path.includes(picker.host) && !path.includes(picker.anchor)) closePicker();
  }, true);

  let placeQueued = false;
  const queuePlace = () => {
    if (!picker.open || placeQueued) return;
    placeQueued = true;
    requestAnimationFrame(() => { placeQueued = false; place(); });
  };
  window.addEventListener('scroll', queuePlace, { capture: true, passive: true });
  window.addEventListener('resize', queuePlace, { passive: true });
  window.addEventListener('yt-navigate-start', () => { if (!picker.busy) closePicker(); });
})();
