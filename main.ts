// Launch Radar v6 — the entrypoint for token-radar-01.
//
// Reads the sealed snapshot, scores every pre-token protocol with the
// model in lib/model.ts, writes the ranked board to out/board.json, and
// copies this repository's dashboard/ and screenshots/ to out/. Last, it
// writes out/dossier.json, the summary the judge reads, with the vendored
// make.fun library.
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts \
//     --input <kit>/input/snapshot.json
//
// The program refuses to write anything when the board fails the gate
// (boardIssue) or the v6 acceptance checks: the common-35 walk-forward
// miss must be at most x2.00 (v4 x1.91, v5 x2.08), the leave-one-out
// miss no worse than v5's x2.65, and the biggest protocols' values if
// they launch must stay in the range the fitted curve gives them —
// Steakhouse Financial at $40M or more (v4 $49.0M, v5 $21.8M). Those
// three numbers are the diagnosis in executable form: a value model
// that scores well only by changing its test set, or that prices the
// $2.75B TVL giants below $40M, does not go out.

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { boardIssue, buildRadar, dataScript, parseSnapshot } from './lib/model.ts';
import { buildDossier } from './vendor/makefun-board.ts';

const here = fileURLToPath(new URL('.', import.meta.url));

/** The scorer's own caps (reference/gate.json): the text cap shapes the bytes, the rest refuse. */
const TEXT_MAX_BYTES = 65_536;
const SCREENSHOT_CAPS = { max: 4, max_bytes: 524_288 };
const IMAGE_NAME = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/;

/** v6 acceptance: the diagnosis, as numbers. */
const COMMON35_MAX = 2.0;
const LOO_MAX = 2.65;
const STEAKHOUSE_IF_MIN_USD = 40_000_000;

/** --name <value> out of the arguments, or the fallback. */
function arg(name: string, fallback: string): string {
  const at = process.argv.indexOf(`--${name}`);
  if (at >= 0 && at + 1 < process.argv.length) return process.argv[at + 1]!;
  const withEquals = process.argv.find((a) => a.startsWith(`--${name}=`));
  return withEquals === undefined ? fallback : withEquals.slice(name.length + 3);
}

const inputArg = arg('input', '/input');
const inputFile = inputArg.endsWith('.json') ? inputArg : join(inputArg, 'snapshot.json');
if (!existsSync(inputFile)) {
  process.stderr.write(`token radar: no snapshot at ${inputFile}: pass --input <snapshot.json|directory> or mount the sealed /input\n`);
  process.exit(2);
}
const out = arg('output', process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

const snapshot = parseSnapshot(readFileSync(inputFile, 'utf8'));
const { board, radar } = buildRadar(snapshot);
const issue = boardIssue(board, snapshot);
if (issue !== null) {
  process.stderr.write(`token radar: the model wrote a board the gate refuses: ${issue}\n`);
  process.exit(1);
}

// v6 acceptance checks, before anything is written.
const vm = radar.value_model;
const failures: string[] = [];
if (!(vm.wf_common35_miss <= COMMON35_MAX)) failures.push(`common-35 walk-forward miss x${vm.wf_common35_miss.toFixed(2)} > x${COMMON35_MAX.toFixed(2)} (v4 x1.91, v5 x2.08)`);
if (!(vm.loo_miss <= LOO_MAX)) failures.push(`leave-one-out miss x${vm.loo_miss.toFixed(2)} > x${LOO_MAX.toFixed(2)}`);
const steakhouse = board.find((r) => r.slug === 'steakhouse-financial');
if (!steakhouse || !(steakhouse.if_launches_usd >= STEAKHOUSE_IF_MIN_USD)) {
  failures.push(`Steakhouse Financial if-launches $${(steakhouse?.if_launches_usd ?? 0).toLocaleString('en-US')} < $${STEAKHOUSE_IF_MIN_USD.toLocaleString('en-US')} (v4 $49.0M, v5 $21.8M)`);
}
if (radar.check.totals_equal_usd !== radar.total_implied_pretoken) {
  failures.push(`check strip totals $${radar.check.totals_equal_usd.toLocaleString('en-US')} != ranked sum $${radar.total_implied_pretoken.toLocaleString('en-US')}`);
}
if (failures.length > 0) {
  process.stderr.write(`token radar: v6 acceptance failed:\n${failures.map((f) => `  - ${f}`).join('\n')}\n`);
  process.exit(1);
}

mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'board.json'), `${JSON.stringify({ rows: board })}\n`);
writeFileSync(join(out, 'data.js'), dataScript(radar));

/** Copy one directory's regular files into `to`, skipping names that start with a dot. */
function copyFiles(from: string, to: string): string[] {
  if (!existsSync(from)) return [];
  mkdirSync(to, { recursive: true });
  const copied: string[] = [];
  for (const name of readdirSync(from)) {
    if (name.startsWith('.')) continue;
    const path = join(from, name);
    if (!statSync(path).isFile()) continue;
    copyFileSync(path, join(to, name));
    copied.push(name);
  }
  return copied;
}

copyFiles(join(here, 'dashboard'), join(out, 'dashboard'));
const shots = copyFiles(join(here, 'screenshots'), join(out, 'screenshots'));
if (shots.length < 3) {
  process.stderr.write(`token radar: screenshots/ holds ${shots.length} image${shots.length === 1 ? '' : 's'}: hand in 3, the board, a detail view and a filtered view\n`);
  process.exit(1);
}
for (const name of shots) {
  if (!IMAGE_NAME.test(name)) {
    process.stderr.write(`token radar: screenshots/${name}: a name is letters, digits and . _ -, 1 to 128 characters\n`);
    process.exit(1);
  }
}

// The dossier is written last: the scorer rebuilds it from this /output and compares bytes.
writeFileSync(join(out, 'dossier.json'), buildDossier(out, { text_max_bytes: TEXT_MAX_BYTES, screenshots: SCREENSHOT_CAPS, dashboard: { max_files: 400, max_bytes: 4_194_304 } }));

const ranked = board.filter((r) => r.radar_rank !== null);
process.stdout.write(
  `token radar v6: ${snapshot.protocols.length} protocols, ${snapshot.watchlist.length} on the watchlist, ${board.length} rows, ${ranked.length} ranked\n` +
    `token radar v6: value [${vm.terms.join(', ')}] on ${vm.peers} peers — LOO x${vm.loo_miss.toFixed(2)}, WF x${vm.wf_miss.toFixed(2)}, common-35 WF x${vm.wf_common35_miss.toFixed(2)} (n=${vm.wf_common35_n})\n` +
    `token radar v6: odds [${radar.odds_model.terms.join(', ')}] — LOO Brier ${radar.odds_model.loo_brier.toFixed(3)}, WF Brier ${radar.odds_model.wf_brier.toFixed(3)}, WF called-right ${(radar.odds_model.wf_called_right * 100).toFixed(0)}% (n=${radar.odds_model.wf_test_n})\n` +
    `token radar v6: ranked total $${radar.total_implied_pretoken.toLocaleString('en-US')}, FARM ${radar.kpis.farm_count}, #1 ${ranked[0]!.name} $${ranked[0]!.implied_value_usd.toLocaleString('en-US')}\n` +
    `token radar v6: wrote ${join(out, 'board.json')}, ${join(out, 'data.js')}, ${join(out, 'dashboard')} (3 files), ${join(out, 'screenshots')} (${shots.length} images) and ${join(out, 'dossier.json')}\n`,
);
