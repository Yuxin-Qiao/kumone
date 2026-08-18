// Unit tests for data normalizers and DOM element construction in Windows renderer.
'use strict';
const assert = require('assert');

// Mock a lightweight DOM environment in Node for testing renderer helper logic
class MockNode {
  constructor(nodeType, nodeName) {
    this.nodeType = nodeType;
    this.nodeName = nodeName;
    this.childNodes = [];
    this.attributes = {};
    this.listeners = {};
    this.className = '';
  }
  setAttribute(k, v) { this.attributes[k] = String(v); }
  getAttribute(k) { return this.attributes[k]; }
  addEventListener(evt, fn) {
    if (!this.listeners[evt]) this.listeners[evt] = [];
    this.listeners[evt].push(fn);
  }
  dispatchEvent(evt, data) {
    if (this.listeners[evt]) {
      for (const fn of this.listeners[evt]) fn(data);
    }
  }
  append(...children) {
    for (const c of children) {
      if (c instanceof MockNode) {
        this.childNodes.push(c);
      } else {
        // WHATWG DOM append converts non-Nodes to Text nodes via String(c)
        this.childNodes.push(new MockTextNode(String(c)));
      }
    }
  }
  get textContent() {
    return this.childNodes.map((c) => c.textContent).join('');
  }
  get innerHTML() {
    return this.childNodes.map((c) => {
      if (c.nodeType === 3) return c.nodeValue;
      return `<${c.nodeName.toLowerCase()}>${c.innerHTML}</${c.nodeName.toLowerCase()}>`;
    }).join('');
  }
}

class MockElement extends MockNode {
  constructor(tagName) {
    super(1, tagName.toUpperCase());
    this.tagName = tagName.toUpperCase();
  }
  toString() {
    return `[object HTML${this.tagName.charAt(0) + this.tagName.slice(1).toLowerCase()}Element]`;
  }
}

class MockTextNode extends MockNode {
  constructor(text) {
    super(3, '#text');
    this.nodeValue = text;
  }
  get textContent() { return this.nodeValue; }
}

globalThis.document = {
  createElement: (tag) => new MockElement(tag),
  createTextNode: (text) => new MockTextNode(text),
};

// Implementations to test
const el = (tag, attrs = {}, ...children) => {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  const appendChild = (c) => {
    if (c == null || c === false) return;
    if (Array.isArray(c)) {
      for (const item of c) appendChild(item);
    } else {
      node.append(c);
    }
  };
  for (const c of children) {
    appendChild(c);
  }
  return node;
};

function normalizeTrack(raw) {
  if (!raw) return null;
  const rawArtists = raw.ar || raw.artists || (raw.artist ? [raw.artist] : []);
  const artists = (Array.isArray(rawArtists) ? rawArtists : [rawArtists])
    .map((a) => (typeof a === 'string' ? { id: 0, name: a } : { id: a.id || 0, name: a.name || '' }))
    .filter((a) => a.name);
  return {
    id: raw.id,
    name: raw.name || '',
    artists: artists.length ? artists : [{ id: 0, name: '未知歌手' }],
    album: {
      id: (raw.al || raw.album || {}).id || 0,
      name: (raw.al || raw.album || {}).name || '',
      picUrl: (raw.al || raw.album || {}).picUrl || (raw.al || raw.album || {}).pic || null,
    },
    durationMS: raw.dt || raw.duration || 0,
    alias: raw.alia || raw.alias || [],
    tns: raw.tns || [],
    fee: raw.fee || 0,
    mv: raw.mv || 0,
    noCopyrightRcmd: Boolean(raw.noCopyrightRcmd),
    pc: Boolean(raw.pc),
    privilege: raw.privilege || null,
  };
}

const artistNames = (t) => {
  if (!t || !t.artists || !t.artists.length) return '未知歌手';
  const names = t.artists.map((a) => a.name).filter(Boolean);
  return names.length ? names.join(' / ') : '未知歌手';
};

let navigated = null;
const nav = (dest) => { navigated = dest; };

