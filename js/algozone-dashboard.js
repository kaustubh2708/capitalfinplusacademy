/* ==================================================================
   Capital Finplus Academy — Algozone performance dashboard
   Reads /data/algo-stats.json (written by the CFA Structure Engine's
   `python3 -m structure_engine.export_public`) and renders:
     1. the performance board  — stocks / options / NIFTY futures
     2. the return calculator  — T1 / T2 / stop-loss, day → month → year
   Everything here is BACKTESTED history. Nothing is a forecast.
   ================================================================== */
(function () {
  'use strict';

  var DATA = null;
  var TRADING_DAYS_PER_MONTH = 21;   // NSE averages ~21 sessions a month
  var MONTHS = 12;

  /* Current view state */
  var S = {
    model: 'v2',
    scoring: 'pure',       // 'pure' | 'honest'
    market: 'stocks',      // 'stocks' | 'options' | 'niftyopt' | 'futures'
    period: '1Y',          // 1M | 3M | 6M | 1Y | All
    sortKey: null,
    sortAsc: false
  };

  /* Calculator state */
  var C = {
    amount: 100000,
    market: 'stocks',
    instrument: 'PORTFOLIO',
    concurrent: 2,
    deploy: 25,           // % of capital put into any one option trade
    compound: 'none'      // 'none' | 'monthly' | 'daily'
  };

  /* ---------------------------------------------------------------
     Formatting helpers
     --------------------------------------------------------------- */
  function inr(v, decimals) {
    if (v == null || isNaN(v)) return '—';
    var neg = v < 0;
    var n = Math.abs(v);
    var s;
    if (decimals) {
      s = n.toLocaleString('en-IN', { maximumFractionDigits: decimals });
    } else if (n >= 10000000) {
      s = (n / 10000000).toFixed(2) + ' Cr';
    } else if (n >= 100000) {
      s = (n / 100000).toFixed(2) + ' L';
    } else {
      s = Math.round(n).toLocaleString('en-IN');
    }
    return (neg ? '−₹' : '₹') + s;
  }
  function inrExact(v) {
    if (v == null || isNaN(v)) return '—';
    return (v < 0 ? '−₹' : '₹') + Math.abs(Math.round(v)).toLocaleString('en-IN');
  }
  function pct(v, d) {
    if (v == null || isNaN(v)) return '—';
    return (v >= 0 ? '+' : '') + v.toFixed(d == null ? 1 : d) + '%';
  }
  function cls(v) { return v >= 0 ? 'azd-pos' : 'azd-neg'; }
  function el(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* ---------------------------------------------------------------
     Data accessors
     --------------------------------------------------------------- */
  function equityBlock(scoring, period) {
    var m = DATA.models[S.model];
    if (!m || !m.equity) return null;
    var byPeriod = m.equity[scoring || S.scoring] || {};
    return byPeriod[period || S.period] || byPeriod.All || null;
  }
  var NIFTY = 'NIFTY 50';

  /* All option economics live in one block. The two option VIEWS are just
     filters on it: "Stock Options" is every name except the index, "NIFTY
     Options" is the index alone — whose signals are detected on the NIFTY
     FUTURES chart and executed as ATM CE/PE. */
  function optionsBlock(model, scoring, period) {
    var m = (DATA.options || {})[model || S.model] || {};
    var byMode = m[scoring || S.scoring] || m.pure || {};
    return byMode[period || S.period] || byMode.All || {};
  }
  function optionNames(market, scoring) {
    var all = Object.keys(optionsBlock(null, scoring, 'All'));
    if (market === 'niftyopt') return all.filter(function (n) { return n === NIFTY; });
    return all.filter(function (n) { return n !== NIFTY; });
  }
  function futuresBlock(model, scoring, period) {
    var m = DATA.models[model || S.model];
    if (!m || !m.futures) return null;
    var byPeriod = m.futures[scoring || S.scoring] || {};
    return byPeriod[period || S.period] || byPeriod.All || null;
  }

  /* Rows for the performance table, normalised across the three markets so
     the table/chart code does not care which one is selected. */
  function rows() {
    var out = [];
    if (S.market === 'options' || S.market === 'niftyopt') {
      var ob = optionsBlock();
      optionNames(S.market).forEach(function (name) {
        var o = ob[name];
        out.push({
          name: name, n: o.n, win: o.win_pct, lot: o.lot,
          invest: o.invest, at_t1: o.pct_t1, at_t2: o.pct_t2, at_sl: o.pct_sl,
          per: o.avg_rs, total: o.total_rs, unit: '₹/lot'
        });
      });
    } else if (S.market === 'futures') {
      var fb = futuresBlock();
      if (fb && fb.n) {
        out.push({
          name: 'NIFTY 50 futures', n: fb.n, lot: fb.lot,
          invest: fb.margin_per_lot, at_t1: fb.rs_at_t1, at_t2: fb.rs_at_t2,
          at_sl: fb.rs_at_sl, per: fb.avg_rs, total: fb.total_rs, rupees: true
        });
      }
    } else {
      var eb = equityBlock();
      if (!eb) return out;
      var per = eb.per_instrument || {};
      Object.keys(per).forEach(function (name) {
        var e = per[name];
        if (!e.entries) return;
        out.push({
          name: name, n: e.entries, win: e.t1_rate, t2: e.t2_rate,
          stop: e.stop_rate, r: e.r_per_trade, pf: e.profit_factor,
          dd: e.max_dd_r, at_t1: e.pct_at_t1, at_t2: e.pct_at_t2,
          at_sl: e.pct_at_sl, per: e.avg_pct_trade, total: e.total_r
        });
      });
    }
    return out;
  }

  /* ---------------------------------------------------------------
     Performance board
     --------------------------------------------------------------- */
  var COLS = {
    stocks: [
      ['name', 'Instrument'], ['n', 'Trades'], ['win', 'T1 hit'],
      ['t2', 'T2 hit'], ['stop', 'Stopped'], ['at_t1', 'Gain at T1'],
      ['at_t2', 'Gain at T2'], ['at_sl', 'Loss at SL'],
      ['per', 'Avg / trade'], ['pf', 'Profit factor'], ['dd', 'Max DD']
    ],
    options: [
      ['name', 'Instrument'], ['n', 'Trades'], ['win', 'Win rate'],
      ['lot', 'Lot'], ['invest', '₹ / lot'], ['at_t1', 'At T1'],
      ['at_t2', 'At T2'], ['at_sl', 'At SL'], ['per', 'Avg ₹ / trade'],
      ['total', 'Total ₹']
    ],
    niftyopt: [
      ['name', 'Instrument'], ['n', 'Trades'], ['win', 'Win rate'],
      ['lot', 'Lot'], ['invest', '₹ / lot'], ['at_t1', 'At T1'],
      ['at_t2', 'At T2'], ['at_sl', 'At SL'], ['per', 'Avg ₹ / trade'],
      ['total', 'Total ₹']
    ],
    futures: [
      ['name', 'Instrument'], ['n', 'Trades'], ['lot', 'Lot'],
      ['invest', 'Margin / lot'], ['at_t1', '₹ at T1'], ['at_t2', '₹ at T2'],
      ['at_sl', '₹ at SL'], ['per', 'Avg ₹ / trade'], ['total', 'Total ₹']
    ]
  };

  function cell(r, key) {
    var v = r[key];
    if (key === 'name') return esc(v);
    if (v == null) return '<span class="azd-mut">—</span>';
    if (key === 'n' || key === 'lot') return v.toLocaleString('en-IN');
    if (key === 'invest') return inrExact(v);
    if (S.market === 'stocks') {
      if (key === 'win' || key === 't2') return v.toFixed(1) + '%';
      if (key === 'stop') return '<span class="azd-neg">' + v.toFixed(1) + '%</span>';
      if (key === 'at_t1' || key === 'at_t2') return '<span class="azd-pos">' + pct(v, 2) + '</span>';
      if (key === 'at_sl') return '<span class="azd-neg">' + pct(v, 2) + '</span>';
      if (key === 'per') return '<span class="' + cls(v) + '">' + pct(v, 3) + '</span>';
      if (key === 'pf') return v.toFixed(2);
      if (key === 'dd') return '<span class="azd-neg">' + v.toFixed(1) + 'R</span>';
    } else {
      if (key === 'win') return v.toFixed(1) + '%';
      if (key === 'at_t1' || key === 'at_t2') {
        return '<span class="azd-pos">' + (r.rupees ? inrExact(v) : pct(v)) + '</span>';
      }
      if (key === 'at_sl') {
        return '<span class="azd-neg">' + (r.rupees ? inrExact(v) : pct(v)) + '</span>';
      }
      if (key === 'per' || key === 'total') {
        return '<span class="' + cls(v) + '">' + inrExact(v) + '</span>';
      }
    }
    return String(v);
  }

  function renderTable() {
    var rs = rows();
    var cols = COLS[S.market];
    if (S.sortKey) {
      rs.sort(function (a, b) {
        var x = a[S.sortKey], y = b[S.sortKey];
        if (typeof x === 'string') return S.sortAsc ? x.localeCompare(y) : y.localeCompare(x);
        if (x == null) return 1;
        if (y == null) return -1;
        return S.sortAsc ? x - y : y - x;
      });
    }
    var h = '<thead><tr>' + cols.map(function (c) {
      var sorted = S.sortKey === c[0] ? ' data-sorted="' + (S.sortAsc ? 'asc' : 'desc') + '"' : '';
      return '<th data-k="' + c[0] + '"' + sorted + '>' + c[1] + '</th>';
    }).join('') + '</tr></thead><tbody>';
    if (!rs.length) {
      h += '<tr><td colspan="' + cols.length + '" class="azd-mut" style="text-align:center;padding:2rem">' +
           'No trades for this combination.</td></tr>';
    }
    h += rs.map(function (r) {
      return '<tr>' + cols.map(function (c) {
        return '<td>' + cell(r, c[0]) + '</td>';
      }).join('') + '</tr>';
    }).join('') + '</tbody>';
    var t = el('azd-table');
    t.innerHTML = h;
    Array.prototype.forEach.call(t.querySelectorAll('th'), function (th) {
      th.addEventListener('click', function () {
        var k = th.getAttribute('data-k');
        if (S.sortKey === k) S.sortAsc = !S.sortAsc;
        else { S.sortKey = k; S.sortAsc = false; }
        renderTable();
      });
    });
  }

  function renderKpis() {
    var k = [];
    if (S.market === 'stocks') {
      var o = (equityBlock() || {}).overall || {};
      k = [
        [o.entries != null ? o.entries.toLocaleString('en-IN') : '—', 'trades taken', ''],
        [(o.t1_rate || 0).toFixed(1) + '%', 'reached target 1', 'pos'],
        [(o.t2_rate || 0).toFixed(1) + '%', 'reached target 2', 'pos'],
        [(o.stop_rate || 0).toFixed(1) + '%', 'stopped out', 'neg'],
        [pct(o.avg_pct_trade, 3), 'avg per trade', o.avg_pct_trade >= 0 ? 'pos' : 'neg'],
        [(o.profit_factor || 0).toFixed(2), 'profit factor', ''],
        [(o.max_dd_r || 0).toFixed(1) + 'R', 'worst drawdown', 'neg'],
        [(o.max_win_streak || 0) + ' in a row', 'best winning run', 'pos'],
        [(o.max_loss_streak || 0) + ' in a row', 'worst losing run', 'neg']
      ];
    } else if (S.market === 'futures') {
      var f = futuresBlock() || {};
      k = [
        [(f.n || 0).toLocaleString('en-IN'), 'futures trades', ''],
        [(f.lot || 65), 'lot size', ''],
        [inrExact(f.margin_per_lot), 'margin per lot', ''],
        [inrExact(f.rs_at_t1), 'per lot at T1', 'pos'],
        [inrExact(f.rs_at_t2), 'per lot at T2', 'pos'],
        [inrExact(f.rs_at_sl), 'per lot at stop', 'neg'],
        [inrExact(f.avg_rs), 'avg per trade', (f.avg_rs || 0) >= 0 ? 'pos' : 'neg'],
        [inr(f.total_rs), 'total on 1 lot', (f.total_rs || 0) >= 0 ? 'pos' : 'neg']
      ];
    } else if (S.market === 'options' || S.market === 'niftyopt') {
      var ob = optionsBlock(), names = optionNames(S.market);
      var n = 0, tot = 0, wsum = 0, inv = 0, t1 = 0, sl = 0;
      names.forEach(function (x) {
        var o = ob[x];
        n += o.n; tot += o.total_rs; wsum += o.win_pct; inv += o.invest;
        t1 += o.pct_t1; sl += o.pct_sl;
      });
      var c = names.length || 1;
      k = [
        [n.toLocaleString('en-IN'), 'option trades', ''],
        [(wsum / c).toFixed(1) + '%', c > 1 ? 'avg win rate' : 'win rate', 'pos'],
        [inrExact(inv / c), c > 1 ? 'avg ₹ per lot' : '₹ per lot', ''],
        [pct(t1 / c), 'premium gain at T1', 'pos'],
        [pct(sl / c), 'premium loss at SL', 'neg'],
        [inr(tot), c > 1 ? 'total on 1 lot each' : 'total on 1 lot',
         tot >= 0 ? 'pos' : 'neg']
      ];
    }
    el('azd-kpis').innerHTML = k.map(function (x) {
      return '<div class="azd-kpi"><div class="azd-kpi-n ' + x[2] + '">' + x[0] +
             '</div><div class="azd-kpi-l">' + x[1] + '</div></div>';
    }).join('');
  }

  /* Horizontal bar chart — no charting library, just SVG. */
  function renderChart() {
    var rs = rows();
    var metric, label, fmt;
    if (S.market === 'stocks') {
      metric = 'win'; label = '% of trades that reached Target 1';
      fmt = function (v) { return v.toFixed(1) + '%'; };
    } else {
      metric = 'per';
      label = S.market === 'niftyopt'
        ? 'Average ₹ per trade, on one NIFTY option lot'
        : S.market === 'futures'
        ? 'Average ₹ per trade, on one NIFTY futures lot'
        : 'Average ₹ per trade, on one option lot';
      fmt = inrExact;
    }
    rs = rs.filter(function (r) { return r[metric] != null; })
           .sort(function (a, b) { return b[metric] - a[metric]; });
    if (!rs.length) { el('azd-chart').innerHTML = ''; return; }

    var rowH = 26, padT = 26, padB = 28, padL = 132, padR = 62;
    var W = 860, H = padT + padB + rs.length * rowH;
    var vals = rs.map(function (r) { return r[metric]; });
    var max = Math.max.apply(null, vals.concat([0]));
    var min = Math.min.apply(null, vals.concat([0]));
    var span = (max - min) || 1;
    var plotW = W - padL - padR;
    var x0 = padL + (0 - min) / span * plotW;   // where zero sits

    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' +
              esc(label) + '">';
    svg += '<text x="' + padL + '" y="14" class="azd-vlabel">' + esc(label) + '</text>';
    svg += '<line class="azd-axis" x1="' + x0 + '" y1="' + (padT - 6) +
           '" x2="' + x0 + '" y2="' + (H - padB + 4) + '"/>';

    rs.forEach(function (r, i) {
      var y = padT + i * rowH;
      var v = r[metric];
      var xv = padL + (v - min) / span * plotW;
      var bx = Math.min(x0, xv), bw = Math.max(Math.abs(xv - x0), 1.5);
      var colour = v >= 0 ? '#F4C20D' : '#f87171';
      svg += '<text x="' + (padL - 10) + '" y="' + (y + 13) +
             '" class="azd-tick" text-anchor="end">' + esc(r.name) + '</text>';
      svg += '<rect class="azd-bar" x="' + bx + '" y="' + (y + 4) + '" width="' + bw +
             '" height="' + (rowH - 11) + '" rx="3" fill="' + colour +
             '" fill-opacity="' + (v >= 0 ? 0.78 : 0.7) + '"><title>' +
             esc(r.name) + ': ' + fmt(v) + ' · ' + r.n + ' trades</title></rect>';
      svg += '<text x="' + (Math.max(xv, x0) + 8) + '" y="' + (y + 13) +
             '" class="azd-tick">' + esc(fmt(v)) + '</text>';
    });
    svg += '<text x="' + x0 + '" y="' + (H - padB + 18) +
           '" class="azd-tick" text-anchor="middle">0</text>';
    svg += '</svg>';
    el('azd-chart').innerHTML = svg;
  }

  function renderBoardNote() {
    var m = DATA.models[S.model] || {};
    var w = DATA.window || {};
    var spi = w.sessions_per_instrument || {};
    var depths = Object.keys(spi).map(function (k) { return spi[k]; });
    var range = depths.length
      ? ' — ' + Math.min.apply(null, depths) + '–' + Math.max.apply(null, depths) +
        ' sessions per instrument'
      : '';
    var isOpt = S.market === 'options' || S.market === 'niftyopt';
    var pLabel = S.period === 'All' ? 'the full window' : 'the last ' + S.period;
    var on = optionNames(S.market);
    var ob0 = optionsBlock();
    var osess = on.length && ob0[on[0]] ? ob0[on[0]].sessions : w.sessions;
    var sample = isOpt
      ? osess + ' sessions × ' + on.length +
        ' instrument' + (on.length === 1 ? '' : 's')
      : (w.sessions || '—') + ' sessions (' + w.from + ' → ' + w.to + ')' + range;
    var note = S.scoring === 'pure' ? DATA.scoring_note.pure : DATA.scoring_note.honest;
    var how = '';
    if (S.market === 'niftyopt') {
      how = (S.scoring === 'honest' && DATA.options_cost_pct
        ? '<br><strong>Option costs applied:</strong> ' + DATA.options_cost_pct +
          '% of premium per round trip — brokerage, STT and one tick of spread. ' +
          'Realistic for NIFTY at-the-money strikes.'
        : '') +
        '<br><strong>How this is traded:</strong> the structure is detected on the ' +
            'NIFTY index and the trade is a bought at-the-money CE or PE, held intraday. ' +
            'NIFTY options settle on the index, so the index is the correct signal ' +
            'source — and unlike the futures series it carries the full history behind ' +
            'these numbers.';
    } else if (S.market === 'futures') {
      how = '<br><strong>How this is traded:</strong> one NIFTY futures lot per signal. ' +
            '<strong>We do not recommend this</strong> — futures losses are not capped at ' +
            'the margin you post, and one lot needs about ' +
            inrExact((futuresBlock() || {}).margin_per_lot) + '. It is shown because you ' +
            'asked to see it, and because it is the reference the option numbers are ' +
            'derived from. Read the futures section of the risk notes below first.';
    } else if (S.market === 'options') {
      how = (S.scoring === 'honest' && DATA.options_cost_pct
        ? '<br><strong>Option costs applied:</strong> ' + DATA.options_cost_pct +
          '% of premium per round trip — brokerage, STT and one tick of spread. ' +
          'Real stock-option spreads are frequently wider than this.'
        : '') +
        '<br><strong>How this is traded:</strong> each signal is one bought ' +
        'at-the-money CE or PE on that stock, held intraday.';
    }
    el('azd-board-note').innerHTML =
      '<strong>' + esc(S.model) + '</strong> — ' + esc(m.label || '') +
      '<br>Window: <strong>' + esc(pLabel) + '</strong> · Sample: ' + esc(sample) +
      '. ' + esc(note) + how;
  }

  function renderBoard() {
    renderKpis();
    renderChart();
    renderTable();
    renderBoardNote();
  }

  /* ---------------------------------------------------------------
     Calculator
     --------------------------------------------------------------- */

  /* Build a normalised "what one trade does" profile for the chosen
     market + instrument. Everything downstream is market-agnostic. */
  function profile(scoring) {
    scoring = scoring || S.scoring;
    var p = {
      ok: false, unitCost: 0, units: 0, tradesPerDay: 0, n: 0,
      perTrade: 0, atT1: 0, atT2: null, atSL: 0,
      pT1only: 0, pT2: 0, pSL: 0, pFlat: 0,
      unitName: '', ddR: 0, streak: 0, note: ''
    };
    var W = DATA.window || {};
    var sessions = W.sessions || 1;
    /* Each instrument has its own archive depth — the NIFTY futures series is
       far shorter than the stock archives — so trade FREQUENCY must be divided
       by that instrument's own session count, not the union of all of them. */
    function sessionsFor(name) {
      return (W.sessions_per_instrument || {})[name] || sessions;
    }

    if (C.market === 'stocks') {
      var eb = equityBlock(scoring);
      if (!eb) return p;
      var e = C.instrument === 'PORTFOLIO'
        ? eb.overall
        : (eb.per_instrument || {})[C.instrument];
      if (!e || !e.entries) return p;
      var conc = Math.max(1, C.concurrent);
      p.unitCost = C.amount / conc;                 // deployed per position
      p.units = conc;
      /* You cannot take more trades in a day than you have slots for. */
      p.tradesPerDay = Math.min(e.trades_per_session, conc);
      p.rawTradesPerDay = e.trades_per_session;
      p.n = e.entries;
      p.perTrade = p.unitCost * (e.avg_pct_trade / 100);
      p.atT1 = p.unitCost * ((e.pct_at_t1 || 0) / 100);
      p.atT2 = e.pct_at_t2 == null ? null : p.unitCost * (e.pct_at_t2 / 100);
      p.atSL = p.unitCost * ((e.pct_at_sl || 0) / 100);
      p.pT2 = (e.t2_rate || 0) / 100;
      p.pT1only = Math.max(((e.t1_rate || 0) - (e.t2_rate || 0)) / 100, 0);
      p.pSL = (e.stop_rate || 0) / 100;
      p.ddR = e.max_dd_r; p.streak = e.max_loss_streak;
      p.unitName = conc + ' position' + (conc > 1 ? 's' : '') + ' of ' + inrExact(p.unitCost);
      p.ok = true;

    } else if (C.market === 'futures') {
      var f = futuresBlock(S.model, scoring);
      if (!f || !f.n) return p;
      p.unitCost = f.margin_per_lot || 165000;
      p.units = Math.floor(C.amount / p.unitCost);
      p.tradesPerDay = f.n / sessionsFor(NIFTY);
      p.rawTradesPerDay = p.tradesPerDay;
      p.n = f.n;
      p.perTrade = f.avg_rs;
      p.atT1 = f.rs_at_t1;
      p.atT2 = f.rs_at_t2;
      p.atSL = f.rs_at_sl;
      var fsrc = ((equityBlock(scoring) || {}).per_instrument || {})[NIFTY] || {};
      p.pT2 = (fsrc.t2_rate || 0) / 100;
      p.pT1only = Math.max(((fsrc.t1_rate || 0) - (fsrc.t2_rate || 0)) / 100, 0);
      p.pSL = (fsrc.stop_rate || 0) / 100;
      p.ddR = fsrc.max_dd_r; p.streak = fsrc.max_loss_streak;
      p.unitName = p.units + ' lot' + (p.units === 1 ? '' : 's') + ' x ' +
                   inrExact(p.unitCost) + ' margin = ' +
                   inrExact(p.units * p.unitCost) + ' posted';
      p.ok = p.units > 0;
      if (!p.ok) p.note = 'One NIFTY futures lot needs about ' +
                          inrExact(p.unitCost) + ' of margin, which is more than ' +
                          'the amount entered. Futures cannot be sized below one lot.';

    } else {
      var ob = optionsBlock(S.model, scoring);
      var name = C.market === 'niftyopt' ? NIFTY
        : (C.instrument === 'PORTFOLIO' ? optionNames('options', scoring)[0]
                                        : C.instrument);
      var o = ob[name];
      if (!o) return p;
      var odays = o.sessions || sessionsFor(name);
      /* Buying as many lots as the account allows puts 100% of capital into a
         single option trade — which is what produced a 43%-of-account stop.
         Size off a stated fraction instead. */
      var budget = C.amount * (C.deploy / 100);
      p.unitCost = o.invest;                        // premium × lot
      p.units = Math.floor(budget / o.invest);
      p.tradesPerDay = o.n / odays;
      p.rawTradesPerDay = p.tradesPerDay;
      p.n = o.n;
      p.perTrade = o.avg_rs;
      p.atT1 = o.invest * (o.pct_t1 / 100);
      p.atT2 = o.pct_t2 == null ? null : o.invest * (o.pct_t2 / 100);
      p.atSL = o.invest * (o.pct_sl / 100);
      /* The options board reports win% on realised P&L, not the T1/T2 split;
         reuse the equity outcome mix for the frequency column. */
      var eq = (equityBlock(scoring) || {}).per_instrument || {};
      var src = eq[name] || (equityBlock(scoring) || {}).overall || {};
      p.pT2 = (src.t2_rate || 0) / 100;
      p.pT1only = Math.max(((src.t1_rate || 0) - (src.t2_rate || 0)) / 100, 0);
      p.pSL = (src.stop_rate || 0) / 100;
      p.ddR = src.max_dd_r; p.streak = src.max_loss_streak;
      p.unitName = p.units + ' lot' + (p.units === 1 ? '' : 's') + ' × ' +
                   inrExact(o.invest) + ' = ' + inrExact(p.units * o.invest) +
                   ' per trade (' + C.deploy + '% of capital)';
      p.ok = p.units > 0;
      if (!p.ok) p.note = 'One lot of ' + name + ' costs about ' + inrExact(o.invest) +
                          ' in premium, and at ' + C.deploy + '% deployment this ' +
                          'amount does not cover a single lot. Increase the amount ' +
                          'or the deployment percentage.';

    }
    p.pFlat = Math.max(1 - p.pT1only - p.pT2 - p.pSL, 0);
    return p;
  }

  /* 95% confidence band on the average trade, from the outcome mix.
     This is the honest way to show "conservative / expected / optimistic":
     it is the statistical uncertainty in the measured average, not a
     guess about the future. */
  function band(p) {
    var xs = [p.atT1, p.atT2 == null ? p.atT1 : p.atT2, p.atSL, 0];
    var ps = [p.pT1only, p.pT2, p.pSL, p.pFlat];
    var mean = 0, m2 = 0, i;
    for (i = 0; i < 4; i++) { mean += ps[i] * xs[i]; m2 += ps[i] * xs[i] * xs[i]; }
    var varr = Math.max(m2 - mean * mean, 0);
    var se = p.n > 1 ? Math.sqrt(varr / p.n) : 0;
    return { half: 1.96 * se };
  }


  /* ---------------------------------------------------------------
     Real return paths

     Compounding is not "expected rate to the twelfth power". A real account
     starts each period with whatever the last one left it, and some periods
     lose money. These helpers walk the ACTUAL per-session sequence the
     backtest produced, so monthly and daily compounding mean what they say —
     and so the volatility drag a constant-rate model hides is included.
     --------------------------------------------------------------- */
  var SESSIONS_PER_YEAR = TRADING_DAYS_PER_MONTH * MONTHS;   // 252

  function fMargin() {
    var f = futuresBlock() || {};
    return f.margin_per_lot || 165000;
  }

  /* Per-session return as a fraction of TOTAL capital, given the sizing the
     user has chosen. The exported path is per-trade %, so it has to be scaled
     by how much of the account each trade actually uses. */
  function dailySeries(scoring) {
    var pk = ((DATA.paths || {})[S.model] || {})[scoring || S.scoring] || {};
    var kind = C.market === 'stocks' ? 'equity'
      : C.market === 'futures' ? 'futures' : 'options';
    var src = pk[kind] || {};
    var names;
    if (C.market === 'stocks') {
      names = C.instrument === 'PORTFOLIO' ? Object.keys(src) : [C.instrument];
    } else if (C.market === 'futures') {
      names = [NIFTY];
    } else {
      names = [C.market === 'niftyopt' ? NIFTY : C.instrument];
    }
    var byIdx = {};
    names.forEach(function (nm) {
      (src[nm] || []).forEach(function (e) {
        var b = byIdx[e[0]] || (byIdx[e[0]] = [0, 0]);
        b[0] += e[1];        /* summed per-trade % */
        b[1] += e[2];        /* trades that session */
      });
    });
    /* Clip to the window these instruments actually have data for. A month
       before an archive begins is not a flat month — it is not a month at all,
       and counting it as zero both dilutes the average and conceals real
       losing months (NIFTY's futures archive is only ~69 sessions deep). */
    var cov = DATA.coverage || {};
    var a = null, z = null;
    names.forEach(function (nm) {
      var c = cov[nm];
      if (!c) return;
      a = a === null ? c[0] : Math.min(a, c[0]);
      z = z === null ? c[1] : Math.max(z, c[1]);
    });
    var total = (DATA.dates || []).length;
    if (a === null) { a = 0; z = total - 1; }
    var N = z - a + 1;
    var out = new Array(N);
    for (var i = 0; i < N; i++) out[i] = 0;
    out.offset = a;
    Object.keys(byIdx).forEach(function (k) {
      var i = +k, sum = byIdx[k][0], n = byIdx[k][1], frac;
      if (C.market === 'futures') {
        /* the futures path is ₹ per ONE lot; scale by lots held and express as
           a fraction of the whole account (margin is the capital at risk) */
        var flots = Math.max(0, Math.floor(C.amount / (fMargin() || 1)));
        frac = sum * flots / C.amount * 100;
      } else if (C.market === 'stocks') {
        /* capital split into `concurrent` slots; you cannot take more trades
           in a day than you have slots, so scale the day down pro rata. */
        var slots = Math.max(1, C.concurrent);
        frac = sum * (Math.min(n, slots) / n) / slots;
      } else {
        /* each signal buys `deploy`% of the account, capped at 100% in total */
        var d = C.deploy / 100;
        frac = sum * (Math.min(n * d, 1) / n);
      }
      var j = i - a;
      if (j >= 0 && j < N) out[j] = frac / 100;
    });
    return out;
  }

  function _grow(arr) {                       /* compounded product − 1 */
    var v = 1;
    for (var i = 0; i < arr.length; i++) v *= (1 + arr[i]);
    return v - 1;
  }
  function _sum(arr) {
    var v = 0;
    for (var i = 0; i < arr.length; i++) v += arr[i];
    return v;
  }

  /* Everything the projection table needs, derived from the real path. */
  function pathStats(series, mode) {
    var N = series.length || 1;
    var dates = DATA.dates || [];
    var off = series.offset || 0;
    var order = [], buckets = {};
    for (var i = 0; i < N; i++) {
      var m = (dates[i + off] || '').slice(0, 7);
      if (!(m in buckets)) { buckets[m] = []; order.push(m); }
      buckets[m].push(series[i]);
    }
    var monthly = order.map(function (m) {
      return mode === 'daily' ? _grow(buckets[m]) : _sum(buckets[m]);
    });
    var dayAvg = _sum(series) / N;
    var monthAvg = monthly.length ? _sum(monthly) / monthly.length : 0;

    /* Annualise the way the chosen mode actually behaves. */
    var year;
    if (mode === 'none') {
      year = dayAvg * SESSIONS_PER_YEAR;
    } else if (mode === 'monthly') {
      var g = monthly.length
        ? Math.pow(Math.max(1 + _grow(monthly), 1e-9), 1 / monthly.length) - 1
        : 0;
      year = Math.pow(1 + g, MONTHS) - 1;
    } else {
      var gd = Math.pow(Math.max(1 + _grow(series), 1e-9), 1 / N) - 1;
      year = Math.pow(1 + gd, SESSIONS_PER_YEAR) - 1;
    }

    /* The band is now REAL: the best and worst twelve-month stretch that
       actually occurred, not a symmetric confidence interval. */
    var win = Math.min(SESSIONS_PER_YEAR, N), lo = null, hi = null;
    for (var a = 0; a + win <= N; a += 5) {
      var slice = series.slice(a, a + win);
      var v = mode === 'none' ? _sum(slice) : _grow(slice);
      if (lo === null || v < lo) lo = v;
      if (hi === null || v > hi) hi = v;
    }
    if (lo === null) { lo = year; hi = year; }

    return {
      dayAvg: dayAvg, monthAvg: monthAvg, year: year,
      monthLo: monthly.length ? Math.min.apply(null, monthly) : 0,
      monthHi: monthly.length ? Math.max.apply(null, monthly) : 0,
      yearLo: lo, yearHi: hi,
      months: monthly.length,
      negMonths: monthly.filter(function (v) { return v < 0; }).length,
      sessions: N,
      fullWindow: N >= SESSIONS_PER_YEAR
    };
  }


  /* ---------------------------------------------------------------
     MONTH-BY-MONTH P&L HEATMAP
     Same session path the calculator uses, in ₹ on the chosen capital,
     not compounded. One row per year: 12 months, total, the year's
     deepest peak-to-trough drop, and return / max drawdown.
     --------------------------------------------------------------- */
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function inrShort(v) {
    var n = Math.abs(v), s;
    if (n >= 10000000) s = (n / 10000000).toFixed(2) + 'Cr';
    else if (n >= 100000) s = (n / 100000).toFixed(2) + 'L';
    else if (n >= 1000) s = (n / 1000).toFixed(1) + 'k';
    else s = String(Math.round(n));
    return (v < 0 ? '−' : '') + s;
  }

  function renderMonthly() {
    var box = el('azd-monthly');
    if (!box) return;
    var series = dailySeries(), dates = DATA.dates || [], off = series.offset || 0;
    var years = {}, order = [];
    for (var i = 0; i < series.length; i++) {
      var d = dates[i + off] || '';
      var y = d.slice(0, 4), m = +d.slice(5, 7) - 1;
      if (!y || m < 0) continue;
      var Y = years[y];
      if (!Y) { Y = years[y] = { m: {}, cum: 0, peak: 0, dd: 0 }; order.push(y); }
      var v = series[i] * C.amount;
      Y.m[m] = (Y.m[m] || 0) + v;
      Y.cum += v;
      if (Y.cum > Y.peak) Y.peak = Y.cum;
      if (Y.cum - Y.peak < Y.dd) Y.dd = Y.cum - Y.peak;
    }

    var maxAbs = 0, green = 0, red = 0;
    order.forEach(function (y) {
      Object.keys(years[y].m).forEach(function (k) {
        var v = years[y].m[k];
        maxAbs = Math.max(maxAbs, Math.abs(v));
        if (v > 0) green++; else if (v < 0) red++;
      });
    });

    function cellHtml(v) {
      if (v == null) return '<td><span class="azd-hm azd-hm-empty"></span></td>';
      var a = maxAbs ? 0.12 + 0.6 * Math.abs(v) / maxAbs : 0.12;
      var rgb = v >= 0 ? '74,222,128' : '248,113,113';
      return '<td><span class="azd-hm" style="background:rgba(' + rgb + ',' + a.toFixed(2) +
        ')" title="' + inrExact(v) + ' · ' + pct(v / C.amount * 100) + '">' + inrShort(v) + '</span></td>';
    }

    var head = '<tr><th>Year</th>' + MON.map(function (m) { return '<th>' + m + '</th>'; }).join('') +
      '<th>Total</th><th>Max DD</th><th>R/MDD</th></tr>';
    var body = order.map(function (y) {
      var Y = years[y], cells = '';
      for (var m = 0; m < 12; m++) cells += cellHtml(Y.m[m]);
      var rmdd = Y.dd < 0 ? (Y.cum / -Y.dd).toFixed(1) : '—';
      return '<tr><td>' + y + '</td>' + cells +
        '<td class="' + cls(Y.cum) + '"><strong>' + inrShort(Y.cum) + '</strong></td>' +
        '<td class="azd-neg">' + (Y.dd < 0 ? inrShort(Y.dd) : '0') + '</td>' +
        '<td>' + rmdd + '</td></tr>';
    }).join('');

    box.innerHTML =
      '<div class="azd-tablewrap"><table class="azd-table azd-hm-table"><thead>' + head +
      '</thead><tbody>' + body + '</tbody></table></div>' +
      '<div class="azd-hm-legend"><span><i style="background:#4ade80"></i>' + green +
      ' green</span><span><i style="background:#f87171"></i>' + red + ' red</span>' +
      '<span class="azd-mut">On ' + inrExact(C.amount) + ', not compounded. Hover a cell for the %.</span></div>';
  }

  /* ---------------------------------------------------------------
     RISK OF RUIN

     Every other number on this page is an average, and averages assume the
     account survives long enough to collect them. They do not model the one
     outcome that ends the game: a run of stop-losses that leaves the balance
     too small to take the next trade.

     This walks that run with the user's ACTUAL sizing rule, re-sizing after
     each loss the way a real account would, and compares the result with the
     longest losing streak the backtest actually produced.
     --------------------------------------------------------------- */
  function ruin(p) {
    var slFrac = p.unitCost ? Math.abs(p.atSL) / p.unitCost : 0;
    if (!slFrac) return null;
    var streak = Math.max(1, p.streak || 1);
    var cap = C.amount, stops = 0, log = [], dead = false;
    var MAX = 200, afterStreak = null;
    while (stops < MAX) {
      var units, deployed;
      if (C.market === 'stocks') {
        /* One stop = one losing TRADE, which is what the streak counts. Each
           trade carries capital / slots. */
        units = 1;
        deployed = cap / Math.max(1, C.concurrent);
      } else if (C.market === 'futures') {
        /* Futures are sized in whole lots against MARGIN — the deployment %
           does not apply. Using it here reported a 1-lot loss next to a 6-lot
           scenario card, which contradicted itself on screen. */
        units = Math.floor(cap / p.unitCost);
        if (units < 1) { dead = true; break; }
        deployed = units * p.unitCost;
      } else {
        units = Math.floor(cap * (C.deploy / 100) / p.unitCost);
        if (units < 1) { dead = true; break; }
        deployed = units * p.unitCost;
      }
      var hit = deployed * slFrac;
      if (log.length < 6) {
        log.push({ cap: cap, units: units, deployed: deployed, loss: hit });
      }
      cap -= hit;
      stops++;
      if (stops === streak) afterStreak = cap;
      if (C.market === 'stocks' && cap <= C.amount * 0.05) { dead = true; break; }
    }
    if (afterStreak === null) afterStreak = cap;   /* died before the streak */
    return {
      stops: stops, dead: dead, log: log, left: cap, streak: streak,
      afterStreak: afterStreak,
      pctLeft: afterStreak / C.amount * 100,
      /* fatal = the run the backtest ALREADY produced ends this account */
      fatal: dead && stops <= streak,
      capped: stops >= MAX
    };
  }

  function renderCalc() {
    var p = profile();
    var out = el('azd-calc-out');
    renderMonthly();
    if (!p.ok) {
      el('azd-monthly').innerHTML = '';
      out.innerHTML = '<div class="azd-warn"><strong>Not enough capital for one unit.</strong> ' +
        esc(p.note || 'No backtested trades for this combination.') + '</div>';
      return;
    }

    var perDayUnits = p.units;
    /* Stocks: capital is split across positions, so "units" is baked into
       unitCost — one trade at a time per slot. Options/futures: each signal
       is taken with every lot you can afford. */
    var lotMult = C.market === 'stocks' ? 1 : perDayUnits;

    var b = band(p);
    var perTradeBase = p.perTrade;
    var dayBase = perTradeBase * p.tradesPerDay * lotMult;
    var dayLow = (perTradeBase - b.half) * p.tradesPerDay * lotMult;
    var dayHigh = (perTradeBase + b.half) * p.tradesPerDay * lotMult;

    /* THE PATH, not a power.
       Compounding is not "expected rate ^ 12". A real account carries whatever
       the previous period left into the next, and some periods lose money.
       pathStats() walks the actual session-by-session sequence the backtest
       produced, so "monthly" and "daily" mean what they say and the volatility
       drag a constant-rate model hides is included. */
    var PS = pathStats(dailySeries(), C.compound);
    var compLabel = C.compound === 'daily' ? ' (compounded daily)'
      : C.compound === 'monthly' ? ' (compounded monthly)' : '';

    /* Even a real path explodes if the per-month rate is one no account could
       actually sustain, so the ceiling stays — measured on the flat rate so it
       does not depend on which compounding mode is selected. */
    var COMPOUND_CEILING_PCT = 20;
    var flatMonthPct = PS.dayAvg * TRADING_DAYS_PER_MONTH * 100;
    var monthPct = flatMonthPct;
    var compoundBlocked = C.compound !== 'none' &&
                          flatMonthPct > COMPOUND_CEILING_PCT;

    /* When the rate is over the ceiling the WHOLE year row falls back to the
       flat (uncompounded) figure — worst, average and best alike. Otherwise the
       "best" column would still compound a real 12-month window and print an
       absurd crore figure the average was suppressed precisely to avoid. */
    var yearFrac = compoundBlocked ? PS.dayAvg * SESSIONS_PER_YEAR : PS.year;
    var loYear = compoundBlocked ? PS.monthLo * MONTHS : PS.yearLo;
    var hiYear = compoundBlocked ? PS.monthHi * MONTHS : PS.yearHi;

    var lo  = { day: PS.dayAvg * C.amount, month: PS.monthLo * C.amount,
                year: loYear * C.amount };
    var mid = { day: PS.dayAvg * C.amount, month: PS.monthAvg * C.amount,
                year: yearFrac * C.amount };
    var hi  = { day: PS.dayAvg * C.amount, month: PS.monthHi * C.amount,
                year: hiYear * C.amount };
    var pctOf = function (v) { return (v / C.amount * 100); };

    /* — scenario cards — */
    var scen = '<div class="azd-scen">' +
      card('t1', 'If Target 1 is hit', p.atT1 * lotMult, p.pT1only, 'of trades stop at T1') +
      (p.atT2 == null ? '' :
        card('t2', 'If Target 2 is hit', p.atT2 * lotMult, p.pT2, 'of trades run to T2')) +
      card('sl', 'If the stop is hit', p.atSL * lotMult, p.pSL, 'of trades are stopped out') +
      (p.pFlat < 0.005 ? '' :
        card('fl', 'Closed flat / at 15:30', 0, p.pFlat, 'end without hitting either')) +
      '</div>';

    function card(k, head, v, prob, tail) {
      return '<div class="azd-scen-card ' + k + '">' +
        '<div class="azd-scen-h">' + head + '</div>' +
        '<div class="azd-scen-v ' + (v > 0 ? 'azd-pos' : v < 0 ? 'azd-neg' : 'azd-mut') + '">' +
        (v === 0 ? '₹0' : inrExact(v)) + '</div>' +
        '<div class="azd-scen-p"><strong style="color:rgba(240,234,214,0.7)">' +
        (prob * 100).toFixed(1) + '%</strong> ' + tail + '</div></div>';
    }

    /* — the same capital, priced the other way — so nobody reads the
         signal-pure figure without seeing what execution costs take off it. */
    var otherKey = S.scoring === 'pure' ? 'honest' : 'pure';
    var q = profile(otherKey);
    var compare = '';
    if (q.ok) {
      var QS = pathStats(dailySeries(otherKey), C.compound);
      var qBlocked = C.compound !== 'none' &&
        QS.dayAvg * TRADING_DAYS_PER_MONTH * 100 > COMPOUND_CEILING_PCT;
      var qDay = QS.dayAvg * C.amount;
      var qMonth = QS.monthAvg * C.amount;
      var qYear = (qBlocked ? QS.dayAvg * SESSIONS_PER_YEAR : QS.year) * C.amount;
      compare = '<div class="azd-proj-row" style="border-bottom:0;opacity:0.82">' +
        '<div class="azd-proj-k">' +
        (otherKey === 'honest'
          ? 'Same setup, <strong style="color:#F4C20D">after costs</strong>'
          : 'Same setup, <strong style="color:#F4C20D">before costs</strong>') +
        '</div>' +
        '<div class="azd-proj-v azd-mut">' + inr(qDay) + '<span class="azd-proj-sub">per day</span></div>' +
        '<div class="azd-proj-v ' + (qMonth < 0 ? 'neg' : '') + '">' + inr(qMonth) +
        '<span class="azd-proj-sub">per month</span></div>' +
        '<div class="azd-proj-v ' + (qYear < 0 ? 'neg' : '') + '">' + inr(qYear) +
        '<span class="azd-proj-sub">' + pct(qYear / C.amount * 100, 1) + ' a year</span></div>' +
        '</div>';
    }

    var thin = p.n < 100;
    var stretch = '';
    if (compoundBlocked) {
      stretch += '<div class="azd-warn"><strong>Compounding is switched off for this ' +
        'selection.</strong> The measured rate averages ' + pct(monthPct, 0) +
        ' a month. Carried through a year that produces a number with no physical ' +
        'meaning — there is not enough liquidity to keep redeploying at that rate. ' +
        'The annual row falls back to the flat rate. Lower the deployment ' +
        'percentage, or read the monthly figure and stop there.</div>';
    } else if (C.compound === 'daily') {
      stretch += '<div class="azd-warn"><strong>Daily compounding assumes you can ' +
        'resize every session.</strong> The sequence below is the real one, but ' +
        'redeploying profit the next morning ignores lot sizes and the fact that ' +
        'you cannot buy part of a contract. Treat "None" as the figure to rely on.</div>';
    }
    if (thin) {
      stretch += '<div class="azd-warn" style="border-color:rgba(244,194,13,0.4);' +
        'background:rgba(244,194,13,0.06)"><strong>Small sample.</strong> This rests ' +
        'on just ' + p.n + ' backtested trades over ' + PS.months + ' months — too ' +
        'few to extend into an annual figure with any confidence.</div>';
    }
    /* This fires on the RATE, whatever the reinvestment setting. It used to be
       tied to compounding, which meant an impossible flat rate sailed through
       unchallenged. */
    if (flatMonthPct > COMPOUND_CEILING_PCT) {
      stretch += '<div class="azd-warn" style="border-color:rgba(244,194,13,0.4);' +
        'background:rgba(244,194,13,0.06)"><strong>This rate cannot persist.</strong> ' +
        'The figures imply ' + pct(flatMonthPct, 0) + ' a month on your whole account. ' +
        'No strategy sustains that: position size runs into liquidity, spreads widen ' +
        'against you, and the edge shrinks as the size grows. Read these rows as what ' +
        'the arithmetic says, not as an outcome to expect.</div>';
    }

    /* --- the run that ends the account --------------------------------- */
    var R = ruin(p);
    var ruinBlock = '';
    if (R) {
      var rows = R.log.map(function (l, i) {
        return '<tr><td style="padding:3px 10px 3px 0;color:rgba(240,234,214,0.5)">Loss ' +
          (i + 1) + '</td>' +
          '<td style="padding:3px 10px;text-align:right">' + inrExact(l.cap) + '</td>' +
          '<td style="padding:3px 10px;text-align:right;color:rgba(240,234,214,0.55)">' +
          (C.market === 'stocks' ? inrExact(l.deployed)
                                 : l.units + ' lot' + (l.units > 1 ? 's' : '')) + '</td>' +
          '<td style="padding:3px 0 3px 10px;text-align:right;color:#f87171">' +
          inrExact(-l.loss) + '</td></tr>';
      }).join('');
      /* Technically-alive-but-ruined is still ruined: surviving a run with 4%
         of the account left is not a survivable outcome, and must not be
         rendered in the calm styling. */
      var severe = R.fatal || R.pctLeft < 25;
      var head = R.fatal
        ? 'This sizing does not survive a losing run the backtest already produced.'
        : severe
        ? 'A losing run the backtest already produced would all but wipe this account.'
        : 'What a losing run does to this account.';
      ruinBlock =
        '<div class="azd-warn" style="border-color:' +
        (severe ? 'rgba(248,113,113,0.75)' : 'rgba(248,113,113,0.35)') +
        ';background:rgba(248,113,113,' + (severe ? '0.12' : '0.06') + ')">' +
        '<strong style="font-size:0.95rem">' + head + '</strong><br><br>' +
        'The longest run of consecutive losses this model produced on this ' +
        'selection was <strong>' + R.streak + ' in a row</strong>. ' +
        (R.fatal
          ? 'At your sizing the account is finished after <strong>' + R.stops +
            '</strong>' + (C.market === 'stocks'
              ? ' — down to ' + inrExact(R.left) + '.'
              : ', with ' + inrExact(R.left) + ' left, below the ' +
                inrExact(p.unitCost) + ' one lot costs. You cannot place the next trade.')
          : 'At your sizing that run leaves you with <strong>' +
            inrExact(R.afterStreak) + '</strong> — ' + R.pctLeft.toFixed(0) +
            '% of what you started with.') +
        '<br><br><table style="border-collapse:collapse;font-size:0.8rem;width:100%;' +
        'max-width:440px"><tr style="color:rgba(240,234,214,0.4)">' +
        '<td></td><td style="text-align:right;padding:0 10px">Balance before</td>' +
        '<td style="text-align:right;padding:0 10px">' +
        (C.market === 'stocks' ? 'Position' : 'Size') + '</td>' +
        '<td style="text-align:right">Loss</td></tr>' + rows + '</table><br>' +
        (severe
          ? '<strong>The annual figure above describes a path this configuration ' +
            'would not have lived to complete.</strong> Reduce the capital deployed ' +
            'per trade until a run of ' + R.streak + ' losses leaves the account ' +
            'able to keep trading.'
          : 'A backtest is not a limit on what the market can do — a longer run than ' +
            'any in the data is always possible.') +
        '</div>';
    }

    /* — projection table — */
    var proj = '<div class="azd-proj">' +
      '<div class="azd-proj-row head"><div>Projection</div><div>Worst</div>' +
      '<div>Average</div><div>Best</div></div>' +
      prow('Per trade', perTradeBase - b.half, perTradeBase, perTradeBase + b.half, true) +
      prow('Per trading day', mid.day, mid.day, mid.day, false, pctOf(mid.day)) +
      prow('Per month' + (C.compound === 'daily' && !compoundBlocked
        ? ' (compounded daily)' : ''),
        lo.month, mid.month, hi.month, false, pctOf(mid.month)) +
      prow('Per year' + (compoundBlocked ? '' : compLabel),
        lo.year, mid.year, hi.year, false, pctOf(mid.year)) +
      compare + '</div>';

    function prow(k, a, m, z, exact, pc) {
      var f = exact ? inrExact : inr;
      return '<div class="azd-proj-row">' +
        '<div class="azd-proj-k">' + k + '</div>' +
        '<div class="azd-proj-v ' + (a < 0 ? 'neg' : '') + '">' + f(a) + '</div>' +
        '<div class="azd-proj-v base ' + (m < 0 ? 'neg' : '') + '">' + f(m) +
        (pc != null ? '<span class="azd-proj-sub">' + pct(pc, 1) + ' on capital</span>' : '') +
        '</div>' +
        '<div class="azd-proj-v ' + (z < 0 ? 'neg' : '') + '">' + f(z) + '</div></div>';
    }

    /* — how it was worked out — */
    var freq = p.rawTradesPerDay;
    var capped = C.market === 'stocks' && freq > p.tradesPerDay + 0.001;
    var basis = '<div class="azd-note" style="margin-top:1.1rem">' +
      '<strong>How this was worked out.</strong> ' + esc(p.unitName) + '. ' +
      'The algo produced <strong>' + freq.toFixed(2) + ' signals per session</strong> ' +
      'on this selection over ' + p.n.toLocaleString('en-IN') + ' backtested trades' +
      (capped ? ', capped to ' + p.tradesPerDay.toFixed(2) + ' because you only have ' +
        C.concurrent + ' position slot' + (C.concurrent > 1 ? 's' : '') : '') + '.' +
      '<br><br>The monthly and annual rows are <strong>not an average raised to a ' +
      'power</strong>. They walk the actual session-by-session result across ' +
      PS.sessions.toLocaleString('en-IN') + ' sessions and ' + PS.months +
      ' months, carrying each period&rsquo;s closing capital into the next — losing ' +
      'stretches included. <strong>' + PS.negMonths + ' of those ' + PS.months +
      ' months lost money.</strong> &ldquo;Worst&rdquo; and &ldquo;Best&rdquo; are ' +
      'the actual worst and best month, and the worst and best twelve-month stretch, ' +
      'that occurred in the data — not a symmetric error bar.' +
      (C.compound === 'monthly'
        ? ' Monthly reinvestment adds each month&rsquo;s profit or loss to capital for the next.'
        : C.compound === 'daily'
        ? ' Daily reinvestment does the same every session.'
        : ' With reinvestment off, capital is held flat — which assumes profits are ' +
          'withdrawn <em>and losses are replaced</em>. If they are not, see the ' +
          'losing-run panel above.') +
      '</div>';

    /* Deploying the whole amount on every signal concentrates the account into
       one trade. Say so in rupees when a single stop is a big share of it —
       this is the number most people never work out for themselves. */
    var slShare = Math.abs(p.atSL * lotMult) / C.amount * 100;
    var conc = slShare < 15 ? '' :
      ' <br><br><strong>Concentration:</strong> as configured, one stop-loss costs ' +
      inrExact(Math.abs(p.atSL * lotMult)) + ' — <strong>' + slShare.toFixed(0) +
      '% of the amount entered, on a single trade.</strong> ' +
      (C.market === 'stocks'
        ? 'Increase the number of positions held at once to spread this.'
        : 'The calculator assumes you buy the maximum number of lots the amount ' +
          'allows. Trading fewer lots scales every figure on this page down ' +
          'proportionally — including the losses.');

    var warn = '<div class="azd-warn">' +
      '<strong>The same maths runs in reverse.</strong> ' +
      'On this selection <strong>' + (p.pSL * 100).toFixed(1) + '% of trades hit the stop</strong>, ' +
      'each costing about ' + inrExact(Math.abs(p.atSL * lotMult)) + '. ' +
      (p.streak ? 'The worst run in the backtest was <strong>' + p.streak +
        ' losing trades in a row</strong> — that is ' +
        inrExact(Math.abs(p.atSL * lotMult) * p.streak) + ' gone before a winner appears. ' : '') +
      'The figures above are an <strong>average across hundreds of trades</strong>; ' +
      'no individual day, week or month is guaranteed to look like them, and a run of ' +
      'losses can and will happen. Never deploy money you cannot afford to lose entirely.' +
      conc + '</div>';

    out.innerHTML = scen + ruinBlock + proj + stretch + basis + warn;
  }

  /* ---------------------------------------------------------------
     Wiring
     --------------------------------------------------------------- */
  /* Move the highlight pill behind the pressed button. Called on click and on
     resize; if the element has no layout yet (fonts still loading, container
     hidden) it falls back to colouring the button directly so the state is
     never invisible. */
  function paintSeg(c) {
    var on = c.querySelector('button[aria-pressed="true"]');
    var pill = c.querySelector('.azd-seg-pill');
    if (!on || !pill) return;
    var w = on.offsetWidth;
    if (!w) { c.classList.add('azd-seg-nopill'); return; }
    c.classList.remove('azd-seg-nopill');
    pill.style.width = w + 'px';
    pill.style.transform = 'translateX(' + on.offsetLeft + 'px)';
  }

  var SEGS = [];

  function seg(containerId, values, current, onPick, labels) {
    var c = el(containerId);
    if (!c) return;
    c.innerHTML = '<span class="azd-seg-pill"></span>' + values.map(function (v, i) {
      return '<button type="button" data-v="' + esc(v) + '" aria-pressed="' +
        (v === current) + '">' + esc(labels ? labels[i] : v) + '</button>';
    }).join('');
    var btns = c.querySelectorAll('button');
    Array.prototype.forEach.call(btns, function (b) {
      b.addEventListener('click', function () {
        /* The pressed state has to be updated here. Previously the segment was
           only re-rendered by renderAll(), so clicking a tab changed the view
           but left the highlight sitting on the old button. */
        Array.prototype.forEach.call(btns, function (x) {
          x.setAttribute('aria-pressed', String(x === b));
        });
        paintSeg(c);
        onPick(b.getAttribute('data-v'));
      });
    });
    if (SEGS.indexOf(c) < 0) SEGS.push(c);
    paintSeg(c);
    /* Web fonts land after first paint and change button widths. */
    if (window.requestAnimationFrame) {
      window.requestAnimationFrame(function () { paintSeg(c); });
    }
  }

  function repaintSegs() { SEGS.forEach(paintSeg); }

  function instrumentOptions() {
    var names;
    if (C.market === 'niftyopt') names = [NIFTY];
    else if (C.market === 'options') names = optionNames('options', 'pure');
    else names = (DATA.instruments || []).slice();
    var opts = '';
    if (C.market === 'stocks') {
      opts += '<option value="PORTFOLIO">All ' + names.length + ' instruments (portfolio)</option>';
    }
    opts += names.map(function (n) {
      return '<option value="' + esc(n) + '"' +
        (n === C.instrument ? ' selected' : '') + '>' + esc(n) + '</option>';
    }).join('');
    return opts;
  }

  function syncCalcControls() {
    var sel = el('azd-calc-instrument');
    sel.innerHTML = instrumentOptions();
    if (C.market !== 'stocks' && C.instrument === 'PORTFOLIO') {
      C.instrument = sel.options.length ? sel.options[0].value : NIFTY;
    }
    var have = Array.prototype.some.call(sel.options, function (o) {
      return o.value === C.instrument;
    });
    if (!have && sel.options.length) C.instrument = sel.options[0].value;
    sel.value = C.instrument;
    el('azd-calc-conc-field').style.display = C.market === 'stocks' ? '' : 'none';
    /* Deployment % only applies where you choose how much premium to buy.
       Futures are sized in whole lots by margin, so it is meaningless there. */
    el('azd-calc-deploy-field').style.display =
      (C.market === 'options' || C.market === 'niftyopt') ? '' : 'none';
    /* A dropdown of one instrument is just noise (NIFTY-only views). */
    el('azd-calc-instr-field').style.display =
      (C.market === 'niftyopt' || C.market === 'futures') ? 'none' : '';
    el('azd-amount-display').textContent = inrExact(C.amount);
  }

  function renderAll() {
    seg('azd-model-seg', DATA.model_order, S.model, function (v) {
      S.model = v; renderBoard(); syncCalcControls(); renderCalc();
    });
    seg('azd-scoring-seg', ['pure', 'honest'], S.scoring, function (v) {
      S.scoring = v; renderBoard(); renderCalc();
    }, ['Backtest', 'After costs']);
    seg('azd-market-seg', ['stocks', 'options', 'niftyopt', 'futures'], S.market,
      function (v) { S.market = v; S.sortKey = null; renderBoard(); },
      ['Stocks', 'Stock Options', 'NIFTY Options', 'NIFTY Futures']);
    seg('azd-period-seg', DATA.periods || ['All'], S.period, function (v) {
      S.period = v; renderBoard(); renderCalc();
    }, (DATA.periods || ['All']).map(function (x) {
      return x === 'All' ? 'All time' : 'Last ' + x;
    }));
    seg('azd-calc-market-seg', ['stocks', 'options', 'niftyopt', 'futures'],
      C.market, function (v) {
        C.market = v;
        C.instrument = v === 'stocks' ? 'PORTFOLIO'
          : v === 'options' ? optionNames('options', 'pure')[0] : NIFTY;
        syncCalcControls(); renderCalc();
      }, ['Stocks', 'Stock Options', 'NIFTY Options', 'NIFTY Futures']);
    seg('azd-compound-seg', ['none', 'monthly', 'daily'], C.compound, function (v) {
      C.compound = v; renderCalc();
    }, ['None', 'Monthly', 'Daily']);
    renderBoard();
    syncCalcControls();
    renderCalc();

    var w = DATA.window || {};
    el('azd-meta').innerHTML =
      'Backtest window ' + esc(w.from) + ' → ' + esc(w.to) + ' · ' + (w.sessions || 0) +
      ' NSE sessions · ' + (DATA.instruments || []).length + ' instruments · ' +
      'options priced from the same trades' +
      (DATA.options_cost_pct ? ' (after-costs view adds ' + DATA.options_cost_pct +
        '% of premium per round trip)' : '') + '. ' +
      'Data generated ' + esc((DATA.generated || '').slice(0, 10)) + '.';
  }

  function bindCalcInputs() {
    var amt = el('azd-calc-amount'), rng = el('azd-calc-range');
    function setAmount(v) {
      v = Math.max(5000, Math.min(10000000, Math.round(v) || 0));
      C.amount = v;
      if (amt.value !== String(v)) amt.value = v;
      rng.value = Math.log10(v);
      el('azd-amount-display').textContent = inrExact(v);
      renderCalc();
    }
    amt.addEventListener('input', function () { setAmount(+amt.value); });
    rng.addEventListener('input', function () {
      setAmount(Math.round(Math.pow(10, +rng.value) / 1000) * 1000);
    });
    el('azd-calc-instrument').addEventListener('change', function (e) {
      C.instrument = e.target.value; renderCalc();
    });
    el('azd-calc-concurrent').addEventListener('change', function (e) {
      C.concurrent = +e.target.value; renderCalc();
    });
    el('azd-calc-deploy').addEventListener('change', function (e) {
      C.deploy = +e.target.value; renderCalc();
    });
    rng.value = Math.log10(C.amount);
    amt.value = C.amount;
  }

  function init() {
    if (!el('azd-kpis')) return;   // page has no dashboard on it
    fetch('/data/algo-stats.json', { cache: 'no-cache' })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (d) {
        DATA = d;
        if (DATA.model_order && DATA.model_order.length) S.model = DATA.model_order[0];
        document.querySelectorAll('.azd-needs-data').forEach(function (n) {
          n.style.display = '';
        });
        document.querySelectorAll('.azd-loading').forEach(function (n) {
          n.style.display = 'none';
        });
        bindCalcInputs();
        renderAll();
        window.addEventListener('resize', repaintSegs);
        if (document.fonts && document.fonts.ready) {
          document.fonts.ready.then(repaintSegs);
        }
      })
      .catch(function (e) {
        document.querySelectorAll('.azd-loading').forEach(function (n) {
          n.textContent = 'Performance data is being updated — please check back shortly.';
        });
        if (window.console) console.error('algo-stats load failed', e);
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else { init(); }
})();
