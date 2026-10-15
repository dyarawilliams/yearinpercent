/** Tiny .env loader (no dependency). Ignores a missing file; never overrides existing env vars. */
import fs from 'node:fs';

export function parseEnv(content) {
  const out = {};
  for (const raw of content.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    } else {
      v = v.replace(/\s+#.*$/, '');
    }
    out[m[1]] = v;
  }
  return out;
}

export function loadEnvFile(path = '.env', env = process.env) {
  let content;
  try {
    content = fs.readFileSync(path, 'utf8');
  } catch {
    return false;
  }
  for (const [k, v] of Object.entries(parseEnv(content))) {
    if (env[k] === undefined) env[k] = v;
  }
  return true;
}