function renderArtistSpans(artists) {
  if (!artists || !artists.length) return [document.createTextNode('未知歌手')];
  const nodes = [];
  artists.forEach((a, ai) => {
    if (ai > 0) nodes.push(document.createTextNode(' / '));
    const span = el('span', {
      onclick: (ev) => {
        if (ev && ev.stopPropagation) ev.stopPropagation();
        if (a.id) nav({ type: 'artist', id: a.id });
      },
    }, a.name || '未知歌手');
    nodes.push(span);
  });
  return nodes;
}

let passed = 0;
const ok = (name) => { passed++; console.log(`  ✓ ${name}`); };

console.log('[Unit Tests] Track Normalization & Artist Rendering');

// Test 1: v3 shape with single artist
const t1 = normalizeTrack({ id: 101, name: '翠河村的姑娘', ar: [{ id: 1234, name: '翠河村' }] });
assert.strictEqual(t1.name, '翠河村的姑娘');
assert.strictEqual(t1.artists.length, 1);
assert.strictEqual(t1.artists[0].name, '翠河村');
assert.strictEqual(artistNames(t1), '翠河村');
ok('v3 track with single artist normalized');

// Test 2: v3 shape with multiple artists
const t2 = normalizeTrack({
  id: 102, name: '借过一下 (live)',
  ar: [{ id: 1001, name: '汪苏泷' }, { id: 1002, name: '周深' }],
});
assert.strictEqual(t2.artists.length, 2);
assert.strictEqual(artistNames(t2), '汪苏泷 / 周深');
ok('v3 track with multiple artists normalized');

// Test 3: legacy shape with artists array
const t3 = normalizeTrack({ id: 103, name: '山谷', artists: [{ id: 2001, name: '旅行团乐队' }] });
assert.strictEqual(t3.artists[0].name, '旅行团乐队');
assert.strictEqual(artistNames(t3), '旅行团乐队');
ok('legacy track with artists array normalized');

// Test 4: empty or missing artists
const t4 = normalizeTrack({ id: 104, name: '未知曲目' });
assert.strictEqual(t4.artists[0].name, '未知歌手');
assert.strictEqual(artistNames(t4), '未知歌手');
ok('track without artist defaults to 未知歌手');

// Test 5: DOM render artist spans - single artist
const td1 = el('td', { class: 't-artist' }, renderArtistSpans(t1.artists));
assert.strictEqual(td1.textContent, '翠河村');
assert.ok(!td1.textContent.includes('[object HTMLSpanElement]'), 'Must NOT contain [object HTMLSpanElement]');
assert.strictEqual(td1.childNodes.length, 1);
assert.strictEqual(td1.childNodes[0].nodeName, 'SPAN');
assert.strictEqual(td1.childNodes[0].textContent, '翠河村');
ok('Single artist renders <span> without [object HTMLSpanElement]');

// Test 6: DOM render artist spans - multiple artists
const td2 = el('td', { class: 't-artist' }, renderArtistSpans(t2.artists));
assert.strictEqual(td2.textContent, '汪苏泷 / 周深');
assert.ok(!td2.textContent.includes('[object HTMLSpanElement]'), 'Must NOT contain [object HTMLSpanElement]');
assert.strictEqual(td2.childNodes.length, 3); // span, text " / ", span
assert.strictEqual(td2.childNodes[0].textContent, '汪苏泷');
assert.strictEqual(td2.childNodes[1].textContent, ' / ');
assert.strictEqual(td2.childNodes[2].textContent, '周深');
ok('Multiple artists render multiple <span>s with " / " separator');

// Test 7: Artist span click navigation
navigated = null;
td2.childNodes[0].dispatchEvent('click', { stopPropagation: () => {} });
assert.deepStrictEqual(navigated, { type: 'artist', id: 1001 });
navigated = null;
td2.childNodes[2].dispatchEvent('click', { stopPropagation: () => {} });
assert.deepStrictEqual(navigated, { type: 'artist', id: 1002 });
ok('Artist spans trigger navigation on click');

// Test 8: Recursive el array flattening
const container = el('div', { class: 'parent' }, [
  el('span', {}, 'A'),
  [el('span', {}, 'B'), [el('span', {}, 'C')]],
]);
assert.strictEqual(container.textContent, 'ABC');
assert.ok(!container.textContent.includes('[object'), 'Recursive arrays flatten without toString');
ok('Recursive array flattening in el helper works');

console.log(`\n全部单元测试通过（${passed} 项）\n`);
