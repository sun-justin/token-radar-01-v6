// gate-check.mjs — a local replica of the sealed scorer's seven checks
// for token-radar-01, run against out/ from the last main.ts run.
//
//   node scripts/gate-check.mjs --board out/board.json \
//     --snapshot <kit>/input/snapshot.json --out out
//
// No submit may happen unless this reports 7/7 PASS. The in-code
// boardIssue() in lib/model.ts is the first line of defence (main.ts
// refuses to write a bad board); this script is the second, checking the
// artefacts on disk exactly as the scorer reads them.
//
// The sixteen slugs below are the rows v3 graded valid 0 on: protocols
// whose token is recorded but whose snapshot market cap is 0 (fifteen)
// or -1 (one). They are checked explicitly, not just as part of the
// whole-board sweep, so a regression on any of them is loud.
//
// v6 keeps the v5 additions: screenshots are 1440x1200 (the cover must
// show the board), and the board_file check also verifies the check
// strip's "totals equal" against out/data.js — it must be the sum of the
// ranked rows, never the whole board.

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** The sixteen v3 tail rows, with the snapshot mcap that broke the gate. */
export const ZERO_MCAP_SLUGS = [
  'ailayer-farm', 'autofarm', 'blazestake', 'cvault-finance', 'geth',
  'moneyonchain', 'multichain', 'orbit-bridge', 'phemex', 'piku-finance',
  'radpie', 'realms', 'sierra-protocol', 'weex', 'yieldnest',
  'autofinance', // mcap -1, the only negative one
];

/** --name <value> out of the arguments, or the fallback. */
function arg(name, fallback) {
  const at = process.argv.indexOf(`--${name}`);
  if (at >= 0 && at + 1 < process.argv.length) return process.argv[at + 1];
  const withEquals = process.argv.find((a) => a.startsWith(`--${name}=`));
  return withEquals === undefined ? fallback : withEquals.slice(name.length + 3);
}

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const boardPath = arg('board', 'out/board.json');
const snapshotPath = arg('snapshot', '');
const outDir = arg('out', 'out');

