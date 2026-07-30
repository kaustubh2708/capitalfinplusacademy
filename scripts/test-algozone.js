/* Headless render + arithmetic check for the Algozone dashboard.
   Loads the real page + the real stats JSON in jsdom, drives the controls,
   and re-derives the calculator's numbers independently.
     node test_algozone.js <site-dir> <stats.json>                          */
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

const SITE = process.argv[2];
const STATS = process.argv[3];
const D = JSON.parse(fs.readFileSync(STATS, 'utf8'));

let fails = 0, checks = 0;
function ok(name, cond, extra) {
  checks++;
  if (!cond) { fails++; console.log('  FAIL  ' + name + (extra ? '  ' + extra : '')); }
  else console.log('  ok    ' + name + (extra ? '  ' + extra : ''));
}

const vc = new VirtualConsole();
vc.on('jsdomError', e => console.log('  [jsdom] ' + e.message));

const html = fs.readFileSync(path.join(SITE, 'pages/algozone.html'), 'utf8');
const dom = new JSDOM(html, {
  runScripts: 'outside-only',
  url: 'https://capitalfinplusadvizors.com/pages/algozone.html',
  virtualConsole: vc
});
const { window } = dom;
window.fetch = () => Promise.resolve({ ok: true, json: () => Promise.resolve(D) });

window.eval(fs.readFileSync(path.join(SITE, 'js/algozone-dashboard.js'), 'utf8'));

