/**
 * Cheap request-file metadata for the sidebar — name, seq, type, method, url —
 * without running the full parser. Port of bruno-electron's parseFileMeta
 * (utils/collection.js): the desktop shows the tree from this first, then fills
 * each item in from a worker. A full parse costs ~1ms per file, which is 8s of
 * blocked UI on an 8000-request collection; this is a couple of regexes.
 */

const TYPE_MAP = { http: 'http-request', graphql: 'graphql-request', grpc: 'grpc-request', ws: 'ws-request' };
const HTTP_METHODS = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head', 'trace', 'connect'];

const toSeq = (value) => {
  const seq = Number(value);
  return Number.isFinite(seq) ? seq : 1;
};

const skeleton = ({ name, type, seq, tags, method, url }) => ({
  type: TYPE_MAP[type] || 'http-request',
  name,
  seq: toSeq(seq),
  settings: {},
  tags: Array.isArray(tags) ? tags : [],
  request: {
    method: (method || '').toUpperCase(),
    url: url || '',
    params: [],
    headers: [],
    auth: { mode: 'none' },
    body: { mode: 'none' },
    script: {},
    vars: {},
    assertions: [],
    tests: '',
    docs: ''
  }
});

// meta {\n  name: …\n  type: http\n  seq: 1\n}
const BRU_META = /^meta\s*\{\s*\n([\s\S]*?)\n\}/m;
const BRU_METHOD = new RegExp(`^(${HTTP_METHODS.join('|')})\\s*\\{\\s*\\n\\s*url:\\s*(.*)$`, 'm');
const BRU_OTHER = /^(graphql|grpc|ws)\s*\{\s*\n\s*url:\s*(.*)$/m;

const parseBruMeta = (content, fallbackName) => {
  const block = content.match(BRU_META);
  const meta = {};
  if (block) {
    for (const line of block[1].split('\n')) {
      const index = line.indexOf(':');
      if (index === -1) continue;
      const key = line.slice(0, index).trim();
      const value = line.slice(index + 1).trim();
      if (key && value) meta[key] = value;
    }
  }
  const method = content.match(BRU_METHOD) || content.match(BRU_OTHER);
  return skeleton({
    name: meta.name || fallbackName,
    type: meta.type,
    seq: meta.seq,
    tags: meta.tags ? meta.tags.replace(/^\[|\]$/g, '').split(',').map((t) => t.trim()).filter(Boolean) : [],
    method: method && HTTP_METHODS.includes(method[1]) ? method[1] : '',
    url: method ? method[2].trim() : ''
  });
};

// info:\n  name: …\n  type: http\n  seq: 1 … http:\n  url: …\n  method: GET
const ymlBlock = (content, key) => {
  const match = content.match(new RegExp(`^${key}:\\s*\\n((?:[ \\t]+.*(?:\\n|$))+)`, 'm'));
  const fields = {};
  if (!match) return fields;
  for (const line of match[1].split('\n')) {
    const m = line.match(/^[ \t]+([A-Za-z_][\w-]*):\s*(.*)$/);
    if (m && m[2] !== '') fields[m[1]] = m[2].trim().replace(/^(['"])(.*)\1$/, '$2');
  }
  return fields;
};

const parseYmlMeta = (content, fallbackName) => {
  const info = ymlBlock(content, 'info');
  const type = info.type || 'http';
  const transport = ymlBlock(content, type === 'http' ? 'http' : type);
  return skeleton({
    name: info.name || fallbackName,
    type,
    seq: info.seq,
    tags: [],
    method: type === 'http' ? transport.method : '',
    url: transport.url
  });
};

export const parseFileMeta = (content, { format, fallbackName }) => {
  try {
    return format === 'yml' ? parseYmlMeta(content, fallbackName) : parseBruMeta(content, fallbackName);
  } catch (_error) {
    return skeleton({ name: fallbackName });
  }
};
