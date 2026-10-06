(function () {
  'use strict';
  var GEO_TIMEOUT = 9000;

  // ---- Optional periodic tracking while a visit is open -----------------
  function bindTracking() {
    var body = document.getElementById('mo-root') || document.body;
    var interval = parseInt(body.dataset.tracking || '0', 10);
    if (!interval || !body.dataset.activeVisit || !navigator.geolocation) { return; }
    var csrf = body.dataset.csrf;
    var send = function () {
      navigator.geolocation.getCurrentPosition(function (pos) {
        var fd = new FormData();
        fd.append('csrf_token', csrf);
        fd.append('lat', pos.coords.latitude);
        fd.append('lng', pos.coords.longitude);
        fetch('/rep/track', { method: 'POST', body: fd, credentials: 'same-origin' });
      }, function () {}, { enableHighAccuracy: false, timeout: GEO_TIMEOUT });
    };
    send();
    setInterval(send, interval * 1000);
  }

  // ---- Product lines editor (orders / invoices / stock) -----------------
  function esc(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  function bindLines() {
    var box = document.getElementById('lines');
    if (!box) { return; }
    var tpl = document.getElementById('line-tpl');
    var mode = box.dataset.mode || 'sale';           // sale | stock
    var op = box.dataset.op || '';
    var cap = parseFloat(box.dataset.cap || '0');
    var partnerSel = document.getElementById('partner_id');
    var MSG = { stock: box.dataset.stock || 'Stock', none: box.dataset.none || 'No products found', loading: box.dataset.loading || 'Loading…',
                more: box.dataset.more || 'Showing the first results, type to narrow the list' };
    var SHOW = 80, CATALOG_LIMIT = 500;
    var catalog = null, loading = false, waiting = [];

    function partnerParam() { return partnerSel && partnerSel.value ? '&partner_id=' + partnerSel.value : ''; }
    function stockParam() { return mode === 'stock' ? '&stock=1&op=' + encodeURIComponent(op) : ''; }

    function recompute() {
      var total = 0;
      box.querySelectorAll('.line').forEach(function (l) {
        var q = parseFloat(l.querySelector('[name=qty]').value) || 0;
        var pEl = l.querySelector('[name=price]');
        var p = pEl ? (parseFloat(pEl.value) || 0) : 0;
        var dEl = l.querySelector('[name=discount]');
        var d = dEl ? (parseFloat(dEl.value) || 0) : 0;
        total += q * p * (1 - d / 100);
      });
      var t = document.getElementById('lines-total');
      if (t) { t.textContent = total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
    }

    // The whole catalogue is loaded once (per customer) and filtered locally while typing.
    function loadCatalog(cb) {
      if (catalog) { cb(); return; }
      waiting.push(cb);
      if (loading) { return; }
      loading = true;
      fetch('/rep/products.json?all=1' + partnerParam() + stockParam(), { credentials: 'same-origin' })
        .then(function (r) { return r.json(); })
        .then(function (items) { catalog = items; })
        .catch(function () { catalog = null; })
        .then(function () { loading = false; waiting.splice(0).forEach(function (f) { f(); }); });
    }

    function addLine(data) {
      var node = tpl.firstElementChild.cloneNode(true);
      box.appendChild(node);
      var combo = node.querySelector('.mo-combo');
      var search = node.querySelector('.prod-search');
      var list = node.querySelector('.mo-suggest');
      var caret = node.querySelector('.prod-caret');
      var pid = node.querySelector('[name=product_id]');
      var chosen = '';
      var shown = [], hi = -1, timer;

      function isOpen() { return !list.hidden; }
      function close() {
        list.hidden = true; search.setAttribute('aria-expanded', 'false'); hi = -1;
        search.value = pid.value ? chosen : '';      // never leave typed text without a chosen product
      }
      combo._close = close;

      function hint(text) {
        var d = document.createElement('div'); d.className = 'hint'; d.textContent = text; list.appendChild(d);
      }
      function highlight(i) {
        var rows = list.querySelectorAll('div[data-i]');
        rows.forEach(function (r) { r.classList.remove('on'); });
        hi = i;
        if (rows[i]) { rows[i].classList.add('on'); rows[i].scrollIntoView({ block: 'nearest' }); }
      }
      function paint(items, more) {
        list.innerHTML = '';
        shown = items; hi = -1;
        items.forEach(function (it, i) {
          var row = document.createElement('div');
          row.setAttribute('data-i', i); row.setAttribute('role', 'option');
          var sub = esc(it.uom);
          if (mode === 'stock') { if (it.qty !== undefined) { sub = esc(String(it.qty)) + ' ' + sub; } }
          else {
            if (it.price !== undefined) { sub += ' · ' + Number(it.price).toFixed(2); }
            if (it.disc) { sub += ' (−' + it.disc + '%)'; }
            if (it.stock !== undefined) { sub += ' · ' + esc(MSG.stock) + ': ' + Math.round(it.stock * 100) / 100; }
          }
          row.innerHTML = '<b>' + (it.frequent ? '<span class="mo-badge-frequent">★</span> ' : '') + esc(it.name) + '</b><br><span class="mo-muted">' + sub + '</span>';
          row.addEventListener('click', function () { pick(it); });
          list.appendChild(row);
        });
        if (!items.length) { hint(MSG.none); }
        else if (more) { hint(MSG.more); }
      }
      function render() {
        if (!isOpen()) { return; }
        if (!catalog) { list.innerHTML = ''; hint(loading ? MSG.loading : MSG.none); return; }
        var needle = (pid.value ? '' : search.value).trim().toLowerCase();
        var matches = needle ? catalog.filter(function (c) {
          return c.name.toLowerCase().indexOf(needle) !== -1 || (c.code || '').toLowerCase().indexOf(needle) !== -1 ||
                 (c.barcode || '') === needle;
        }) : catalog;
        paint(matches.slice(0, SHOW), matches.length > SHOW);
        // a very large catalogue is truncated server side: ask the server too when typing
        if (needle.length >= 2 && catalog.length >= CATALOG_LIMIT) {
          clearTimeout(timer);
          timer = setTimeout(function () {
            fetch('/rep/products.json?q=' + encodeURIComponent(needle) + partnerParam() + stockParam(), { credentials: 'same-origin' })
              .then(function (r) { return r.json(); })
              .then(function (items) { if (isOpen() && !pid.value && search.value.trim().toLowerCase() === needle) { paint(items, false); } });
          }, 250);
        }
      }
      function open() {
        document.querySelectorAll('.mo-combo').forEach(function (c) { if (c !== combo && c._close) { c._close(); } });
        list.hidden = false; search.setAttribute('aria-expanded', 'true');
        render();
        loadCatalog(render);
      }
      function pick(it) {
        pid.value = it.id; chosen = it.name; search.value = it.name;
        var price = node.querySelector('[name=price]');
        if (price && it.price !== undefined) { price.value = Number(it.price).toFixed(2); }
        var uom = node.querySelector('.uom');
        if (uom) { uom.textContent = it.uom || ''; }
        close(); recompute();
      }

      search.addEventListener('focus', function () { open(); try { search.select(); } catch (e) { /* ignore */ } });
      search.addEventListener('input', function () { pid.value = ''; if (!isOpen()) { open(); } else { render(); } });
      search.addEventListener('keydown', function (ev) {
        if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
          ev.preventDefault();
          if (!isOpen()) { open(); return; }
          var n = shown.length; if (!n) { return; }
          highlight(ev.key === 'ArrowDown' ? (hi + 1) % n : (hi - 1 + n) % n);
        } else if (ev.key === 'Enter') {
          if (isOpen() && shown.length && (hi >= 0 || shown.length === 1)) { ev.preventDefault(); pick(shown[hi >= 0 ? hi : 0]); }
          else if (isOpen()) { ev.preventDefault(); }
        } else if (ev.key === 'Escape' || ev.key === 'Tab') { close(); }
      });
      caret.addEventListener('click', function () { if (isOpen()) { close(); } else { open(); } });

      if (data) {
        pid.value = data.id; chosen = data.name; search.value = data.name;
        node.querySelector('[name=qty]').value = data.qty;
        var pr = node.querySelector('[name=price]'); if (pr) { pr.value = Number(data.price).toFixed(2); }
        var ds = node.querySelector('[name=discount]'); if (ds) { ds.value = data.discount; }
        var um = node.querySelector('.uom'); if (um) { um.textContent = data.uom || ''; }
      }
      node.querySelectorAll('input[type=number]').forEach(function (i) { i.addEventListener('input', recompute); });
      node.querySelector('.rm').addEventListener('click', function () { node.remove(); recompute(); });
    }

    document.addEventListener('click', function (ev) {
      box.querySelectorAll('.mo-combo').forEach(function (c) { if (!c.contains(ev.target) && c._close) { c._close(); } });
    });
    document.getElementById('add-line').addEventListener('click', function () { addLine(); });
    var initial = [];
    try { initial = JSON.parse(box.dataset.initial || '[]'); } catch (e) { initial = []; }
    if (initial.length) { initial.forEach(function (it) { addLine(it); }); } else { addLine(); }
    recompute();
    var form = box.closest('form');
    form.addEventListener('submit', function (ev) {
      var ok = false;
      box.querySelectorAll('[name=product_id]').forEach(function (p) { if (p.value) { ok = true; } });
      if (!ok) { ev.preventDefault(); alert(box.dataset.empty || 'Add at least one product.'); return; }
      var bad = false;
      box.querySelectorAll('[name=discount]').forEach(function (d) { if (parseFloat(d.value || '0') > cap) { bad = true; } });
      if (bad) { ev.preventDefault(); alert((box.dataset.maxmsg || 'Maximum discount is {cap}%').replace('{cap}', cap)); }
    });
    if (partnerSel) {
      partnerSel.addEventListener('change', function () {
        catalog = null; box.innerHTML = ''; addLine(); recompute();
      });
    }
  }

  // ---- Payment form: load open invoices for the chosen customer ---------
  function bindPayment() {
    var partner = document.getElementById('pay_partner');
    var invoice = document.getElementById('pay_invoice');
    var amount = document.getElementById('pay_amount');
    if (!partner || !invoice) { return; }
    var preset = invoice.dataset.preset || '';
    function load() {
      invoice.innerHTML = '';
      if (!partner.value) { return; }
      fetch('/rep/customer/' + partner.value + '/invoices.json', { credentials: 'same-origin' })
        .then(function (r) { return r.json(); }).then(function (items) {
          items.forEach(function (it) {
            var o = document.createElement('option');
            o.value = it.id; o.dataset.residual = it.residual;
            o.textContent = it.name + ' — ' + it.residual.toFixed(2) + ' / ' + it.total.toFixed(2);
            if (String(it.id) === preset) { o.selected = true; }
            invoice.appendChild(o);
          });
          fill();
        });
    }
    function fill() {
      var o = invoice.options[invoice.selectedIndex];
      if (o && amount && !amount.dataset.touched) { amount.value = o.dataset.residual; }
    }
    if (amount) { amount.addEventListener('input', function () { amount.dataset.touched = '1'; }); }
    invoice.addEventListener('change', function () { if (amount) { delete amount.dataset.touched; } fill(); });
    partner.addEventListener('change', function () { preset = ''; load(); });
    load();
  }

  // ======================================================================================
  // Forms: device id/time, GPS, offline queue
  // ======================================================================================
  var root = function () { return document.getElementById('mo-root') || document.body; };
  var banner = function () { return document.getElementById('mo-offline'); };
  var say = function (key, fallback) { var b = banner(); return (b && b.dataset[key]) || fallback; };
  var QKEY = 'mo_rep_queue', EKEY = 'mo_rep_errors';
  var uid = function () { return root().dataset.uid || '0'; };

  function uuid() {
    if (window.crypto && crypto.randomUUID) { return crypto.randomUUID(); }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16);
    });
  }
  function store(key) { try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch (e) { return []; } }
  function save(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* storage full */ } }
  function mine() { return store(QKEY).filter(function (i) { return i.uid === uid(); }); }

  function stamp(form) {
    form.querySelectorAll('input[name=client_uid]').forEach(function (i) { if (!i.value) { i.value = uuid(); } });
    if (form.dataset.geo === '1' || form.dataset.queue === '1') {
      var t = form.querySelector('input[name=client_time]');
      if (!t) { t = document.createElement('input'); t.type = 'hidden'; t.name = 'client_time'; form.appendChild(t); }
      t.value = new Date().toISOString();
    }
  }

  function withGeo(form, done) {
    if (form.dataset.geo !== '1' || !navigator.geolocation) { done(); return; }
    navigator.geolocation.getCurrentPosition(function (pos) {
      var la = form.querySelector('input[name=lat]'), ln = form.querySelector('input[name=lng]');
      if (la) { la.value = pos.coords.latitude; }
      if (ln) { ln.value = pos.coords.longitude; }
      done();
    }, function () { done(); }, { enableHighAccuracy: true, timeout: 9000, maximumAge: 30000 });
  }

  // ---- connection chip -------------------------------------------------------------------
  function setChip() {
    var chip = document.getElementById('mo-conn');
    if (!chip) { return; }
    var n = mine().length, d = chip.dataset;
    var state = !navigator.onLine ? 'offline' : (chip.dataset.busy === '1' ? 'syncing' : (n ? 'pending' : 'online'));
    chip.dataset.state = state;
    var base = state === 'pending' ? d.online : (d[state] || d.online);
    chip.textContent = n && state !== 'syncing' ? base + ' · ' + n + ' ' + (d.pending || '') : base;
    var b = banner(); if (b) { b.hidden = navigator.onLine; }
  }

  function toast(text, bad) {
    var el = document.createElement('div');
    el.className = 'mo-flash' + (bad ? ' err' : ''); el.textContent = text; el.setAttribute('role', 'status');
    var main = document.querySelector('.mo-main'); if (main) { main.parentNode.insertBefore(el, main); }
    setTimeout(function () { el.remove(); }, 7000);
  }

  function enqueue(form, extra) {
    var fields = [], skipped = false;
    new FormData(form).forEach(function (v, k) {
      if (typeof v === 'string') { fields.push([k, v]); } else if (v && v.name) { skipped = true; }
    });
    if (extra) { fields.push(extra); }
    var q = store(QKEY);
    q.push({ id: uuid(), uid: uid(), url: form.getAttribute('action'), fields: fields, ts: Date.now() });
    save(QKEY, q);
    setChip();
    toast(say('queued', 'Saved on this device.') + (skipped ? ' ' + say('skipped', '') : ''));
    setTimeout(function () { window.location.href = '/rep'; }, 1200);
  }

  var syncing = false;
  function sync() {
    if (syncing || !navigator.onLine || !mine().length) { setChip(); return; }
    syncing = true;
    var chip = document.getElementById('mo-conn'); if (chip) { chip.dataset.busy = '1'; } setChip();
    var failed = [];
    fetch('/rep/csrf', { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (t) {
      var items = mine();
      return items.reduce(function (chain, item) {
        return chain.then(function () {
          var fd = new FormData();
          item.fields.forEach(function (kv) { fd.append(kv[0], kv[0] === 'csrf_token' ? t.token : kv[1]); });
          return fetch(item.url, { method: 'POST', body: fd, credentials: 'same-origin' }).then(function (res) {
            var m = /[?&]msg=([^&]*)/.exec(res.url), bad = /[?&]kind=err/.test(res.url);
            if (res.ok && !bad) { save(QKEY, store(QKEY).filter(function (i) { return i.id !== item.id; })); }
            else if (bad || (res.status >= 400 && res.status < 500)) {
              save(QKEY, store(QKEY).filter(function (i) { return i.id !== item.id; }));
              failed.push(m ? decodeURIComponent(m[1].replace(/\+/g, ' ')) : item.url);
            } else { throw new Error('server'); }
          });
        });
      }, Promise.resolve());
    }).catch(function () { /* connection dropped: the rest stays queued */ }).then(function () {
      syncing = false;
      if (chip) { chip.dataset.busy = '0'; }
      setChip();
      failed.forEach(function (msg) { toast(msg + ' — ' + say('failed', 'could not be saved'), true); });
    });
  }

  function onSubmit(ev) {
    var form = ev.target;
    if (!(form instanceof HTMLFormElement) || ev.defaultPrevented) { return; }
    if ((form.method || 'get').toLowerCase() === 'get' || form.dataset.sending === '1') { return; }
    ev.preventDefault();
    var submitter = ev.submitter && ev.submitter.name ? [ev.submitter.name, ev.submitter.value] : null;
    stamp(form);
    var btns = form.querySelectorAll('button[type=submit]');
    btns.forEach(function (b) { b.disabled = true; });
    withGeo(form, function () {
      if (!navigator.onLine) {
        var allow = (form.dataset.queueAllow || '').split(',').filter(Boolean);
        if (form.dataset.queue === '1' && (!allow.length || (submitter && allow.indexOf(submitter[1]) !== -1))) {
          enqueue(form, submitter);
        } else {
          btns.forEach(function (b) { b.disabled = false; });
          alert(say('blocked', 'This action needs an internet connection.'));
        }
        return;
      }
      if (submitter) {
        var h = document.createElement('input'); h.type = 'hidden'; h.name = submitter[0]; h.value = submitter[1]; form.appendChild(h);
      }
      form.dataset.sending = '1';
      form.submit();
    });
  }

  // ---- quick actions sheet ------------------------------------------------------------------
  function bindFab() {
    var fab = document.getElementById('mo-fab'), sheet = document.getElementById('mo-sheet');
    if (!fab || !sheet) { return; }
    var toggle = function (open) { sheet.hidden = !open; fab.setAttribute('aria-expanded', open ? 'true' : 'false'); };
    fab.addEventListener('click', function () { toggle(sheet.hidden); });
    sheet.addEventListener('click', function (ev) { if (ev.target === sheet) { toggle(false); } });
    var close = document.getElementById('mo-sheet-close'); if (close) { close.addEventListener('click', function () { toggle(false); }); }
    document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') { toggle(false); } });
  }

  // ---- service worker, warm-up of the day's pages, sync triggers ------------------------------
  function bindOffline() {
    document.addEventListener('submit', onSubmit);
    window.addEventListener('online', function () { setChip(); sync(); });
    window.addEventListener('offline', setChip);
    var chip = document.getElementById('mo-conn');
    if (chip) { chip.addEventListener('click', function () { if (navigator.onLine) { sync(); } }); }
    setChip();
    if (navigator.onLine) { sync(); }
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/rep/sw.js', { scope: '/rep' }).catch(function () {});
      var logout = document.getElementById('mo-logout');
      if (logout) {
        logout.addEventListener('click', function () {
          if (navigator.serviceWorker.controller) { navigator.serviceWorker.controller.postMessage('clear'); }
          try { localStorage.removeItem('mo_rep_warm'); } catch (e) { /* ignore */ }
        });
      }
      warmUp();
    }
  }

  function warmUp() {
    var last = parseInt(localStorage.getItem('mo_rep_warm') || '0', 10);
    if (!navigator.onLine || Date.now() - last < 30 * 60 * 1000) { return; }
    setTimeout(function () {
      fetch('/rep/offline/manifest.json', { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (m) {
        var urls = m.urls.slice(), run = function () {
          var batch = urls.splice(0, 3);
          if (!batch.length) { try { localStorage.setItem('mo_rep_warm', String(Date.now())); } catch (e) { /* ignore */ } return; }
          Promise.all(batch.map(function (u) {
            return fetch(u, { credentials: 'same-origin', headers: { 'X-Mo-Warm': '1' } }).catch(function () {});
          })).then(run);
        };
        run();
      }).catch(function () {});
    }, 2500);
  }

  // ---- payment form: cheque details only for cheque methods --------------------------------------
  function bindCheque() {
    var sel = document.getElementById('method_id'), box = document.getElementById('cheque-box');
    if (!sel || !box) { return; }
    var req = ['chq_no', 'chq_bank', 'chq_due'].map(function (id) { return document.getElementById(id); });
    function apply() {
      var o = sel.options[sel.selectedIndex], on = !!o && o.dataset.type === 'cheque';
      box.hidden = !on;
      req.forEach(function (i) { if (i) { i.required = on; } });
    }
    sel.addEventListener('change', apply); apply();
  }

  // ---- customer return: customer -> invoice / order -> products, quantity, reason ----------------------
  function bindReturn() {
    var form = document.getElementById('return-form');
    if (!form) { return; }
    var partner = document.getElementById('r_partner'), order = document.getElementById('r_order');
    var lines = document.getElementById('r_lines'), reasons = document.getElementById('r_reasons');
    var docs = [];
    function renderLines() {
      lines.innerHTML = '';
      var doc = docs.filter(function (d) { return String(d.id) === order.value; })[0];
      if (!doc) { return; }
      doc.lines.forEach(function (l) {
        var div = document.createElement('div'); div.className = 'mo-return-line';
        div.innerHTML = '<input type="hidden" name="move_id" value="' + l.move_id + '"/><b>' + esc(l.product) + '</b>' +
          '<div class="mo-muted">' + esc(lines.dataset.max || 'Max') + ': ' + l.max + ' ' + esc(l.uom) + '</div>' +
          '<div class="mo-grid"><div><label>' + esc(lines.dataset.qty || 'Quantity') + '</label>' +
          '<input type="number" name="qty" class="mo-input" min="0" max="' + l.max + '" step="any" value="0" inputmode="decimal"/></div>' +
          '<div><label>' + esc(lines.dataset.reason || 'Reason') + '</label><select name="reason_id" class="mo-input">' +
          reasons.innerHTML + '</select></div></div>';
        lines.appendChild(div);
      });
    }
    function loadOrders() {
      order.innerHTML = ''; lines.innerHTML = ''; docs = [];
      if (!partner.value) { return; }
      fetch('/rep/customer/' + partner.value + '/returnable.json', { credentials: 'same-origin' })
        .then(function (r) { return r.json(); }).then(function (items) {
          docs = items;
          var first = document.createElement('option'); first.value = '';
          first.textContent = items.length ? (order.dataset.choose || 'Choose') : (order.dataset.none || 'Nothing can be returned');
          order.appendChild(first);
          items.forEach(function (d) {
            var o = document.createElement('option'); o.value = d.id;
            o.textContent = d.name + ' · ' + d.date + (d.invoices ? ' · ' + d.invoices : '');
            order.appendChild(o);
          });
        });
    }
    partner.addEventListener('change', loadOrders);
    order.addEventListener('change', renderLines);
    form.addEventListener('submit', function (ev) {
      var any = false;
      lines.querySelectorAll('.mo-return-line').forEach(function (l) {
        var q = parseFloat(l.querySelector('[name=qty]').value || '0'), max = parseFloat(l.querySelector('[name=qty]').max);
        if (q > max) { ev.preventDefault(); alert('> ' + max); }
        if (q > 0) { any = true; }
      });
      if (!any) { ev.preventDefault(); }
    });
    loadOrders();
  }

  document.addEventListener('DOMContentLoaded', function () {
    bindOffline(); bindFab(); bindTracking(); bindLines(); bindPayment(); bindCheque(); bindReturn();
    document.querySelectorAll('input[name=client_uid]').forEach(function (i) { if (!i.value) { i.value = uuid(); } });
    var flash = document.querySelector('.mo-flash');
    if (flash && window.history && history.replaceState) {
      var u = new URL(window.location.href);
      u.searchParams.delete('msg'); u.searchParams.delete('kind');
      history.replaceState(null, '', u.pathname + (u.search || ''));
    }
  });
})();
