// FacilityOS Help Center — progressive enhancement only. Every page works without
// JavaScript except search and the contextual-help resolver (go.html).
(function () {
  'use strict';
  var body = document.body;
  var root = body.getAttribute('data-root') || '';
  var lang = body.getAttribute('data-lang') || 'en';
  var prefix = body.getAttribute('data-lang-prefix') || '';
  var page = body.getAttribute('data-page') || 'index.html';
  var store = {
    get: function (k) {
      try {
        return localStorage.getItem(k);
      } catch {
        return null;
      }
    },
    set: function (k, v) {
      try {
        localStorage.setItem(k, v);
      } catch {
        /* private mode */
      }
    },
  };

  // Theme
  var themeBtn = document.querySelector('[data-theme-toggle]');
  if (themeBtn)
    themeBtn.addEventListener('click', function () {
      var cur = document.documentElement.dataset.theme;
      var dark = cur
        ? cur === 'dark'
        : window.matchMedia('(prefers-color-scheme: dark)').matches;
      var next = dark ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      store.set('fos-help-theme', next);
    });

  // Mobile menu
  var menuBtn = document.querySelector('.menu-btn');
  var side = document.getElementById('side');
  if (menuBtn && side)
    menuBtn.addEventListener('click', function () {
      var open = side.classList.toggle('open');
      menuBtn.setAttribute('aria-expanded', String(open));
    });

  // Language switch keeps you on the same page.
  var sel = document.querySelector('[data-lang-switch]');
  if (sel)
    sel.addEventListener('change', function () {
      var l = sel.value;
      store.set('fos-help-lang', l);
      location.href =
        root +
        (l === 'en' ? '' : l + '/') +
        page +
        location.search +
        location.hash;
    });

  // Print
  Array.prototype.forEach.call(
    document.querySelectorAll('[data-print]'),
    function (b) {
      b.addEventListener('click', function () {
        window.print();
      });
    },
  );

  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function fold(s) {
    return String(s || '')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '');
  }

  // Search (client-side, no server, no tracking).
  var input = document.querySelector('[data-search-input]');
  var list = document.querySelector('[data-search-results]');
  var status = document.querySelector('[data-search-status]');
  if (input && list) {
    var params = new URLSearchParams(location.search);
    input.value = params.get('q') || '';
    var idx = null;
    var run = function () {
      var q = fold(input.value).trim();
      if (!idx) return;
      var terms = q.split(/\s+/).filter(Boolean);
      if (!terms.length) {
        list.innerHTML = '';
        status.textContent = '';
        return;
      }
      var scored = [];
      idx.forEach(function (d) {
        var title = fold(d.t),
          kw = fold(d.k),
          desc = fold(d.d),
          head = fold(d.h),
          text = fold(d.b),
          mod = fold(d.m);
        var score = 0;
        for (var i = 0; i < terms.length; i++) {
          var w = terms[i];
          var s = 0;
          if (title.indexOf(w) >= 0) s += title.indexOf(w) === 0 ? 14 : 10;
          if (kw.indexOf(w) >= 0) s += 7;
          if (desc.indexOf(w) >= 0) s += 4;
          if (head.indexOf(w) >= 0) s += 3;
          if (mod.indexOf(w) >= 0) s += 2;
          if (text.indexOf(w) >= 0) s += 1;
          if (!s) return; // every term must match somewhere
          score += s;
        }
        if (title.indexOf(q) >= 0 || kw.indexOf(q) >= 0) score += 12; // whole phrase
        scored.push([score, d]);
      });
      scored.sort(function (a, b) {
        return b[0] - a[0];
      });
      var top = scored.slice(0, 40);
      status.textContent = top.length
        ? scored.length + ' ' + (status.getAttribute('data-word') || 'results')
        : status.getAttribute('data-none') || 'No results.';
      list.innerHTML = top
        .map(function (x) {
          var d = x[1];
          var snippet = d.d;
          var bi = fold(d.b).indexOf(terms[0]);
          if (bi > 40) snippet = '…' + d.b.slice(bi - 40, bi + 140) + '…';
          return (
            '<li><a href="' +
            root +
            prefix +
            d.u +
            '">' +
            escapeHtml(d.t) +
            '</a><p>' +
            escapeHtml(d.m) +
            ' — ' +
            escapeHtml(snippet) +
            '</p></li>'
          );
        })
        .join('');
    };
    fetch(root + 'assets/search-' + lang + '.json')
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        idx = data;
        run();
      });
    input.addEventListener('input', function () {
      var u = new URL(location.href);
      u.searchParams.set('q', input.value);
      history.replaceState(null, '', u);
      run();
    });
  }

  // Contextual help: go.html#<app>/<route>  or  go.html#id/<helpId>
  var goStatus = document.querySelector('[data-go-status]');
  if (goStatus) {
    var h = decodeURIComponent(location.hash.replace(/^#/, ''));
    var slash = h.indexOf('/');
    var kind = slash < 0 ? h : h.slice(0, slash);
    var rest = slash < 0 ? '' : h.slice(slash + 1);
    fetch(root + 'assets/help-map.json')
      .then(function (r) {
        return r.json();
      })
      .then(function (map) {
        var id = null;
        if (kind === 'id')
          id =
            map.helpIds[rest] ||
            (map.restricted.indexOf(rest) >= 0 ? rest : null);
        else if (map.screens[kind]) {
          var screens = map.screens[kind];
          var key =
            kind === 'admin'
              ? rest.replace(/^\//, '')
              : '/' + rest.replace(/^\//, '');
          id = screens[key];
          if (!id && kind !== 'admin') {
            // match route patterns such as /task/:id
            Object.keys(screens).forEach(function (p) {
              var re = new RegExp('^' + p.replace(/:[^/]+/g, '[^/]+') + '$');
              if (!id && re.test(key)) id = screens[p];
            });
          }
        }
        if (id && map.public.indexOf(id) >= 0) {
          location.replace(root + prefix + 'a/' + id + '.html');
        } else if (id && map.restricted.indexOf(id) >= 0) {
          goStatus.textContent =
            goStatus.getAttribute('data-restricted') ||
            'This topic is documented in a restricted manual.';
        } else {
          location.replace(
            root +
              prefix +
              'search.html?q=' +
              encodeURIComponent(rest.replace(/[/:.-]+/g, ' ').trim()),
          );
        }
      });
  }
})();