setTimeout(() => {
  const doc = window.document;
  const $ = s => doc.querySelector(s);
  const txt = s => ($(s) ? $(s).textContent.replace(/\s+/g, ' ').trim() : '');

  console.log('\n— render —');
  ok('KPI strip populated', $('#azd-kpis').children.length >= 6,
     $('#azd-kpis').children.length + ' tiles');
  ok('chart drawn', $('#azd-chart').innerHTML.indexOf('<svg') === 0);
  const bars = $('#azd-chart').querySelectorAll('rect.azd-bar').length;
  ok('one bar per instrument', bars === D.instruments.length, bars + ' bars');
  const bodyRows = $('#azd-table').querySelectorAll('tbody tr').length;
  ok('table rows', bodyRows === D.instruments.length, bodyRows + ' rows');
  ok('calculator rendered', $('#azd-calc-out').innerHTML.length > 500);
  ok('loading blocks hidden',
     [...doc.querySelectorAll('.azd-loading')].every(n => n.style.display === 'none'));
  ok('no "undefined" leaked into the DOM',
     !doc.body.innerHTML.includes('undefined'));
  ok('no "NaN" leaked into the DOM', !doc.body.innerHTML.includes('NaN'));

  console.log('\n— market switching —');
  const seg = (id, v) => {
    const b = [...$('#' + id).querySelectorAll('button')].find(x => x.dataset.v === v);
    if (!b) throw new Error('no button ' + v + ' in ' + id);
    b.click();
  };
  for (const m of ['options', 'niftyopt', 'futures', 'stocks']) {
    seg('azd-market-seg', m);
    ok(m + ' board renders', $('#azd-table').querySelectorAll('tbody tr').length >= 1
      && !$('#azd-table').innerHTML.includes('undefined'));
  }
  for (const m of D.model_order) {
    seg('azd-model-seg', m);
    ok('model ' + m + ' renders', $('#azd-kpis').innerHTML.includes('%'));
  }
  for (const s of ['honest', 'pure']) {
    seg('azd-scoring-seg', s);
    ok('scoring ' + s + ' renders', $('#azd-kpis').children.length >= 6);
  }

  console.log('\n— segmented controls track the selection —');
  for (const [id, vals] of [['azd-market-seg', ['options', 'niftyopt', 'futures', 'stocks']],
                            ['azd-period-seg', D.periods],
                            ['azd-model-seg', D.model_order],
                            ['azd-scoring-seg', ['honest', 'pure']],
                            ['azd-compound-seg', ['monthly', 'daily', 'none']]]) {
    let good = true;
    for (const v of vals) {
      seg(id, v);
      const btns = [...$('#' + id).querySelectorAll('button')];
      const on = btns.filter(b => b.getAttribute('aria-pressed') === 'true');
      if (on.length !== 1 || on[0].dataset.v !== v) good = false;
    }
    ok(id + ' highlight follows the click', good);
    ok(id + ' has a slider pill', !!$('#' + id + ' .azd-seg-pill'));
  }

  console.log('\n— scoring modes really differ —');
  seg('azd-market-seg', 'stocks');
  seg('azd-model-seg', D.model_order[0]);
  seg('azd-scoring-seg', 'pure');
  const pureKpi = txt('#azd-kpis');
  seg('azd-scoring-seg', 'honest');
  const honestKpi = txt('#azd-kpis');
  ok('pure ≠ honest on the board', pureKpi !== honestKpi);

  console.log('\n— calculator arithmetic (independent re-derivation) —');
  seg('azd-scoring-seg', 'pure');
  seg('azd-calc-market-seg', 'stocks');
  const amt = $('#azd-calc-amount');
  amt.value = '200000';
  amt.dispatchEvent(new window.Event('input'));
  $('#azd-calc-instrument').value = 'PORTFOLIO';
  $('#azd-calc-instrument').dispatchEvent(new window.Event('change'));
  $('#azd-calc-concurrent').value = '2';
  $('#azd-calc-concurrent').dispatchEvent(new window.Event('change'));

  const model = D.model_order[0];
  const PER = 'All';   // the board defaults to all-time
  const e = D.models[model].equity.pure[PER].overall;
  const unit = 200000 / 2;
  const expT1 = unit * e.pct_at_t1 / 100;
  const expSL = unit * e.pct_at_sl / 100;
  const fmt = v => (v < 0 ? '−₹' : '₹') + Math.abs(Math.round(v)).toLocaleString('en-IN');
  const compact = v => {
    const n = Math.abs(v), s = v < 0 ? '−₹' : '₹';
    if (n >= 1e7) return s + (n / 1e7).toFixed(2) + ' Cr';
    if (n >= 1e5) return s + (n / 1e5).toFixed(2) + ' L';
    return s + Math.round(n).toLocaleString('en-IN');
  };
  const out = () => $('#azd-calc-out').textContent.replace(/\s+/g, ' ');
  ok('T1 scenario ₹ matches', out().includes(fmt(expT1)), fmt(expT1));
  ok('SL scenario ₹ matches', out().includes(fmt(expSL)), fmt(expSL));

  /* Independently rebuild the daily return path from D.paths and re-derive the
     projection, exactly as the page should be doing it. */
  function buildSeries(scoring, market, instrument, opts) {
    const pk = (D.paths[model] || {})[scoring] || {};
    const kind = market === 'stocks' ? 'equity' : 'options';
    const src = pk[kind] || {};
    const names = market === 'stocks'
      ? (instrument === 'PORTFOLIO' ? Object.keys(src) : [instrument])
      : [market === 'niftyopt' ? 'NIFTY 50' : instrument];
    let a = null, z = null;
    for (const nm of names) {
      const c = D.coverage[nm];
      if (!c) continue;
      a = a === null ? c[0] : Math.min(a, c[0]);
      z = z === null ? c[1] : Math.max(z, c[1]);
    }
    const N = z - a + 1;
    const arr = new Array(N).fill(0);
    const agg = {};
    for (const nm of names) for (const [i, pc, n] of (src[nm] || [])) {
      const b = agg[i] || (agg[i] = [0, 0]);
      b[0] += pc; b[1] += n;
    }
    for (const k of Object.keys(agg)) {
      const [sum, n] = agg[k];
      let frac;
      if (market === 'stocks') {
        const slots = Math.max(1, opts.concurrent);
        frac = sum * (Math.min(n, slots) / n) / slots;
      } else {
        const dep = opts.deploy / 100;
        frac = sum * (Math.min(n * dep, 1) / n);
      }
      const j = +k - a;
      if (j >= 0 && j < N) arr[j] = frac / 100;
    }
    arr.offset = a;
    return arr;
  }
  const sum = a => a.reduce((x, y) => x + y, 0);
  const grow = a => a.reduce((x, y) => x * (1 + y), 1) - 1;
  function stats(series, mode) {
    const off = series.offset || 0, order = [], b = {};
    for (let i = 0; i < series.length; i++) {
      const m = D.dates[i + off].slice(0, 7);
      if (!(m in b)) { b[m] = []; order.push(m); }
      b[m].push(series[i]);
    }
    const monthly = order.map(m => mode === 'daily' ? grow(b[m]) : sum(b[m]));
    const dayAvg = sum(series) / series.length;
    let year;
    if (mode === 'none') year = dayAvg * 252;
    else if (mode === 'monthly') {
      const g = Math.pow(1 + grow(monthly), 1 / monthly.length) - 1;
      year = Math.pow(1 + g, 12) - 1;
    } else {
      const gd = Math.pow(1 + grow(series), 1 / series.length) - 1;
      year = Math.pow(1 + gd, 252) - 1;
    }
    return {
      dayAvg, year, months: monthly.length,
      monthAvg: sum(monthly) / monthly.length,
      monthLo: Math.min(...monthly), monthHi: Math.max(...monthly),
      neg: monthly.filter(v => v < 0).length
    };
  }
  const S0 = buildSeries('pure', 'stocks', 'PORTFOLIO', { concurrent: 2 });
  const P0 = stats(S0, 'none');
  ok('daily ₹ matches the real path', out().includes(compact(P0.dayAvg * 200000)),
     compact(P0.dayAvg * 200000));
  ok('average month ₹ matches the real path',
     out().includes(compact(P0.monthAvg * 200000)), compact(P0.monthAvg * 200000));
  ok('worst month is the real worst month',
     out().includes(compact(P0.monthLo * 200000)), compact(P0.monthLo * 200000));
  ok('best month is the real best month',
     out().includes(compact(P0.monthHi * 200000)), compact(P0.monthHi * 200000));
  ok('losing-month count is stated',
     out().includes(P0.neg + ' of those ' + P0.months + ' months lost money'),
     P0.neg + '/' + P0.months);
  ok('the page says it is not a power of an average',
     out().includes('not an average raised to a power'));

  console.log('\n— after-costs path shows real losing months —');
  seg('azd-scoring-seg', 'honest');
  const Ph = stats(buildSeries('honest', 'stocks', 'PORTFOLIO', { concurrent: 2 }), 'none');
  ok('after costs, some months lose money', Ph.neg > 0, Ph.neg + ' of ' + Ph.months);
  ok('and the worst month is negative', Ph.monthLo < 0,
     compact(Ph.monthLo * 200000));
  ok('page shows that negative month', out().includes(compact(Ph.monthLo * 200000)));
  seg('azd-scoring-seg', 'pure');

  console.log('\n— compounding walks the path —');
  const yearAvg = () => {
    const m = out().match(/Per year[^₹]*₹[\d.,]+ ?[LC]?r?\s*(₹[\d.,]+ ?[LC]?r?)/);
    return m ? m[1] : null;
  };
  const seen = {};
  for (const mode of ['none', 'monthly', 'daily']) {
    seg('azd-compound-seg', mode);
    const want = compact(stats(buildSeries('pure', 'stocks', 'PORTFOLIO',
                                           { concurrent: 2 }), mode).year * 200000);
    ok(mode + ' annual matches an independent path compounding',
       out().includes(want), want);
    seen[mode] = yearAvg();
  }
  ok('all three compounding modes give different annual figures',
     new Set(Object.values(seen)).size === 3, JSON.stringify(seen));
  ok('daily carries its own caveat', (seg('azd-compound-seg', 'daily'),
     out().includes('assumes you can resize every session')));
  seg('azd-compound-seg', 'none');

  console.log('\n— options & futures calculators —');
  seg('azd-calc-market-seg', 'options');
  const oSel = $('#azd-calc-instrument');
  ok('stock-options list excludes the index', oSel.options.length >= 10
     && ![...oSel.options].some(x => x.value === 'NIFTY 50'),
     oSel.options.length + ' stocks');
  oSel.value = 'MARUTI';
  oSel.dispatchEvent(new window.Event('change'));
  const o = D.options[model].pure[PER]['MARUTI'];
  amt.value = '200000'; amt.dispatchEvent(new window.Event('input'));
  const dep = () => +$('#azd-calc-deploy').value;
  ok('option sizing defaults to a fraction, not the whole account', dep() === 25,
     dep() + '% per trade');
  const lots = Math.floor(200000 * dep() / 100 / o.invest);
  const oOut = $('#azd-calc-out').textContent.replace(/\s+/g, ' ');
  ok('options lots respect the deployment %', oOut.includes(lots + ' lot'),
     lots + ' lots at ' + dep() + '%');
  ok('options T1 ₹ matches', oOut.includes(fmt(o.invest * o.pct_t1 / 100 * lots)),
     fmt(o.invest * o.pct_t1 / 100 * lots));

  for (const d of ['10', '50', '100']) {
    $('#azd-calc-deploy').value = d;
    $('#azd-calc-deploy').dispatchEvent(new window.Event('change'));
    const n = Math.floor(200000 * (+d) / 100 / o.invest);
    ok('deployment ' + d + '% -> ' + n + ' lots',
       $('#azd-calc-out').textContent.includes(n + ' lot'));
  }
  $('#azd-calc-deploy').value = '25';
  $('#azd-calc-deploy').dispatchEvent(new window.Event('change'));

  seg('azd-calc-market-seg', 'niftyopt');
  const nOut = $('#azd-calc-out').textContent.replace(/\s+/g, ' ');
  const nifty = D.options[model].pure[PER]['NIFTY 50'];
  const nlots = Math.floor(200000 * dep() / 100 / nifty.invest);
  ok('NIFTY-options view uses NIFTY premiums, not the stock it replaced',
     nOut.includes(nlots + ' lot') && nOut.includes(fmt(nifty.invest)),
     nlots + ' lots × ' + fmt(nifty.invest));
  ok('NIFTY-options T1 ₹ matches',
     nOut.includes(fmt(nifty.invest * nifty.pct_t1 / 100 * nlots)),
     fmt(nifty.invest * nifty.pct_t1 / 100 * nlots));
  ok('instrument dropdown hidden on the NIFTY view',
     $('#azd-calc-instr-field').style.display === 'none');
  ok('futures IS offered as a fourth view (re-added on request)',
     [...$('#azd-calc-market-seg').querySelectorAll('button')]
       .some(b => b.dataset.v === 'futures'));
  ok('NIFTY detected on the index, with full history explained',
     (seg('azd-market-seg', 'niftyopt'),
      $('#azd-board-note').textContent.includes('settle on the index')));
  ok('NIFTY option sample is now a real year+, not ~40 trades',
     D.options[model].pure[PER]['NIFTY 50'].n > 150,
     D.options[model].pure[PER]['NIFTY 50'].n + ' trades');

  console.log('\n— guardrails —');
  amt.value = '5000';
  amt.dispatchEvent(new window.Event('input'));
  ok('tiny capital → shows a warning, not a fantasy number',
     $('#azd-calc-out').textContent.includes('does not cover a single lot'));

  console.log('\n— options now have a cost-adjusted twin —');
  seg('azd-market-seg', 'niftyopt');
  seg('azd-scoring-seg', 'pure');
  const optPure = $('#azd-kpis').textContent;
  seg('azd-scoring-seg', 'honest');
  const optHonest = $('#azd-kpis').textContent;
  ok('options pure ≠ options after costs', optPure !== optHonest);
  ok('option cost basis is stated', $('#azd-board-note').textContent.includes('of premium per round trip'));
  const pw = D.options[model].pure[PER]['NIFTY 50'].win_pct;
  const hw = D.options[model].honest[PER]['NIFTY 50'].win_pct;
  ok('after-costs win rate is lower', hw < pw, pw + '% -> ' + hw + '%');
  ok('no "no after-costs option book" message remains',
     !$('#azd-calc-out').textContent.includes('no after-costs option book'));
  seg('azd-scoring-seg', 'pure');
  seg('azd-market-seg', 'stocks');

  console.log('\n— new: period selector, futures tab, win streak —');
  ok('period list exported', Array.isArray(D.periods) && D.periods.length >= 3,
     (D.periods || []).join('/'));
  seg('azd-market-seg', 'stocks');
  seg('azd-scoring-seg', 'honest');
  const kpiFor = p => { seg('azd-period-seg', p); return $('#azd-kpis').textContent; };
  const k1 = kpiFor('1M'), kAll = kpiFor('All');
  ok('switching period changes the board', k1 !== kAll);
  ok('period is named in the board note',
     (seg('azd-period-seg', '3M'), $('#azd-board-note').textContent.includes('last 3M')));
  seg('azd-period-seg', 'All');
  ok('win streak shown', $('#azd-kpis').textContent.includes('best winning run'));
  ok('loss streak still shown', $('#azd-kpis').textContent.includes('worst losing run'));
  const eh = D.models[model].equity.honest;
  ok('1M trade count < all-time', eh['1M'].overall.entries < eh.All.overall.entries,
     eh['1M'].overall.entries + ' vs ' + eh.All.overall.entries);
  ok('win streak >= loss streak all-time',
     eh.All.overall.max_win_streak >= eh.All.overall.max_loss_streak,
     eh.All.overall.max_win_streak + ' vs ' + eh.All.overall.max_loss_streak);
  seg('azd-market-seg', 'futures');
  const fTxt = $('#azd-kpis').textContent + $('#azd-board-note').textContent;
  ok('futures tab renders', fTxt.includes('futures trades') && fTxt.includes('margin per lot'));
  ok('futures carries an explicit caution',
     $('#azd-board-note').textContent.includes('do not recommend this'));
  ok('futures table has a row', $('#azd-table').querySelectorAll('tbody tr').length === 1);
  seg('azd-market-seg', 'stocks');
  seg('azd-scoring-seg', 'pure');

  console.log('\n— risk of ruin —');
  seg('azd-scoring-seg', 'honest');
  seg('azd-calc-market-seg', 'options');
  $('#azd-calc-instrument').value = 'MARUTI';
  $('#azd-calc-instrument').dispatchEvent(new window.Event('change'));
  $('#azd-calc-deploy').value = '100';
  $('#azd-calc-deploy').dispatchEvent(new window.Event('change'));
  amt.value = '10000'; amt.dispatchEvent(new window.Event('input'));
  const ruinTxt = () => $('#azd-calc-out').textContent.replace(/\s+/g, ' ');

  /* Independently re-derive the wipe-out sequence from the JSON. */
  const om = D.options[model].honest[PER]['MARUTI'];
  const eqm = D.models[model].equity.honest[PER].per_instrument['MARUTI'];
  let cap = 10000, stops = 0;
  while (stops < 200) {
    const lots = Math.floor(cap / om.invest);
    if (lots < 1) break;
    cap -= lots * om.invest * Math.abs(om.pct_sl / 100);
    stops++;
  }
  ok('ruin panel is shown', ruinTxt().includes('losing run'));
  ok('stops-to-ruin matches an independent simulation',
     ruinTxt().includes('finished after ' + stops), stops + ' stops');
  ok('remaining balance matches', ruinTxt().includes(fmt(cap)), fmt(cap));
  ok('observed losing streak is quoted',
     ruinTxt().includes(eqm.max_loss_streak + ' in a row'),
     eqm.max_loss_streak + ' in a row');
  ok('flagged fatal because the streak exceeds what the account survives',
     stops <= eqm.max_loss_streak &&
     ruinTxt().includes('does not survive a losing run'));
  ok('and the annual figure is explicitly disowned',
     ruinTxt().includes('would not have lived to complete'));
  ok('an implausible rate is called out whatever the reinvest setting',
     ruinTxt().includes('This rate cannot persist'));

  amt.value = '200000'; amt.dispatchEvent(new window.Event('input'));
  seg('azd-calc-market-seg', 'stocks');
  ok('a sane stock configuration is not flagged fatal',
     !ruinTxt().includes('does not survive a losing run'));
  ok('...but still states what the streak costs',
     /leaves you with ₹[\d,]+ — \d+% of what you started/.test(ruinTxt()));
  $('#azd-calc-deploy').value = '25';
  $('#azd-calc-deploy').dispatchEvent(new window.Event('change'));

  console.log('\n— NIFTY futures in the calculator —');
  seg('azd-scoring-seg', 'honest');       // be explicit — the board is shared state
  seg('azd-calc-market-seg', 'futures');
  amt.value = '1000000'; amt.dispatchEvent(new window.Event('input'));
  const fpure = D.models[model].futures.honest[PER];
  const flots = Math.floor(1000000 / fpure.margin_per_lot);
  const fOut = () => $('#azd-calc-out').textContent.replace(/\s+/g, ' ');
  ok('futures lots sized off margin', fOut().includes(flots + ' lot'),
     flots + ' lots x ' + fmt(fpure.margin_per_lot));
  ok('futures T1 rupees match', fOut().includes(fmt(fpure.rs_at_t1 * flots)),
     fmt(fpure.rs_at_t1 * flots));
  ok('futures SL rupees match', fOut().includes(fmt(fpure.rs_at_sl * flots)));
  ok('deployment % hidden for futures',
     $('#azd-calc-deploy-field').style.display === 'none');
  ok('instrument dropdown hidden for futures',
     $('#azd-calc-instr-field').style.display === 'none');
  ok('ruin panel sizes futures by margin, consistent with the scenario card',
     fOut().includes(flots + ' lot') &&
     fOut().includes(fmt(fpure.rs_at_sl * flots)),
     flots + ' lots, stop ' + fmt(fpure.rs_at_sl * flots));
  ok('futures has its own rupee path',
     !!((D.paths[model].pure.futures || {})['NIFTY 50'] || []).length,
     ((D.paths[model].pure.futures || {})['NIFTY 50'] || []).length + ' sessions');
  amt.value = '100000'; amt.dispatchEvent(new window.Event('input'));
  ok('under one lot of margin -> explicit warning, no fantasy number',
     fOut().includes('cannot be sized below one lot'));
  amt.value = '200000'; amt.dispatchEvent(new window.Event('input'));
  seg('azd-calc-market-seg', 'stocks');

  console.log('\n— the compounding ceiling —');
  amt.value = '200000'; amt.dispatchEvent(new window.Event('input'));
  seg('azd-calc-market-seg', 'niftyopt');
  $('#azd-calc-deploy').value = '100';
  $('#azd-calc-deploy').dispatchEvent(new window.Event('change'));
  seg('azd-compound-seg', 'monthly');
  const blown = $('#azd-calc-out').textContent.replace(/\s+/g, ' ');
  ok('implausible monthly rate suppresses compounding',
     blown.includes('Compounding is switched off for this selection'));
  ok('...and no absurd crore figure is printed', !/₹\d{3,}(\.\d+)? Cr/.test(blown));
  seg('azd-compound-seg', 'none');
  $('#azd-calc-deploy').value = '25';
  $('#azd-calc-deploy').dispatchEvent(new window.Event('change'));
  seg('azd-calc-market-seg', 'stocks');
  seg('azd-calc-market-seg', 'stocks');
  ok('risk warning always present',
     $('#azd-calc-out').textContent.includes('The same maths runs in reverse'));
  ok('loss side quantified',
     /\d+\.\d% of trades hit the stop/.test($('#azd-calc-out').textContent));

  console.log('\n' + (fails ? fails + ' FAILED of ' + checks : 'all ' + checks + ' checks passed'));
  process.exit(fails ? 1 : 0);
}, 200);
