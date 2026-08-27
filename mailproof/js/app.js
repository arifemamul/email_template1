/*
 * Mailproof :: application shell
 * Wires the editor, the preview simulations and the report together.
 * No network calls: everything below runs against the DOM in this tab.
 */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var parser = new DOMParser();

  var state = {
    source: '',
    audit: null,
    doctype: '',
    fixedHtml: '',
    width: 680,
    scheme: 'light',
    imagesOff: false,
    showFixed: false,
    scale: 1,
    filter: 'all'
  };

  var els = {
    source: $('source'),
    gutter: $('gutter'),
    sizeBadge: $('size-badge'),
    sizeFill: $('size-fill'),
    sizeLabel: $('size-label'),
    preview: $('preview'),
    previewNote: $('preview-note'),
    findings: $('findings'),
    scoreRing: $('score-ring'),
    scoreValue: $('score-value'),
    fixlist: $('fixlist'),
    fixlog: $('fixlog'),
    plaintext: $('plaintext'),
    textBadge: $('text-badge'),
    toast: $('toast')
  };

  /* ------------------------------------------------------------ plumbing */

  function toast(message) {
    els.toast.textContent = message;
    els.toast.classList.add('is-visible');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { els.toast.classList.remove('is-visible'); }, 2200);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function byteLength(str) {
    return new Blob([str]).size;
  }

  function parse(source) {
    return parser.parseFromString(source, 'text/html');
  }

  /* -------------------------------------------------------------- editor */

  function syncGutter() {
    var lines = els.source.value.split('\n').length;
    var buf = [];
    for (var i = 1; i <= lines; i++) buf.push(i);
    els.gutter.textContent = buf.join('\n');
    els.gutter.scrollTop = els.source.scrollTop;
  }

  function gotoLine(n) {
    var lines = els.source.value.split('\n');
    var index = 0;
    for (var i = 0; i < n - 1 && i < lines.length; i++) index += lines[i].length + 1;
    els.source.focus();
    els.source.setSelectionRange(index, index + (lines[n - 1] || '').length);
    var lh = parseFloat(getComputedStyle(els.source).lineHeight) || 19;
    els.source.scrollTop = Math.max(0, (n - 1) * lh - els.source.clientHeight / 2);
    syncGutter();
  }

  function updateSizeMeter(bytes) {
    var kb = bytes / 1024;
    els.sizeBadge.textContent = kb.toFixed(1) + ' KB';
    var pct = Math.min(100, (bytes / 102400) * 100);
    els.sizeFill.style.width = pct + '%';
    els.sizeFill.classList.toggle('is-warn', bytes > 92160 && bytes <= 102400);
    els.sizeFill.classList.toggle('is-over', bytes > 102400);
    if (bytes > 102400) {
      els.sizeLabel.textContent = 'Over the 102 KB Gmail clip limit by ' + ((bytes - 102400) / 1024).toFixed(1) + ' KB';
    } else {
      els.sizeLabel.textContent = kb.toFixed(1) + ' KB of the 102 KB Gmail clip limit';
    }
  }

  /* ------------------------------------------------------------- preview */

  function buildPreviewHtml() {
    var source = (state.showFixed && state.fixedHtml) ? state.fixedHtml : state.source;
    if (!source.trim()) return '<!doctype html><html><body style="font:13px sans-serif;color:#999;padding:24px">Nothing to preview yet.</body></html>';

    var doc = parse(source);
    var T = window.MailproofTransform;

    if (state.imagesOff) T.simulateImagesOff(doc);
    if (state.scheme === 'forced') T.injectPreviewCss(doc, T.FORCED_DARK_CSS);
    if (state.scheme === 'native') T.injectPreviewCss(doc, T.NATIVE_DARK_CSS);

    return T.serialize(doc, state.doctype);
  }

  // Scale the frame down when the pane is narrower than the simulated client,
  // so the whole email stays visible at its true proportions.
  function fitPreview(contentHeight) {
    var stage = $('preview-stage');
    var frame = $('preview-frame');
    var available = stage.clientWidth - 32;
    var scale = Math.min(1, available / state.width);
    var height = contentHeight || parseFloat(els.preview.style.height) || 400;

    els.preview.style.width = state.width + 'px';
    els.preview.style.height = height + 'px';
    els.preview.style.transform = 'scale(' + scale + ')';
    frame.style.width = Math.round(state.width * scale) + 'px';
    frame.style.height = Math.round(height * scale) + 'px';
    state.scale = scale;
  }

  function renderPreview() {
    els.preview.srcdoc = buildPreviewHtml();
    fitPreview();

    renderPreviewNote();
  }

  function renderPreviewNote() {
    var notes = [];
    if (state.scheme === 'forced') notes.push('Outlook.com-style forced inversion: the client flips your palette wholesale, images included.');
    else if (state.scheme === 'native') notes.push('Apple Mail-style: honours color-scheme and your prefers-color-scheme rules.');
    if (state.imagesOff) notes.push('Images blocked, as Outlook and most corporate clients do by default.');
    if (state.showFixed) notes.push('Showing the auto-fixed output.');
    if (state.scale && state.scale < 0.999) {
      notes.push('Shown at ' + Math.round(state.scale * 100) + '% to fit the pane; the email is rendered at ' + state.width + 'px.');
    }
    els.previewNote.textContent = notes.length ? notes.join(' ') :
      'Dark-mode views are approximations of how each client transforms your colours.';
  }

  // Grow the frame to its content so the stage scrolls, not the frame.
  els.preview.addEventListener('load', function () {
    try {
      var body = els.preview.contentDocument && els.preview.contentDocument.body;
      if (!body) return;
      var h = Math.max(body.scrollHeight, body.offsetHeight, 400);
      fitPreview(Math.min(h + 24, 20000));
      renderPreviewNote();
    } catch (err) { /* cross-origin guard: leave the default height */ }
  });

  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () { fitPreview(); renderPreviewNote(); }, 120);
  });

  /* -------------------------------------------------------------- report */

  function ringColor(score) {
    if (score >= 80) return 'var(--pass)';
    if (score >= 55) return 'var(--warning)';
    return 'var(--blocker)';
  }

  function renderScore(result) {
    els.scoreValue.textContent = result.score;
    els.scoreRing.style.background =
      'conic-gradient(' + ringColor(result.score) + ' ' + (result.score * 3.6) + 'deg, var(--line) 0deg)';
    $('count-blocker').textContent = result.counts.blocker;
    $('count-warning').textContent = result.counts.warning;
    $('count-info').textContent = result.counts.info;
    $('count-passed').textContent = result.passed + ' / ' + result.total;
  }

  function renderFindings() {
    var result = state.audit;
    if (!result) return;

    var list = result.findings.filter(function (f) {
      return state.filter === 'all' || f.severity === state.filter;
    });

    if (!list.length) {
      els.findings.innerHTML = '<p class="empty">' +
        (result.findings.length ? 'Nothing in this category.' : 'Clean run — no issues found.') + '</p>';
      return;
    }

    els.findings.innerHTML = list.map(function (f) {
      var hits = f.hits.slice(0, 12).map(function (h) {
        return '<li class="hit">' +
          (h.line ? '<span class="hit-line" data-line="' + h.line + '">line ' + h.line + '</span>' : '') +
          escapeHtml(h.message) +
          (h.snippet ? '<code class="hit-snippet">' + escapeHtml(h.snippet) + '</code>' : '') +
          '</li>';
      }).join('');
      var more = f.hits.length > 12 ? '<p class="hits-more">+ ' + (f.hits.length - 12) + ' more</p>' : '';

      return '<article class="finding" data-severity="' + f.severity + '" data-id="' + f.id + '">' +
        '<button type="button" class="finding-head">' +
          '<span class="dot dot-' + f.severity + '"></span>' +
          '<span class="finding-title">' + escapeHtml(f.title) + '</span>' +
          '<span class="finding-count">' + f.count + '</span>' +
          '<span class="finding-caret">▶</span>' +
        '</button>' +
        '<div class="finding-body">' +
          '<div class="finding-meta">' +
            '<span class="tag">' + escapeHtml(f.category) + '</span>' +
            f.clients.map(function (c) { return '<span class="tag tag-client">' + escapeHtml(c) + '</span>'; }).join('') +
          '</div>' +
          '<p class="finding-why">' + escapeHtml(f.why) + '</p>' +
          '<p class="finding-fix"><b>Fix:</b> ' + escapeHtml(f.fix) +
            (f.autofix ? ' <em>Available in Auto-fix.</em>' : '') + '</p>' +
          '<ul class="hits">' + hits + '</ul>' + more +
        '</div>' +
      '</article>';
    }).join('');
  }

  /* --------------------------------------------------------------- fixes */

  function renderFixList() {
    var T = window.MailproofTransform;
    var notes = {
      comments: 'Keeps <!--[if mso]> conditionals and ESP merge markers.',
      inline: 'Media queries and :hover rules stay in the head, where they belong.',
      alt: 'Adds alt="" (decorative). Meaningful images still need copy you write.',
      role: 'Skips tables that contain <th> or <caption> — those are real data tables.',
      tableattrs: 'Only fills in attributes that are missing.',
      imgblock: 'Removes the baseline gap under sliced images.',
      lang: 'Sets lang="en"; change it if the campaign is not English.',
      colorscheme: 'Adds both color-scheme meta tags.'
    };
    var defaultOff = { imgblock: true };

    els.fixlist.innerHTML = T.FIX_ORDER.map(function (key) {
      return '<label class="fixrow">' +
        '<input type="checkbox" value="' + key + '"' + (defaultOff[key] ? '' : ' checked') + '>' +
        '<span class="fixrow-label">' + escapeHtml(T.FIXES[key].label) +
          '<span class="fixrow-note">' + escapeHtml(notes[key] || '') + '</span>' +
        '</span>' +
      '</label>';
    }).join('');
  }

  function applyFixes() {
    if (!state.source.trim()) { toast('Load an email first.'); return; }
    var selected = Array.prototype.slice
      .call(els.fixlist.querySelectorAll('input:checked'))
      .map(function (i) { return i.value; });
    if (!selected.length) { toast('Select at least one fix.'); return; }

    var doc = parse(state.source);
    var log = window.MailproofTransform.autofix(doc, selected);
    state.fixedHtml = window.MailproofTransform.serialize(doc, state.doctype);

    var before = byteLength(state.source);
    var after = byteLength(state.fixedHtml);
    var delta = before - after;

    els.fixlog.textContent = (log.length
      ? log.map(function (l) { return '✓ ' + l.label + ' — ' + l.count + ' change(s)'; }).join('\n')
      : 'Nothing to change; the source already passes these fixes.') +
      '\n\nSize ' + (before / 1024).toFixed(1) + ' KB → ' + (after / 1024).toFixed(1) + ' KB' +
      (delta > 0 ? '  (saved ' + (delta / 1024).toFixed(1) + ' KB)' : delta < 0 ? '  (grew ' + (-delta / 1024).toFixed(1) + ' KB — inlining trades head bytes for attribute bytes)' : '');

    $('preview-fixed').checked = true;
    state.showFixed = true;
    renderPreview();
    toast(log.length ? 'Applied ' + log.length + ' fix type(s).' : 'Nothing to fix.');
  }

  function download() {
    var html = state.fixedHtml || state.source;
    if (!html.trim()) { toast('Nothing to download.'); return; }
    var blob = new Blob([html], { type: 'text/html' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'email-mailproofed.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  function copy(text, label) {
    if (!text) { toast('Nothing to copy.'); return; }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { toast(label + ' copied.'); },
        function () { toast('Clipboard blocked by the browser.'); });
    } else {
      toast('Clipboard unavailable in this context.');
    }
  }

  /* ------------------------------------------------------------- analyse */

  function analyse() {
    var source = els.source.value;
    state.source = source;
    state.fixedHtml = '';
    state.doctype = window.MailproofTransform.extractDoctype(source);

    var bytes = byteLength(source);
    updateSizeMeter(bytes);
    syncGutter();

    if (!source.trim()) {
      state.audit = null;
      els.findings.innerHTML = '<p class="empty">Load an email and run preflight to see what breaks, where, and why.</p>';
      els.scoreValue.textContent = '—';
      els.scoreRing.style.background = 'conic-gradient(var(--line) 0deg, var(--line) 0deg)';
      ['count-blocker', 'count-warning', 'count-info'].forEach(function (id) { $(id).textContent = '0'; });
      $('count-passed').textContent = '0';
      els.plaintext.textContent = '';
      renderPreview();
      return;
    }

    var doc = parse(source);
    var css = Array.prototype.slice.call(doc.querySelectorAll('style'))
      .map(function (s) { return s.textContent; }).join('\n');
    var sheet = window.MailproofInliner.parseStylesheet(css);

    var ctx = {
      source: source,
      sourceNoComments: source.replace(/<!--(?!\[if)[\s\S]*?-->/g, ''),
      lines: source.split('\n'),
      bytes: bytes,
      doc: doc,
      sheet: sheet,
      inlinePlan: window.MailproofInliner.plan(doc, sheet)
    };

    state.audit = window.MailproofRules.audit(ctx);
    renderScore(state.audit);
    renderFindings();

    var text = window.MailproofTransform.toPlainText(parse(source));
    els.plaintext.textContent = text;
    els.textBadge.textContent = text.length.toLocaleString() + ' chars';

    renderPreview();
  }

  var debounceTimer;
  function scheduleAnalyse() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(analyse, 450);
  }

  function load(source, label) {
    els.source.value = source;
    analyse();
    if (label) toast(label);
  }

  /* -------------------------------------------------------------- events */

  els.source.addEventListener('input', function () { syncGutter(); scheduleAnalyse(); });
  els.source.addEventListener('scroll', function () { els.gutter.scrollTop = els.source.scrollTop; });

  $('btn-run').addEventListener('click', function () { analyse(); toast('Preflight complete.'); });
  $('btn-clear').addEventListener('click', function () { load('', 'Cleared.'); });
  $('btn-sample').addEventListener('click', function () { load(window.MAILPROOF_SAMPLE, 'Loaded the sample campaign.'); });

  $('btn-repo').addEventListener('click', function () {
    fetch('../index.html')
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
      .then(function (t) { load(t, 'Loaded this repo\'s email template.'); })
      .catch(function () {
        toast('Could not read ../index.html — serve the folder over http (python3 -m http.server).');
      });
  });

  $('file-input').addEventListener('change', function (e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    file.text().then(function (t) { load(t, 'Loaded ' + file.name); });
  });

  var editor = document.querySelector('.editor');
  ['dragenter', 'dragover'].forEach(function (evt) {
    editor.addEventListener(evt, function (e) { e.preventDefault(); editor.classList.add('is-dragover'); });
  });
  ['dragleave', 'drop'].forEach(function (evt) {
    editor.addEventListener(evt, function (e) { e.preventDefault(); editor.classList.remove('is-dragover'); });
  });
  editor.addEventListener('drop', function (e) {
    var file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (file) file.text().then(function (t) { load(t, 'Loaded ' + file.name); });
  });

  document.querySelectorAll('[data-width]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('[data-width]').forEach(function (b) { b.classList.remove('is-active'); });
      btn.classList.add('is-active');
      state.width = parseInt(btn.dataset.width, 10);
      renderPreview();
    });
  });

  document.querySelectorAll('[data-scheme]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('[data-scheme]').forEach(function (b) { b.classList.remove('is-active'); });
      btn.classList.add('is-active');
      state.scheme = btn.dataset.scheme;
      renderPreview();
    });
  });

  $('images-off').addEventListener('change', function (e) { state.imagesOff = e.target.checked; renderPreview(); });
  $('preview-fixed').addEventListener('change', function (e) {
    state.showFixed = e.target.checked;
    if (state.showFixed && !state.fixedHtml) { toast('Apply fixes first.'); e.target.checked = false; state.showFixed = false; return; }
    renderPreview();
  });

  document.querySelectorAll('[data-tab]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('[data-tab]').forEach(function (b) { b.classList.remove('is-active'); });
      btn.classList.add('is-active');
      document.querySelectorAll('.tab-panel').forEach(function (p) { p.classList.remove('is-active'); });
      $('tab-' + btn.dataset.tab).classList.add('is-active');
    });
  });

  document.querySelectorAll('[data-filter]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('[data-filter]').forEach(function (b) { b.classList.remove('is-active'); });
      btn.classList.add('is-active');
      state.filter = btn.dataset.filter;
      renderFindings();
    });
  });

  els.findings.addEventListener('click', function (e) {
    var lineEl = e.target.closest('.hit-line');
    if (lineEl) { gotoLine(parseInt(lineEl.dataset.line, 10)); return; }
    var head = e.target.closest('.finding-head');
    if (head) head.parentNode.classList.toggle('is-open');
  });

  $('btn-autofix').addEventListener('click', applyFixes);
  $('btn-download').addEventListener('click', download);
  $('btn-copy').addEventListener('click', function () { copy(state.fixedHtml || state.source, 'HTML'); });
  $('btn-copy-text').addEventListener('click', function () { copy(els.plaintext.textContent, 'Plain text'); });

  /* ---------------------------------------------------------------- boot */

  renderFixList();
  load(window.MAILPROOF_SAMPLE || '');

  // Handle for the console and for automated checks.
  window.Mailproof = { state: state, analyse: analyse, load: load };
})();
