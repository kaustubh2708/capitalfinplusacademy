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
    market: 'stocks',      // 'stocks' | 'options' | 'niftyopt'
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
  function equityBlock(scoring) {
    var m = DATA.models[S.model];
    return m && m.equity ? m.equity[scoring || S.scoring] : null;
  }
  var NIFTY = 'NIFTY 50';

  /* All option economics live in one block. The two option VIEWS are just
     filters on it: "Stock Options" is every name except the index, "NIFTY
     Options" is the index alone — whose signals are detected on the NIFTY
     FUTURES chart and executed as ATM CE/PE. */
  function optionsBlock(model, scoring) {
    var m = (DATA.options || {})[model || S.model] || {};
    return m[scoring || S.scoring] || m.pure || {};
  }
  function optionNames(market, scoring) {
    var all = Object.keys(optionsBlock(null, scoring));
    if (market === 'niftyopt') return all.filter(function (n) { return n === NIFTY; });
    return all.filter(function (n) { return n !== NIFTY; });
  }
  function futuresBlock(model, scoring) {
    var m = DATA.models[model || S.model];
    return m && m.futures ? m.futures[scoring || S.scoring] : null;
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
        [(o.max_loss_streak || 0) + ' in a row', 'longest losing run', 'neg']
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
          'Realistic for NIFTY; optimistic for single-stock options, where the ' +
          'spread alone is often wider.'
        : '') +
        '<br><strong>How this is traded:</strong> the structure is detected on the ' +
            'NIFTY <em>futures</em> chart — it is the cleanest intraday series for the ' +
            'index — and the trade itself is a bought at-the-money CE or PE. ' +
            'We do not take futures positions; the futures chart is the signal source only.';
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
      '<br>Sample: ' + esc(sample) + '. ' + esc(note) + how;
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

  function renderCalc() {
    var p = profile();
    var out = el('azd-calc-out');
    if (!p.ok) {
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

    /* Three ways to read a year:
         none    — profits withdrawn; a year is simply twelve months
         monthly — each month's profit is added to capital for the next month
         daily   — each session's profit is added for the next session
       Daily compounding of an intraday edge is arithmetically valid and
       practically fantasy; the warning block below fires on it deliberately. */
    function project(day) {
      var month = day * TRADING_DAYS_PER_MONTH;
      var year;
      if (C.compound === 'daily') {
        var d = day / C.amount;
        year = C.amount * (Math.pow(1 + d, TRADING_DAYS_PER_MONTH * MONTHS) - 1);
        month = C.amount * (Math.pow(1 + d, TRADING_DAYS_PER_MONTH) - 1);
      } else if (C.compound === 'monthly') {
        year = C.amount * (Math.pow(1 + month / C.amount, MONTHS) - 1);
      } else {
        year = month * MONTHS;
      }
      return { day: day, month: month, year: year };
    }
    var compLabel = C.compound === 'daily' ? ' (compounded daily)'
      : C.compound === 'monthly' ? ' (compounded monthly)' : '';
    var lo = project(dayLow), mid = project(dayBase), hi = project(dayHigh);

    /* A compounded annual figure is only a measurement while the monthly rate is
       one a real account could actually sustain. Above ~20% a month the twelfth
       power turns a thin backtest into a number with no physical meaning — at
       176% a month, ₹1 lakh "becomes" ₹1,980 crore, which is not a projection,
       it is an arithmetic artefact. Suppress it rather than print it. */
    var COMPOUND_CEILING_PCT = 20;
    /* Measured on the SIMPLE monthly rate (day × 21), never on an already
       compounded one — otherwise turning daily compounding on inflates the
       month, trips the ceiling, and silently reverts the year to the flat
       fallback, making daily and monthly look identical. */
    var simpleMonthPct = dayBase * TRADING_DAYS_PER_MONTH / C.amount * 100;
    var monthPct = simpleMonthPct;
    var compoundBlocked = C.compound !== 'none' &&
                          simpleMonthPct > COMPOUND_CEILING_PCT;
    if (compoundBlocked) {
      [lo, mid, hi].forEach(function (x, i) {
        var day = [dayLow, dayBase, dayHigh][i];
        x.month = day * TRADING_DAYS_PER_MONTH;
        x.year = day * TRADING_DAYS_PER_MONTH * MONTHS;
      });
    }
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
    var noCostBook = false;
    if (q.ok) {
      var qMult = C.market === 'stocks' ? 1 : q.units;
      var qDay = q.perTrade * q.tradesPerDay * qMult;
      var qMonth = qDay * TRADING_DAYS_PER_MONTH;
      var qYear;
      var qBlocked = C.compound !== 'none' &&
        (qDay * TRADING_DAYS_PER_MONTH / C.amount * 100) > COMPOUND_CEILING_PCT;
      if (qBlocked) {
        qYear = qDay * TRADING_DAYS_PER_MONTH * MONTHS;
        qMonth = qDay * TRADING_DAYS_PER_MONTH;
      } else if (C.compound === 'daily') {
        var qd = qDay / C.amount;
        qYear = C.amount * (Math.pow(1 + qd, TRADING_DAYS_PER_MONTH * MONTHS) - 1);
        qMonth = C.amount * (Math.pow(1 + qd, TRADING_DAYS_PER_MONTH) - 1);
      } else if (C.compound === 'monthly') {
        qYear = C.amount * (Math.pow(1 + qMonth / C.amount, MONTHS) - 1);
      } else {
        qYear = qMonth * MONTHS;
      }
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

    if (noCostBook) {
      compare = '<div class="azd-proj-row" style="border-bottom:0;opacity:0.82">' +
        '<div class="azd-proj-k" style="grid-column:1/-1;font-weight:500;font-size:0.8rem;' +
        'color:rgba(240,234,214,0.45)">Option premiums here are modelled on ' +
        'theoretical prices with no bid-ask spread and no cost adjustment. There is ' +
        'no after-costs option book yet — real spreads alone can remove the entire ' +
        'edge shown above.</div></div>';
    }

    /* Extrapolating a year from a thin sample is arithmetic, not evidence. */
    var thin = p.n < 100;
    var monthlyPct = mid.month / C.amount * 100;
    var stretch = '';
    if (compoundBlocked) {
      stretch += '<div class="azd-warn"><strong>Compounding is switched off for this ' +
        'selection.</strong> The measured rate here is ' + pct(monthPct, 0) +
        ' a month. Raised to the twelfth power that produces a number with no ' +
        'physical meaning — there is not enough liquidity in the market to keep ' +
        'redeploying at that rate, and a single losing run breaks the sequence. ' +
        'The annual row therefore shows twelve flat months, not a compounded ' +
        'curve. Lower the deployment percentage, or read the monthly figure and ' +
        'stop there.</div>';
    } else if (C.compound === 'daily') {
      stretch += '<div class="azd-warn"><strong>Daily compounding is a maths exercise, ' +
        'not a plan.</strong> It assumes you can scale your position every single ' +
        'session with no limit on lot size, no widening of spreads, and no losing ' +
        'run interrupting the sequence. None of those hold. Use the "None" setting ' +
        'for any figure you intend to rely on.</div>';
    }
    if (thin || monthlyPct > 20) {
      stretch += '<div class="azd-warn" style="border-color:rgba(244,194,13,0.4);' +
        'background:rgba(244,194,13,0.06)">' +
        (thin ? '<strong>Small sample.</strong> This projection rests on just ' +
          p.n + ' backtested trades — nowhere near enough to extend into a ' +
          'monthly or annual figure with any confidence. Look at the width of the ' +
          'low-to-high band above: that is how little the data actually pins down. ' : '') +
        (monthlyPct > 20 ? (thin ? '<br><br>' : '') +
          '<strong>This monthly rate cannot persist.</strong> The figures imply ' +
          pct(monthlyPct, 0) + ' a month. No strategy compounds at that rate — ' +
          'position sizes hit liquidity limits, spreads widen against you, and the ' +
          'edge shrinks as size grows. Read the annual row as what the arithmetic ' +
          'says, not as an outcome anyone should expect.' : '') +
        '</div>';
    }

    /* — projection table — */
    var proj = '<div class="azd-proj">' +
      '<div class="azd-proj-row head"><div>Projection</div><div>Low end</div>' +
      '<div>Expected</div><div>High end</div></div>' +
      prow('Per trade', perTradeBase - b.half, perTradeBase, perTradeBase + b.half, true) +
      prow('Per trading day', lo.day, mid.day, hi.day, false, pctOf(mid.day)) +
      prow('Per month (' + TRADING_DAYS_PER_MONTH + ' sessions)' +
        (C.compound === 'daily' && !compoundBlocked ? ' (compounded daily)' : ''),
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
      'The algo produced <strong>' + freq.toFixed(2) + ' signals per session</strong> on this selection over ' +
      p.n.toLocaleString('en-IN') + ' backtested trades' +
      (capped ? ', capped to ' + p.tradesPerDay.toFixed(2) + ' because you only have ' +
        C.concurrent + ' position slot' + (C.concurrent > 1 ? 's' : '') : '') +
      '. Expected = the measured average outcome. Low and high ends are the ' +
      '<strong>95% confidence interval</strong> around that average — the ' +
      'statistical uncertainty in the backtest, not a forecast of good or bad years. ' +
      'A month is taken as ' + TRADING_DAYS_PER_MONTH + ' trading sessions.' +
      (C.compound === 'monthly'
        ? ' Monthly compounding assumes every rupee of profit is redeployed the following month, ' +
          'which requires the strategy to keep working at a larger size — it usually does not.'
        : C.compound === 'daily'
        ? ' Daily compounding redeploys profit the very next session. It is the most ' +
          'flattering assumption available and the least realistic: it ignores lot ' +
          'sizes, liquidity, and the fact that returns are not earned smoothly.'
        : '') +
      '</div>';

    /* — the loss side, stated as plainly as the gain side — */
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

    out.innerHTML = scen + proj + stretch + basis + warn;
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
    el('azd-calc-deploy-field').style.display = C.market === 'stocks' ? 'none' : '';
    /* Only one instrument on the NIFTY view — a dropdown of one is just noise. */
    el('azd-calc-instr-field').style.display = C.market === 'niftyopt' ? 'none' : '';
    el('azd-amount-display').textContent = inrExact(C.amount);
  }

  function renderAll() {
    seg('azd-model-seg', DATA.model_order, S.model, function (v) {
      S.model = v; renderBoard(); syncCalcControls(); renderCalc();
    });
    seg('azd-scoring-seg', ['pure', 'honest'], S.scoring, function (v) {
      S.scoring = v; renderBoard(); renderCalc();
    }, ['Backtest', 'After costs']);
    seg('azd-market-seg', ['stocks', 'options', 'niftyopt'], S.market, function (v) {
      S.market = v; S.sortKey = null; renderBoard();
    }, ['Stocks', 'Stock Options', 'NIFTY Options']);
    seg('azd-calc-market-seg', ['stocks', 'options', 'niftyopt'], C.market, function (v) {
      C.market = v;
      C.instrument = v === 'stocks' ? 'PORTFOLIO'
        : v === 'niftyopt' ? NIFTY : optionNames('options', 'pure')[0];
      syncCalcControls(); renderCalc();
    }, ['Stocks', 'Stock Options', 'NIFTY Options']);
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