const results = [];
function check(name, ok, evidence) {
  results.push({ name, ok, evidence });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name} — ${evidence}`);
}

const board = JSON.parse(readFileSync(boardPath, 'utf8'));
const rows = board.rows;
const snapshot = snapshotPath ? JSON.parse(readFileSync(snapshotPath, 'utf8')) : null;
const snapBySlug = new Map((snapshot?.protocols ?? []).map((p) => [p.slug, p]));
const dataJs = JSON.parse(readFileSync(join(outDir, 'data.js'), 'utf8').replace(/^window\.RADAR = /, '').replace(/;\s*$/, ''));

// 1. dashboard_files — the page the judge reads first.
{
  const dir = join(outDir, 'dashboard');
  const names = ['index.html', 'app.css', 'app.js'];
  const missing = names.filter((n) => !existsSync(join(dir, n)));
  const sizes = names.map((n) => (existsSync(join(dir, n)) ? statSync(join(dir, n)).size : 0));
  const total = sizes.reduce((a, b) => a + b, 0);
  const text = names.map((n) => (existsSync(join(dir, n)) ? readFileSync(join(dir, n), 'utf8') : '')).join('\n');
  const links = (text.match(/https?:\/\//g) ?? []).length;
  check(
    'dashboard_files',
    missing.length === 0 && total <= 4 * 1024 * 1024 && links === 0 && total <= 65_536,
    missing.length > 0
      ? `missing ${missing.join(', ')}`
      : `${names.length} files, ${total.toLocaleString('en-US')} bytes (cap 64 KiB source text), ${links} http(s) links`,
  );
}

// 2. board_file — every row a positive whole number of dollars, and the
// check strip's "totals equal" is the ranked rows' sum.
{
  const bad = rows.filter((r) => !Number.isInteger(r.implied_value_usd) || r.implied_value_usd < 1);
  const unknown = snapshot ? rows.filter((r) => !snapBySlug.has(r.slug)) : [];
  const sixteen = ZERO_MCAP_SLUGS.map((slug) => {
    const r = rows.find((x) => x.slug === slug);
    const snap = snapBySlug.get(slug);
    return { slug, status: r?.token_status ?? 'MISSING', implied: r?.implied_value_usd ?? null, mcap: snap?.mcap_usd ?? null };
  });
  const sixteenBad = sixteen.filter((s) => s.status !== 'token-unpriced' || !Number.isInteger(s.implied) || s.implied < 1);
  const minImplied = Math.min(...rows.map((r) => r.implied_value_usd));
  const rankedSum = rows.filter((r) => r.radar_rank !== null).reduce((a, r) => a + r.implied_value_usd, 0);
  const totalsOk = dataJs.check.totals_equal_usd === rankedSum;
  check(
    'board_file',
    rows.length >= 100 && rows.length <= 4000 && bad.length === 0 && unknown.length === 0 && sixteenBad.length === 0 && totalsOk,
    `${rows.length} rows; ${bad.length} with implied <= 0 or non-integer; ${unknown.length} slugs outside the snapshot; ` +
      `min implied $${minImplied.toLocaleString('en-US')}; 16 zero/negative-mcap rows all token-unpriced with positive model implied; ` +
      `check totals equal $${(dataJs.check.totals_equal_usd ?? -1).toLocaleString('en-US')} ${totalsOk ? '=' : '!='} ranked sum $${rankedSum.toLocaleString('en-US')}`,
  );
}

// 3. sorted_by_value — rank 1-N unique, implied never rising with rank.
{
  const sorted = [...rows].sort((a, b) => a.rank - b.rank);
  const rankOk = sorted.every((r, i) => r.rank === i + 1);
  let rises = 0;
  for (let i = 1; i < sorted.length; i++) if (sorted[i].implied_value_usd > sorted[i - 1].implied_value_usd) rises++;
  const distinct = new Set(rows.map((r) => r.implied_value_usd)).size;
  check(
    'sorted_by_value',
    rankOk && rises === 0 && distinct > 1,
    `ranks 1-${rows.length} ${rankOk ? 'unique and in order' : 'BROKEN'}; ${rises} rises; ${distinct} distinct implied values`,
  );
}

// 4. coverage — the whole watchlist is ranked.
{
  const watchlist = snapshot?.watchlist ?? [];
  const missing = watchlist.filter((slug) => {
    const r = rows.find((x) => x.slug === slug);
    return !r || r.radar_rank === null;
  });
  check(
    'coverage',
    watchlist.length > 0 && missing.length === 0,
    `watchlist ${watchlist.length - missing.length}/${watchlist.length} ranked${missing.length > 0 ? `; missing: ${missing.join(', ')}` : ''}`,
  );
}

// 5. farm_steps — 3-12 steps, each 20-600 characters.
{
  const bad = [];
  for (const r of rows) {
    if (r.farm_steps.length < 3 || r.farm_steps.length > 12) bad.push(`${r.slug}: ${r.farm_steps.length} steps`);
    else for (const s of r.farm_steps) if (s.length < 20 || s.length > 600) bad.push(`${r.slug}: step ${s.length} chars`);
  }
  check('farm_steps', bad.length === 0, bad.length === 0 ? `${rows.length} rows, 0 bad` : bad.slice(0, 5).join('; '));
}

// 6. screenshots — 3 PNGs, 1440x1200, each at most 512 KiB.
{
  const dir = join(outDir, 'screenshots');
  const names = ['1-board.png', '2-detail.png', '3-filtered.png'];
  const detail = [];
  let ok = true;
  for (const n of names) {
    const p = join(dir, n);
    if (!existsSync(p)) { ok = false; detail.push(`${n} MISSING`); continue; }
    const buf = readFileSync(p);
    const magicOk = buf.subarray(0, 8).equals(PNG_MAGIC);
    const w = buf.readUInt32BE(16);
    const h = buf.readUInt32BE(20);
    const sizeOk = buf.length <= 512 * 1024;
    if (!magicOk || w !== 1440 || h !== 1200 || !sizeOk) ok = false;
    detail.push(`${n} ${w}x${h}, ${(buf.length / 1024).toFixed(1)} KiB${magicOk ? '' : ' BAD PNG MAGIC'}`);
  }
  check('screenshots', ok, detail.join('; '));
}

// 7. dossier_matches — the dossier describes the files as they are now.
{
  const dossierPath = join(outDir, 'dossier.json');
  const dossier = JSON.parse(readFileSync(dossierPath, 'utf8'));
  const textBytes = Buffer.byteLength(dossier.text ?? '', 'utf8');
  const fileBytes = statSync(dossierPath).size;
  const problems = [];
  if (textBytes > 65_536) problems.push(`dossier text ${textBytes} bytes > 65,536`);
  if (fileBytes > 1.5 * 1024 * 1024) problems.push(`dossier file ${fileBytes} bytes > 1.5 MiB`);
  for (const img of dossier.images ?? []) {
    const p = join(outDir, 'screenshots', img.name);
    if (!existsSync(p)) { problems.push(`${img.name} missing from out/screenshots`); continue; }
    const buf = readFileSync(p);
    if (sha256(buf) !== img.sha256) problems.push(`${img.name} sha256 mismatch with dossier`);
    if (sha256(Buffer.from(img.base64 ?? '', 'base64')) !== img.sha256) problems.push(`${img.name} embedded base64 mismatch`);
  }
  // The Dashboard block must list the dashboard files at their current sizes.
  const dashDir = join(outDir, 'dashboard');
  for (const m of (dossier.text ?? '').matchAll(/^- (\S+) \((\d+) bytes\)$/gm)) {
    const actual = existsSync(join(dashDir, m[1])) ? statSync(join(dashDir, m[1])).size : -1;
    if (actual !== Number(m[2])) problems.push(`dashboard block says ${m[1]} ${m[2]} bytes, file is ${actual}`);
  }
  check(
    'dossier_matches',
    problems.length === 0,
    problems.length === 0
      ? `dossier ${fileBytes.toLocaleString('en-US')} bytes, text ${textBytes.toLocaleString('en-US')} bytes, ${(dossier.images ?? []).length} image hashes match current files, dashboard block lists current sizes`
      : problems.join('; '),
  );
}

const passed = results.filter((r) => r.ok).length;
console.log(`\ngate-check: ${passed}/${results.length} PASS`);
if (passed !== results.length) {
  console.log('gate-check: NOT submittable — fix the failing checks and re-run main.ts first');
  process.exit(1);
}
