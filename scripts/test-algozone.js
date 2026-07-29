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
  for (const m of ['options', 'niftyopt', 'stocks']) {
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
  for (const [id, vals] of [['azd-market-seg', ['options', 'niftyopt', 'stocks']],
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
  const e = D.models[model].equity.pure.overall;
  const unit = 200000 / 2;
  const expT1 = unit * e.pct_at_t1 / 100;
  const expSL = unit * e.pct_at_sl / 100;
  const tpd = Math.min(e.trades_per_session, 2);
  const expDay = unit * (e.avg_pct_trade / 100) * tpd;
  const expMonth = expDay * 21;
  const rupees = s => [...s.matchAll(/[−-]?₹[\d,]+(?:\.\d+)?(?:\s?[LC]r?)?/g)].map(m => m[0]);
  const out = $('#azd-calc-out').textContent.replace(/\s+/g, ' ');
  const fmt = v => (v < 0 ? '−₹' : '₹') + Math.abs(Math.round(v)).toLocaleString('en-IN');
  ok('T1 scenario ₹ matches', out.includes(fmt(expT1)), fmt(expT1));
  ok('SL scenario ₹ matches', out.includes(fmt(expSL)), fmt(expSL));

  const compact = v => {
    const n = Math.abs(v), s = v < 0 ? '−₹' : '₹';
    if (n >= 1e7) return s + (n / 1e7).toFixed(2) + ' Cr';
    if (n >= 1e5) return s + (n / 1e5).toFixed(2) + ' L';
    return s + Math.round(n).toLocaleString('en-IN');
  };
  ok('daily ₹ matches', out.includes(compact(expDay)), compact(expDay));
  ok('monthly ₹ matches', out.includes(compact(expMonth)), compact(expMonth));

  console.log('\n— compounding —');
  const before = $('#azd-calc-out').textContent;
  seg('azd-compound-seg', 'monthly');
  const after = $('#azd-calc-out').textContent;
  ok('monthly compounding changes the annual figure', before !== after);
  ok('monthly label shown', after.includes('compounded monthly'));
  const r = expMonth / 200000;
  const compYear = 200000 * (Math.pow(1 + r, 12) - 1);
  ok('compounded-monthly annual matches',
     after.replace(/\s+/g, ' ').includes(compact(compYear)), compact(compYear));

  seg('azd-compound-seg', 'daily');
  const daily = $('#azd-calc-out').textContent.replace(/\s+/g, ' ');
  const d = expDay / 200000;
  const dYear = 200000 * (Math.pow(1 + d, 21 * 12) - 1);
  ok('daily label shown', daily.includes('compounded daily'));
  ok('compounded-daily annual matches', daily.includes(compact(dYear)), compact(dYear));
  ok('daily compounding carries its own warning',
     daily.includes('Daily compounding is a maths exercise'));
  seg('azd-compound-seg', 'none');

  console.log('\n— options & futures calculators —');
  seg('azd-calc-market-seg', 'options');
  const oSel = $('#azd-calc-instrument');
  ok('stock-options list excludes the index', oSel.options.length >= 10
     && ![...oSel.options].some(x => x.value === 'NIFTY 50'),
     oSel.options.length + ' stocks');
  oSel.value = 'MARUTI';
  oSel.dispatchEvent(new window.Event('change'));
  const o = D.options[model].pure['MARUTI'];
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
  const nifty = D.options[model].pure['NIFTY 50'];
  const nlots = Math.floor(200000 * dep() / 100 / nifty.invest);
  ok('NIFTY-options view uses NIFTY premiums, not the stock it replaced',
     nOut.includes(nlots + ' lot') && nOut.includes(fmt(nifty.invest)),
     nlots + ' lots × ' + fmt(nifty.invest));
  ok('NIFTY-options T1 ₹ matches',
     nOut.includes(fmt(nifty.invest * nifty.pct_t1 / 100 * nlots)),
     fmt(nifty.invest * nifty.pct_t1 / 100 * nlots));
  ok('instrument dropdown hidden on the NIFTY view',
     $('#azd-calc-instr-field').style.display === 'none');
  ok('no futures trading view remains',
     ![...$('#azd-calc-market-seg').querySelectorAll('button')]
       .some(b => b.dataset.v === 'futures'));
  ok('futures chart explained as signal source only, on the board',
     (seg('azd-market-seg', 'niftyopt'),
      $('#azd-board-note').textContent.includes('signal source only')));

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
  const pw = D.options[model].pure['NIFTY 50'].win_pct;
  const hw = D.options[model].honest['NIFTY 50'].win_pct;
  ok('after-costs win rate is lower', hw < pw, pw + '% -> ' + hw + '%');
  ok('no "no after-costs option book" message remains',
     !$('#azd-calc-out').textContent.includes('no after-costs option book'));
  seg('azd-scoring-seg', 'pure');
  seg('azd-market-seg', 'stocks');

  console.log('\n— daily vs monthly compounding must differ —');
  seg('azd-calc-market-seg', 'stocks');
  amt.value = '200000'; amt.dispatchEvent(new window.Event('input'));
  seg('azd-compound-seg', 'monthly');
  const yM = $('#azd-calc-out').textContent.match(/Per year[^₹]*(₹[\d.,]+ ?[LC]?r?)/);
  seg('azd-compound-seg', 'daily');
  const yD = $('#azd-calc-out').textContent.match(/Per year[^₹]*(₹[\d.,]+ ?[LC]?r?)/);
  ok('annual figure changes between monthly and daily compounding',
     yM && yD && yM[1] !== yD[1], (yM && yM[1]) + ' vs ' + (yD && yD[1]));
  seg('azd-compound-seg', 'none');
  const yN = $('#azd-calc-out').textContent.match(/Per year[^₹]*(₹[\d.,]+ ?[LC]?r?)/);
  ok('and again with no compounding', yN && yN[1] !== yM[1] && yN[1] !== yD[1],
     yN && yN[1]);

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
