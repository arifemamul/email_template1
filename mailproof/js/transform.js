/*
 * Mailproof :: transforms
 * ------------------------------------------------------------------
 * Auto-fixes, the plain-text alternative, and the client simulations that
 * feed the preview pane.
 */
(function (root) {
  'use strict';

  /* --------------------------------------------------------- serialisation */

  // DOMParser normalises the doctype away, so keep the original line verbatim.
  function extractDoctype(source) {
    var m = source.match(/<!DOCTYPE[^>]*>/i);
    return m ? m[0] : '';
  }

  function serialize(doc, doctype) {
    var html = doc.documentElement ? doc.documentElement.outerHTML : '';
    return (doctype ? doctype + '\n' : '') + html + '\n';
  }

  /* ------------------------------------------------------------- auto-fix */

  var FIXES = {
    inline: {
      label: 'Inline head CSS onto elements',
      apply: function (doc, ctx) {
        var styles = Array.prototype.slice.call(doc.querySelectorAll('style'));
        if (!styles.length) return 0;
        var css = styles.map(function (s) { return s.textContent; }).join('\n');
        var sheet = root.MailproofInliner.parseStylesheet(css);
        var result = root.MailproofInliner.inline(doc, sheet);
        // Collapse every style block into one that keeps only what must stay.
        styles.forEach(function (s, i) {
          if (i === 0) {
            if (result.keptCss.trim()) s.textContent = '\n' + result.keptCss + '\n';
            else if (s.parentNode) s.parentNode.removeChild(s);
          } else if (s.parentNode) {
            s.parentNode.removeChild(s);
          }
        });
        return result.elements;
      }
    },
    alt: {
      label: 'Add missing alt attributes',
      apply: function (doc) {
        var n = 0;
        Array.prototype.forEach.call(doc.querySelectorAll('img'), function (img) {
          if (img.getAttribute('alt') === null) {
            // Empty alt is the honest default: it marks the image decorative
            // rather than inventing copy. Meaningful images need a human.
            img.setAttribute('alt', '');
            n++;
          }
        });
        return n;
      }
    },
    role: {
      label: 'Mark layout tables role="presentation"',
      apply: function (doc) {
        var n = 0;
        Array.prototype.forEach.call(doc.querySelectorAll('table'), function (t) {
          if ((t.getAttribute('role') || '').toLowerCase() === 'presentation') return;
          if (t.querySelector('th') || t.querySelector('caption')) return;
          t.setAttribute('role', 'presentation');
          n++;
        });
        return n;
      }
    },
    tableattrs: {
      label: 'Add table border/cellpadding/cellspacing resets',
      apply: function (doc) {
        var n = 0;
        Array.prototype.forEach.call(doc.querySelectorAll('table'), function (t) {
          var changed = false;
          [['border', '0'], ['cellpadding', '0'], ['cellspacing', '0']].forEach(function (pair) {
            if (t.getAttribute(pair[0]) === null) { t.setAttribute(pair[0], pair[1]); changed = true; }
          });
          if (changed) n++;
        });
        return n;
      }
    },
    colorscheme: {
      label: 'Declare dark-mode support',
      apply: function (doc) {
        var head = doc.querySelector('head');
        if (!head) return 0;
        var n = 0;
        [['color-scheme', 'light dark'], ['supported-color-schemes', 'light dark']].forEach(function (pair) {
          if (doc.querySelector('meta[name="' + pair[0] + '" i]')) return;
          var meta = doc.createElement('meta');
          meta.setAttribute('name', pair[0]);
          meta.setAttribute('content', pair[1]);
          head.appendChild(meta);
          n++;
        });
        return n;
      }
    },
    lang: {
      label: 'Add lang attribute',
      apply: function (doc) {
        var html = doc.documentElement;
        if (!html || html.getAttribute('lang')) return 0;
        html.setAttribute('lang', 'en');
        return 1;
      }
    },
    comments: {
      label: 'Strip author comments (keeps conditionals)',
      apply: function (doc) {
        var removed = 0;
        var walker = doc.createTreeWalker(doc.documentElement, 128 /* SHOW_COMMENT */, null);
        var doomed = [];
        var node;
        while ((node = walker.nextNode())) {
          var text = node.nodeValue || '';
          // Outlook conditionals and ESP markers have to survive.
          if (/^\s*\[if|<!\[endif\]|^\s*\[endif\]/i.test(text)) continue;
          if (/^\s*\*\|/.test(text)) continue;
          doomed.push(node);
        }
        doomed.forEach(function (c) {
          if (c.parentNode) { c.parentNode.removeChild(c); removed++; }
        });
        return removed;
      }
    },
    imgblock: {
      label: 'Add display:block to images',
      apply: function (doc) {
        var n = 0;
        Array.prototype.forEach.call(doc.querySelectorAll('img'), function (img) {
          var s = img.getAttribute('style') || '';
          if (/display\s*:/.test(s)) return;
          img.setAttribute('style', (s ? s.replace(/;\s*$/, '') + '; ' : '') + 'display:block');
          n++;
        });
        return n;
      }
    }
  };

  var FIX_ORDER = ['comments', 'inline', 'alt', 'role', 'tableattrs', 'imgblock', 'lang', 'colorscheme'];

  function autofix(doc, selected) {
    var log = [];
    FIX_ORDER.forEach(function (key) {
      if (selected && selected.indexOf(key) === -1) return;
      var n = 0;
      try { n = FIXES[key].apply(doc) || 0; } catch (err) { n = 0; }
      if (n) log.push({ key: key, label: FIXES[key].label, count: n });
    });
    return log;
  }

  /* ---------------------------------------------------------- plain text */

  function wrap(text, width) {
    var out = [];
    text.split('\n').forEach(function (line) {
      if (line.length <= width) { out.push(line); return; }
      var current = '';
      line.split(/\s+/).forEach(function (word) {
        if ((current + ' ' + word).trim().length > width) {
          out.push(current.trim());
          current = word;
        } else {
          current = (current + ' ' + word).trim();
        }
      });
      if (current) out.push(current);
    });
    return out.join('\n');
  }

  function toPlainText(doc) {
    var body = doc.body;
    if (!body) return '';
    var parts = [];

    function isHidden(el) {
      var s = (el.getAttribute && el.getAttribute('style') || '').toLowerCase();
      return /display\s*:\s*none|max-height\s*:\s*0|font-size\s*:\s*0|opacity\s*:\s*0/.test(s);
    }

    function walk(node) {
      if (node.nodeType === 3) {
        var t = node.nodeValue.replace(/\s+/g, ' ');
        if (t.trim()) parts.push(t);
        return;
      }
      if (node.nodeType !== 1) return;
      var tag = node.tagName.toLowerCase();
      if (tag === 'style' || tag === 'script' || tag === 'head' || tag === 'title') return;
      if (isHidden(node)) return;

      if (tag === 'img') {
        var alt = node.getAttribute('alt');
        if (alt && alt.trim()) parts.push('[' + alt.trim() + ']');
        return;
      }
      if (tag === 'br') { parts.push('\n'); return; }
      if (tag === 'hr') { parts.push('\n' + '-'.repeat(40) + '\n'); return; }

      if (/^h[1-6]$/.test(tag)) {
        parts.push('\n\n');
        Array.prototype.forEach.call(node.childNodes, walk);
        var head = parts.pop() || '';
        parts.push(head.toUpperCase());
        parts.push('\n' + '='.repeat(Math.min(60, Math.max(3, head.trim().length))) + '\n');
        return;
      }
      if (tag === 'li') { parts.push('\n  * '); Array.prototype.forEach.call(node.childNodes, walk); return; }
      if (tag === 'a') {
        var before = parts.length;
        Array.prototype.forEach.call(node.childNodes, walk);
        var href = node.getAttribute('href') || '';
        var label = parts.slice(before).join('').trim();
        if (href && !/^#/.test(href) && label && label !== href) parts.push(' <' + href + '>');
        else if (href && !label) parts.push(href);
        return;
      }

      Array.prototype.forEach.call(node.childNodes, walk);

      if (/^(p|div|tr|table|section|footer|header|ul|ol)$/.test(tag)) parts.push('\n\n');
      if (tag === 'td' || tag === 'th') parts.push('  ');
    }

    walk(body);

    var text = parts.join('')
      .replace(/[ \t]+/g, ' ')
      .replace(/ *\n */g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    return wrap(text, 72);
  }

  /* --------------------------------------------------------- simulations */

  // Outlook and most corporate clients block remote images until asked. This
  // swaps every remote image for its alt text in a dashed placeholder, which is
  // what a large share of recipients genuinely see first.
  function simulateImagesOff(doc) {
    Array.prototype.forEach.call(doc.querySelectorAll('img'), function (img) {
      var alt = (img.getAttribute('alt') || '').trim();
      var width = img.getAttribute('width') || '';
      var span = doc.createElement('span');
      span.setAttribute('style',
        'display:inline-block;box-sizing:border-box;' +
        (width ? 'width:' + width + 'px;' : 'min-width:40px;') +
        'padding:6px 8px;border:1px dashed #b0b0b0;background:#f4f4f4;color:#666;' +
        'font:11px/1.3 -apple-system,Segoe UI,Arial,sans-serif;vertical-align:middle;');
      span.textContent = alt || '⚠ image, no alt text';
      if (img.parentNode) img.parentNode.replaceChild(span, img);
    });
  }

  // Outlook.com-style forced inversion: the client flips colours wholesale
  // rather than honouring prefers-color-scheme.
  var FORCED_DARK_CSS =
    'html{background:#1b1b1b !important;}' +
    'body{filter:invert(1) hue-rotate(180deg) !important;background:#1b1b1b !important;}' +
    'img,video{filter:invert(1) hue-rotate(180deg) !important;}';

  // Apple Mail-style: honours color-scheme, so we just darken the chrome and
  // let any prefers-color-scheme rules in the email do their job.
  var NATIVE_DARK_CSS =
    ':root{color-scheme:dark;}html{background:#1b1b1b !important;}';

  function injectPreviewCss(doc, css) {
    var head = doc.querySelector('head') || doc.documentElement;
    var style = doc.createElement('style');
    style.setAttribute('data-mailproof', 'preview');
    style.textContent = css;
    head.appendChild(style);
  }

  root.MailproofTransform = {
    FIXES: FIXES,
    FIX_ORDER: FIX_ORDER,
    autofix: autofix,
    toPlainText: toPlainText,
    extractDoctype: extractDoctype,
    serialize: serialize,
    simulateImagesOff: simulateImagesOff,
    injectPreviewCss: injectPreviewCss,
    FORCED_DARK_CSS: FORCED_DARK_CSS,
    NATIVE_DARK_CSS: NATIVE_DARK_CSS
  };
})(typeof window !== 'undefined' ? window : globalThis);
