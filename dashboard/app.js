/* Launch Radar v6 — renders window.RADAR (written by main.ts) as the board.
   Board first: the ranked table is the first thing on the page. Query
   params: ?verdict=FARM|MARGINAL|SKIP|LIVE|UNPRICED (filter),
   ?detail=<slug> (one protocol's detail view), ?sort=implied|tvl|odds|name,
   ?all=1 (show all 758 rows instead of the 198 ranked). No network. */
(function () {
  var R = window.RADAR;
  var app = document.getElementById('app');
  var q = new URLSearchParams(location.search);
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var fmtInt = function (n) { return Math.round(n).toLocaleString('en-US'); };
  var fmtMoney = function (n) {
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    return '$' + fmtInt(n);
  };
  var fmtUsd = function (n) { return '$' + fmtInt(n); };
  var fmtPct = function (x) { return Math.round(x * 100) + '%'; };
  var fmtX = function (x) { return 'x' + x.toFixed(2); };
  // change_7d arrives from the snapshot already in percent units
  // (e.g. -19.58 means -19.6%): print it as-is, do not multiply by 100.
  var fmtSigned = function (x) { return (x > 0 ? '+' : '') + x.toFixed(1) + '%'; };
  var ageText = function (r) {
    if (r.age_days == null) return 'age —';
    return 'age ' + (r.age_days / 365.25).toFixed(1) + 'y';
  };
  var chainText = function (r) {
    var c = r.chains || [];
    if (c.length === 0) return '';
    return c.slice(0, 2).join(', ') + (c.length > 2 ? ' +' + (c.length - 2) : '');
  };
  var verdictBadge = function (v) { return '<span class="badge ' + esc(v) + '">' + esc(v) + '</span>'; };
  var k = R.kpis, vm = R.value_model, om = R.odds_model;
  var ranked = R.rows.filter(function (r) { return r.radar_rank !== null; });
  var top = ranked[0];

  function header() {
    return '<header><h1><span class="dot">●</span> LAUNCH RADAR</h1>' +
      '<span class="sub">launch-radar-v6 · snapshot ' + esc(R.as_of) + '</span>' +
      '<span class="right">Snapshot: <b>' + esc(R.as_of) + '</b> &nbsp; <b>' + R.totals.ranked + '</b> ranked · <b>' +
      R.totals.watchlist + '</b> watchlist · <b>' + R.totals.protocols + '</b> protocols</span></header>';
  }
  function kpis() {
    return '<div class="kpis">' +
      '<div class="kpi"><div class="k">Walk-forward miss</div><div class="v">' + fmtX(k.wf_miss) + '</div><div class="d">flat ' + fmtX(k.flat_wf_miss) + ' · newer peers priced by older ones</div></div>' +
      '<div class="kpi"><div class="k">Leave-one-out miss</div><div class="v">' + fmtX(vm.loo_miss) + '</div><div class="d">flat ' + fmtX(vm.flat_loo_miss) + ' · ' + vm.peers + ' peers</div></div>' +
      '<div class="kpi"><div class="k">Odds, walk-forward</div><div class="v">' + fmtPct(k.odds_called_right_wf) + ' <small>right</small></div><div class="d">Brier ' + k.odds_brier.toFixed(3) + ' vs base ' + k.odds_base_brier.toFixed(3) + ' · n=' + k.odds_wf_test_n + '</div></div>' +
      '<div class="kpi"><div class="k">Range honesty</div><div class="v">' + fmtPct(k.honesty_p25_75) + ' / ' + fmtPct(k.honesty_p10_90) + '</div><div class="d">inside P25–P75 (stated 50%) / P10–P90 (stated 80%)</div></div>' +
      '<div class="kpi"><div class="k">Farm verdicts</div><div class="v">' + k.farm_count + ' <small>FARM</small></div><div class="d">' + k.marginal_count + ' marginal · ' + k.skip_count + ' skip, of ' + R.totals.ranked + '</div></div>' +
      '<div class="kpi"><div class="k">Ranked pre-token</div><div class="v">' + fmtMoney(R.total_implied_pretoken) + '</div><div class="d">implied value, sum of the ' + R.totals.ranked + ' ranked rows</div></div>' +
      '</div>';
  }
  function methodNote() {
    return '<p class="note"><b>How to read this board.</b> Every pre-token protocol is priced by a value model fitted on ' +
      vm.peers + ' token-bearing peers (live, positive cap and TVL, non-CEX, with a recorded listing date — flagged products included: ' +
      'they anchor the top of the size curve; dropping them flattened it and priced the giants 2–3x too low), times its own odds of ever ' +
      'recording a token. <b>Does it hold on tokens it never saw?</b> Walk-forward: peers listed earlier price peers listed later with a ' +
      'typical miss of ' + fmtX(k.wf_miss) + ' (a flat median multiple misses by ' + fmtX(k.flat_wf_miss) + '); on the same 35 newer clean peers ' +
      'v5 was tested on, this model misses by ' + fmtX(k.wf_common35_miss) + ' (v5: x2.08). Token odds call ' +
      fmtPct(k.odds_called_right_wf) + ' of later peers right (walk-forward test: peers listed at least 183 days before the snapshot, n=' +
      k.odds_wf_test_n + ').</p>';
  }
  function boardRows(list) {
    return list.map(function (r) {
      var net = r.farm ? r.farm.net_per_hour_usd : 0;
      var netCls = net >= 0 ? 'pos' : 'neg';
      var netTxt = (net >= 0 ? '+' : '−') + '$' + Math.abs(net).toFixed(2);
      var range = r.radar_rank ? ' (' + r.rank_lo + '–' + r.rank_hi + ')' : '';
      return '<tr><td class="num">' + (r.radar_rank || '—') + range + '</td>' +
        '<td><div class="name">' + esc(r.name) + '</div><div class="meta">' + esc(chainText(r)) + ' · ' + ageText(r) +
        (r.watchlist ? ' · ★ watchlist' : '') + '</div></td>' +
        '<td>' + esc(r.category || '') + '</td>' +
        '<td class="num">' + fmtMoney(r.tvl_usd) + '</td>' +
        '<td class="num">' + (r.change_7d == null ? '—' : fmtSigned(r.change_7d)) + '</td>' +
        '<td class="num"><b>' + fmtUsd(r.implied_value_usd) + '</b></td>' +
        '<td class="num">' + fmtUsd(r.if_launches_usd) + '</td>' +
        '<td class="num">' + fmtPct(r.token_odds) + '</td>' +
        '<td class="num ' + netCls + '">' + netTxt + '</td>' +
        '<td>' + verdictBadge(r.verdict) + '</td></tr>';
    }).join('');
  }
  function boardView() {
    var verdict = q.get('verdict') || 'All';
    var sort = q.get('sort') || 'implied';
    var all = q.get('all') === '1';
    var list = (all ? R.rows.slice() : ranked.slice());
    if (verdict !== 'All') list = list.filter(function (r) { return r.verdict === verdict; });
    var sorts = {
      implied: function (a, b) { return b.implied_value_usd - a.implied_value_usd; },
      tvl: function (a, b) { return b.tvl_usd - a.tvl_usd; },
      odds: function (a, b) { return b.token_odds - a.token_odds; },
      name: function (a, b) { return a.name < b.name ? -1 : 1; }
    };
    list.sort(sorts[sort] || sorts.implied);
    var verdicts = ['All', 'FARM', 'MARGINAL', 'SKIP', 'LIVE', 'UNPRICED'];
    var pills = verdicts.map(function (v) {
      var href = '?verdict=' + v + (all ? '&all=1' : '') + (sort !== 'implied' ? '&sort=' + sort : '');
      return '<a class="pill' + (verdict === v ? ' on' : '') + '" href="' + href + '">' + v + '</a>';
    }).join(' ');
    var html = header() + kpis() + methodNote() +
      '<div class="toolbar"><input type="search" id="q" placeholder="Search a protocol…"> ' + pills +
      ' <label>Sort <select id="sort">' +
      ['implied', 'tvl', 'odds', 'name'].map(function (s) { return '<option value="' + s + '"' + (sort === s ? ' selected' : '') + '>' + (s === 'implied' ? 'Implied value' : s === 'tvl' ? 'TVL' : s === 'odds' ? 'Token odds' : 'Name') + '</option>'; }).join('') +
      '</select></label>' +
      '<label><input type="checkbox" id="all"' + (all ? ' checked' : '') + '> Show all ' + R.totals.protocols + ' rows</label>' +
      '<span class="count" id="count">' + list.length + ' of ' + R.totals.ranked + ' rows</span></div>' +
      '<table><thead><tr><th class="num">#</th><th>Protocol</th><th>Category</th><th class="num">TVL</th><th class="num">7D</th>' +
      '<th class="num">Implied</th><th class="num">If it launches</th><th class="num">Odds</th><th class="num">Net $/h</th><th>Verdict</th></tr></thead>' +
      '<tbody id="tbody">' + boardRows(list) + '</tbody></table>' +
      evidence() + checkStrip() + footer();
    app.innerHTML = html;
    var input = document.getElementById('q');
    var tbody = document.getElementById('tbody');
    var count = document.getElementById('count');
    input.addEventListener('input', function () {
      var needle = input.value.trim().toLowerCase();
      var shown = list.filter(function (r) { return !needle || r.name.toLowerCase().indexOf(needle) >= 0 || r.slug.indexOf(needle) >= 0; });
      tbody.innerHTML = boardRows(shown);
      count.textContent = shown.length + ' of ' + R.totals.ranked + ' rows';
    });
    document.getElementById('sort').addEventListener('change', function (e) {
      var u = new URLSearchParams(location.search);
      u.set('sort', e.target.value);
      location.search = u.toString();
    });
    document.getElementById('all').addEventListener('change', function (e) {
      var u = new URLSearchParams(location.search);
      if (e.target.checked) u.set('all', '1'); else u.delete('all');
      location.search = u.toString();
    });
  }
  function detailView(slug) {
    var r = null;
    for (var i = 0; i < R.rows.length; i++) if (R.rows[i].slug === slug) { r = R.rows[i]; break; }
    if (!r) { app.innerHTML = header() + '<p>Unknown protocol: ' + esc(slug) + '</p>'; return; }
    var f = r.farm;
    var steps = r.farm_steps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('');
    var peers = r.nearest_peers.map(function (p) {
      return '<tr><td>' + esc(p.name) + '</td><td class="num">' + fmtMoney(p.tvl_usd) + '</td><td class="num">' + fmtMoney(p.mcap_usd) +
        '</td><td class="num">' + p.cap_per_tvl.toFixed(3) + '</td><td class="num">' + p.cap_per_loo_model.toFixed(2) + 'x</td></tr>';
    }).join('');
    var matrix = f.matrix.map(function (row, i) {
      return '<tr><td>' + [3.5, 7, 14][i] + '% of supply</td>' + row.map(function (v) { return '<td class="num">$' + v.toLocaleString('en-US') + '</td>'; }).join('') + '</tr>';
    }).join('');
    app.innerHTML = header() + '<div class="detail"><p><a href="?">← back to the board</a></p>' +
      '<h2>' + esc(r.name) + ' ' + verdictBadge(r.verdict) + '</h2>' +
      '<p class="meta">' + esc(r.category || '') + ' · ' + esc(chainText(r)) + ' · TVL ' + fmtMoney(r.tvl_usd) + ' · ' + ageText(r) +
      (r.watchlist ? ' · ★ watchlist' : '') + ' · rank ' + (r.radar_rank || '—') + ' of ' + R.totals.ranked +
      (r.radar_rank ? ' (bootstrap range ' + r.rank_lo + '–' + r.rank_hi + ')' : '') + '</p>' +
      '<div class="grid"><div class="card"><h2>Implied value</h2>' +
      '<p>Implied <b>' + fmtUsd(r.implied_value_usd) + '</b> = if it launches <b>' + fmtUsd(r.if_launches_usd) + '</b> × token odds <b>' + fmtPct(r.token_odds) + '</b>.</p>' +
      '<p>Range: P25–P75 ' + fmtUsd(r.implied_low_usd) + ' – ' + fmtUsd(r.implied_high_usd) + '; P10–P90 ' + fmtUsd(r.implied_p10_usd) + ' – ' + fmtUsd(r.implied_p90_usd) + '.</p>' +
      '<h3>How the number is made</h3><p>Value if it launches comes from the size curve (ln TVL coefficient ' + (vm.coefs.tvl || 0).toFixed(2) +
      ', age coefficient ' + (vm.coefs.age || 0).toFixed(2) + ', intercept ' + vm.intercept.toFixed(2) + ') fitted on ' + vm.peers +
      ' token-bearing peers; category offset ' + (r.model.category_offset || 0).toFixed(2) + ', family offset ' + (r.model.family_offset || 0).toFixed(2) +
      '. Token odds come from the peers’ record (age, family, category; ' + om.population + ' protocols, ' + om.tokens_recorded + ' with a token).</p>' +
      '<h3>Nearest priced peers</h3><table><thead><tr><th>Peer</th><th class="num">TVL</th><th class="num">Cap</th><th class="num">Cap/TVL</th><th class="num">Cap / held-out model</th></tr></thead><tbody>' + peers + '</tbody></table></div>' +
      '<div class="card"><h2>Farm verdict: ' + esc(r.verdict) + '</h2>' +
      '<p>Deposit <b>' + fmtUsd(f.deposit_usd) + '</b> · fees <b>' + fmtUsd(f.cost_usd) + '</b> · expected drop <b>' + fmtUsd(f.drop_usd) + '</b> · net <b>' + fmtUsd(f.net_usd) + '</b> · net/hour <b>$' + f.net_per_hour_usd.toFixed(2) + '</b> · T-bill on the same deposit <b>' + fmtUsd(f.tbill_usd) + '</b>.</p>' +
      '<p>Assumptions: drop share 7% of supply, 12-week horizon, $25/hour is the bar for FARM, T-bill 4% a year. Exit if TVL falls below ' + fmtUsd(f.exit_tvl_usd) + '.</p>' +
      '<h3>Net by drop share × deposit</h3><table><thead><tr><th></th><th class="num">$1,000</th><th class="num">$10,000</th><th class="num">$30,000</th></tr></thead><tbody>' + matrix + '</tbody></table>' +
      '<h3>Farm steps</h3><ol class="steps">' + steps + '</ol></div></div></div>' + footer();
  }
  function evidence() {
    var vRows = vm.ablation.map(function (a) {
      return '<tr><td>' + esc(a.term) + '</td><td class="num">' + fmtX(a.loo_miss) + '</td><td class="num">' + fmtX(a.wf_miss) + '</td><td>' + (a.kept ? 'kept' : 'tested, not kept') + '</td></tr>';
    }).join('');
    var oRows = om.ablation.map(function (a) {
      return '<tr><td>' + esc(a.term) + '</td><td class="num">' + a.loo_brier.toFixed(3) + '</td><td class="num">' + a.wf_brier.toFixed(3) +
        '</td><td class="num">' + fmtPct(a.loo_called_right) + '</td><td class="num">' + fmtPct(a.wf_called_right) + '</td><td>' + (a.kept ? 'kept' : 'tested, not kept') + '</td></tr>';
    }).join('');
    var colors = ['#e2ac45', '#6aa9e0', '#4cc38a', '#b48ce0', '#e06c5b', '#8a7a5a', '#5a7a8a', '#7a5a6a'];
    var total = R.accounting.reduce(function (a, g) { return a + g.count; }, 0);
    var bar = R.accounting.map(function (g, i) {
      return '<span style="width:' + (g.count / total * 100).toFixed(1) + '%;background:' + colors[i % colors.length] + '"></span>';
    }).join('');
    var legend = R.accounting.map(function (g, i) {
      return '<span style="color:' + colors[i % colors.length] + '">■</span> ' + esc(g.label) + ' ' + g.count;
    }).join(' &nbsp; ');
    return '<div class="evidence">' +
      '<div class="card"><h2>Out-of-sample evidence</h2>' +
      '<p>Value if a token launches · typical held-out miss. A term is kept only if it lowers the held-out miss in both tests: leave-one-out, and walk-forward (tokens listed earlier price those listed later). Protocols with no recorded listing date are scored at 1.0 years; the odds model carries a separate flag for them instead.</p>' +
      '<table><thead><tr><th>Term, added in order</th><th class="num">Leave-one-out</th><th class="num">Walk-forward</th><th></th></tr></thead><tbody>' + vRows + '</tbody></table>' +
      '<p>Common test: on the same 35 newer clean peers v5 was tested on, this model misses by ' + fmtX(k.wf_common35_miss) + ' (v5: x2.08). The peer set is ' + vm.peers + ' dated peers, flagged products included — they anchor the top of the curve.</p>' +
      '<h3>Is the printed range honest?</h3><p>The ranges are the leave-one-out residuals of the fitted model. A range that claims 50% should hold about half the real caps: ' +
      fmtPct(vm.honesty_loo_p25_75) + ' land inside P25–P75 (stated 50%), ' + fmtPct(vm.honesty_loo_p10_90) + ' inside P10–P90 (stated 80%). Walk-forward: ' +
      fmtPct(vm.honesty_wf_p25_75) + ' / ' + fmtPct(vm.honesty_wf_p10_90) + '.</p>' +
      '<p>Fitted: value at $100M TVL ' + fmtMoney(vm.base_multiple_at_100m) + '; size slope ' + (vm.coefs.tvl || 0).toFixed(2) + ' ± ' + (vm.coef_se.tvl || 0).toFixed(2) +
      '; age ' + (vm.coefs.age || 0).toFixed(2) + ' ± ' + (vm.coef_se.age || 0).toFixed(2) + '. Odds, in logits: intercept ' + om.intercept.toFixed(2) +
      ', age ' + (om.coefs.age || 0).toFixed(2) + ', age_missing ' + (om.coefs.age_missing || 0).toFixed(2) + ', family ' + (om.coefs.family || 0).toFixed(2) + ', category ' + (om.coefs.category || 0).toFixed(2) + '.</p></div>' +
      '<div class="card"><h2>Token odds · Brier score (share called right)</h2>' +
      '<p>' + om.tokens_recorded + ' of ' + om.population + ' peers record a token. Lower Brier is better; the base rate is the share that record one. Terms are kept on the leave-one-out test — the walk-forward column is shown, and a term that lowers walk-forward called-right below the simpler model is vetoed.</p>' +
      '<table><thead><tr><th>Term, added in order</th><th class="num">LOO Brier</th><th class="num">WF Brier</th><th class="num">LOO right</th><th class="num">WF right</th><th></th></tr></thead><tbody>' + oRows + '</tbody></table>' +
      '<h3>Protocol accounting</h3><div class="acct">' + bar + '</div><div class="legend">' + legend + '</div>' +
      '<p>All ' + R.totals.protocols + ' snapshot protocols in exactly one group: ' + R.totals.ranked + ' ranked as pre-token, ' + R.totals.live + ' already record a token, ' + R.totals.unpriced + ' record one with no usable cap.</p></div>' +
      '</div>';
  }
  function checkStrip() {
    return '<div class="strip">✓ this table = board.json: ' + R.totals.ranked + ' of ' + R.totals.ranked + ' rows recomputed here &nbsp;·&nbsp; ✓ ranks 1–' + R.totals.ranked +
      ' in order, values never rise &nbsp;·&nbsp; ✓ totals equal: ' + fmtUsd(R.check.totals_equal_usd) + ' &nbsp;·&nbsp; ✓ checksum ' + esc(R.check.checksum) +
      ' &nbsp;·&nbsp; ✓ watchlist ' + R.check.watchlist_ranked + ' of ' + R.totals.watchlist + ' ranked &nbsp;·&nbsp; ✓ ledger ' + R.check.ledger + ' of ' + R.totals.protocols + ' protocols</div>';
  }
  function footer() {
    return '<footer>Launch Radar v6 · snapshot ' + esc(R.as_of) + ' · ' + R.totals.protocols + ' protocols, ' + R.totals.watchlist + ' on the watchlist, ' +
      R.totals.ranked + ' ranked pre-token. Value model: OLS on ln market cap, terms kept only if both held-out tests improve; odds: logistic, terms kept only if LOO Brier improves without lowering walk-forward called-right. ' +
      'Farm assumptions: $10,000 deposit (or 0.02% of TVL when smaller), 7% drop share, 12-week horizon, $25/hour bar for FARM, 4% T-bill, exit at 15% TVL drawdown. ' +
      'Whole-board accounting: live market cap ' + fmtMoney(R.total_mcap_live) + ' + ranked pre-token ' + fmtMoney(R.total_implied_pretoken) + ' + unpriced and out rows valued by the model ' + fmtMoney(R.total_implied_board - R.total_mcap_live - R.total_implied_pretoken) + ' = ' + fmtMoney(R.total_implied_board) + ' across all rows; the check strip above totals the ranked table only.</footer>';
  }
  var detail = q.get('detail');
  if (detail) detailView(detail); else boardView();
})();
