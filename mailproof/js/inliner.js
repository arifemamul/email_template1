/*
 * Mailproof :: CSS inliner
 * ------------------------------------------------------------------
 * Email clients are wildly inconsistent about honouring <style> blocks.
 * Gmail serving a non-Gmail account (the "GANGA" case), older Yahoo builds
 * and a handful of mobile clients strip the head entirely, so anything that
 * matters has to live in a style="" attribute on the element itself.
 *
 * This module parses a stylesheet by hand (no dependencies, no CSSOM -- the
 * browser's CSSOM drops declarations it doesn't understand, which is exactly
 * the stuff email people care about) and pushes every inlinable declaration
 * onto the elements it matches, respecting specificity, source order and
 * !important. Media queries and pseudo-class rules cannot be inlined, so they
 * stay behind in the head.
 */
(function (root) {
  'use strict';

  /* ---------------------------------------------------------------- parse */

  function stripComments(css) {
    return css.replace(/\/\*[\s\S]*?\*\//g, '');
  }

  function matchBrace(src, openIndex) {
    var depth = 0;
    for (var i = openIndex; i < src.length; i++) {
      if (src[i] === '{') depth++;
      else if (src[i] === '}') {
        depth--;
        if (depth === 0) return i;
      }
    }
    return src.length - 1;
  }

  // Split on `;` while ignoring separators inside quotes or url(...)
  function splitDeclarations(body) {
    var parts = [];
    var buf = '';
    var depth = 0;
    var quote = null;
    for (var i = 0; i < body.length; i++) {
      var c = body[i];
      if (quote) {
        buf += c;
        if (c === quote && body[i - 1] !== '\\') quote = null;
        continue;
      }
      if (c === '"' || c === "'") { quote = c; buf += c; continue; }
      if (c === '(') depth++;
      if (c === ')') depth--;
      if (c === ';' && depth === 0) { parts.push(buf); buf = ''; continue; }
      buf += c;
    }
    parts.push(buf);
    return parts;
  }

  function parseDeclarations(body) {
    var out = [];
    splitDeclarations(body).forEach(function (chunk) {
      var text = chunk.trim();
      if (!text) return;
      var colon = text.indexOf(':');
      if (colon < 1) return;
      var prop = text.slice(0, colon).trim().toLowerCase();
      var value = text.slice(colon + 1).trim();
      var important = /!\s*important\s*$/i.test(value);
      if (important) value = value.replace(/!\s*important\s*$/i, '').trim();
      if (!prop || !value) return;
      out.push({ prop: prop, value: value, important: important });
    });
    return out;
  }

  // a=ids, b=classes/attributes/pseudo-classes, c=types/pseudo-elements
  function specificity(selector) {
    var sel = selector.replace(/\[[^\]]*\]/g, '[]');
    var a = (sel.match(/#[\w-]+/g) || []).length;
    var b = (sel.match(/\.[\w-]+/g) || []).length +
            (sel.match(/\[\]/g) || []).length +
            (sel.match(/:(?!:)[\w-]+/g) || []).length;
    var c = (sel.match(/(^|[\s>+~])[a-zA-Z][\w-]*/g) || []).length +
            (sel.match(/::[\w-]+/g) || []).length;
    return a * 10000 + b * 100 + c;
  }

  // Anything stateful or generated cannot become a style="" attribute.
  var UNINLINABLE = /::|:(hover|active|focus|visited|link|target|checked|first-child|last-child|nth-|not\(|before|after|root)/i;

  function isInlinable(selector) {
    if (!selector) return false;
    if (UNINLINABLE.test(selector)) return false;
    if (selector.indexOf('*') === 0 && selector.length === 1) return true;
    return true;
  }

  function parseStylesheet(cssText) {
    var src = stripComments(cssText || '');
    var sheet = { rules: [], atRules: [] };
    var i = 0;
    var order = 0;

    while (i < src.length) {
      while (i < src.length && /\s/.test(src[i])) i++;
      if (i >= src.length) break;

      if (src[i] === '@') {
        var j = i;
        var depth = 0;
        var opened = false;
        while (j < src.length) {
          var ch = src[j];
          if (ch === '{') { depth++; opened = true; }
          else if (ch === '}') { depth--; if (depth === 0) { j++; break; } }
          else if (ch === ';' && !opened) { j++; break; }
          j++;
        }
        var text = src.slice(i, j);
        var name = (text.match(/^@([\w-]+)/) || [])[1] || '';
        var braceAt = text.indexOf('{');
        sheet.atRules.push({
          name: name.toLowerCase(),
          prelude: text.slice(1 + name.length, braceAt > -1 ? braceAt : text.length).trim(),
          text: text.trim(),
          order: order++
        });
        i = j;
        continue;
      }

      var open = src.indexOf('{', i);
      if (open === -1) break;
      var close = matchBrace(src, open);
      var selectorText = src.slice(i, open).trim();
      var body = src.slice(open + 1, close);

      if (selectorText) {
        var decls = parseDeclarations(body);
        selectorText.split(',').forEach(function (sel) {
          sel = sel.trim();
          if (!sel) return;
          sheet.rules.push({
            selector: sel,
            declarations: decls,
            specificity: specificity(sel),
            order: order,
            inlinable: isInlinable(sel),
            body: body.trim()
          });
        });
        order++;
      }
      i = close + 1;
    }
    return sheet;
  }

  /* --------------------------------------------------------------- inline */

  function parseInlineStyle(attr) {
    var map = {};
    parseDeclarations(attr || '').forEach(function (d) {
      // An existing style="" attribute already beats every stylesheet rule.
      map[d.prop] = { value: d.value, important: d.important, specificity: Infinity, order: Infinity, fromAttr: true };
    });
    return map;
  }

  function beats(candidate, incumbent) {
    if (!incumbent) return true;
    if (candidate.important !== incumbent.important) return candidate.important;
    if (candidate.specificity !== incumbent.specificity) return candidate.specificity > incumbent.specificity;
    return candidate.order >= incumbent.order;
  }

  function serialize(map, originalOrder) {
    var props = Object.keys(map);
    props.sort(function (a, b) {
      var ai = originalOrder.indexOf(a);
      var bi = originalOrder.indexOf(b);
      if (ai === -1 && bi === -1) return 0;
      if (ai === -1) return -1;   // newly inlined declarations come first
      if (bi === -1) return 1;
      return ai - bi;
    });
    return props.map(function (p) {
      return p + ':' + map[p].value + (map[p].important ? ' !important' : '');
    }).join('; ');
  }

  /**
   * Inline every inlinable rule of `sheet` into `doc`.
   * Returns { elements, declarations, skippedRules, keptCss }.
   */
  function inline(doc, sheet, options) {
    options = options || {};
    var pending = new Map();
    var skipped = [];

    sheet.rules.forEach(function (rule) {
      if (!rule.inlinable) { skipped.push(rule); return; }
      var matches;
      try {
        matches = doc.querySelectorAll(rule.selector);
      } catch (err) {
        skipped.push(rule);
        return;
      }
      Array.prototype.forEach.call(matches, function (el) {
        var tag = el.tagName ? el.tagName.toLowerCase() : '';
        if (tag === 'html' || tag === 'head' || tag === 'style' || tag === 'title' || tag === 'meta') return;
        var map = pending.get(el);
        if (!map) { map = {}; pending.set(el, map); }
        rule.declarations.forEach(function (d) {
          var candidate = {
            value: d.value,
            important: d.important,
            specificity: rule.specificity,
            order: rule.order
          };
          if (beats(candidate, map[d.prop])) map[d.prop] = candidate;
        });
      });
    });

    var elementCount = 0;
    var declarationCount = 0;

    pending.forEach(function (sheetMap, el) {
      var attr = el.getAttribute('style') || '';
      var existing = parseInlineStyle(attr);
      var originalOrder = Object.keys(existing);
      var merged = {};
      var touched = false;

      Object.keys(sheetMap).forEach(function (prop) {
        merged[prop] = sheetMap[prop];
      });
      Object.keys(existing).forEach(function (prop) {
        if (beats(existing[prop], merged[prop])) merged[prop] = existing[prop];
      });
      Object.keys(merged).forEach(function (prop) {
        if (!existing[prop] || existing[prop].value !== merged[prop].value) touched = true;
      });

      var css = serialize(merged, originalOrder);
      if (css) {
        el.setAttribute('style', css);
        if (touched) {
          elementCount++;
          declarationCount += Object.keys(sheetMap).length;
        }
      }
    });

    // Rebuild what has to stay in the head: at-rules plus stateful selectors.
    var keptChunks = [];
    var byOrder = sheet.atRules.slice();
    skipped.forEach(function (r) {
      keptChunks.push({ order: r.order, text: r.selector + ' { ' + r.body + ' }' });
    });
    byOrder.forEach(function (a) {
      keptChunks.push({ order: a.order, text: a.text });
    });
    keptChunks.sort(function (a, b) { return a.order - b.order; });

    return {
      elements: elementCount,
      declarations: declarationCount,
      skippedRules: skipped.length,
      keptCss: keptChunks.map(function (c) { return c.text; }).join('\n')
    };
  }

  /** Dry run: how much would move inline, without touching the document. */
  function plan(doc, sheet) {
    var elements = new Set();
    var declarations = 0;
    sheet.rules.forEach(function (rule) {
      if (!rule.inlinable) return;
      var matches;
      try { matches = doc.querySelectorAll(rule.selector); } catch (err) { return; }
      Array.prototype.forEach.call(matches, function (el) {
        var tag = el.tagName ? el.tagName.toLowerCase() : '';
        if (tag === 'html' || tag === 'head' || tag === 'style' || tag === 'title' || tag === 'meta') return;
        elements.add(el);
        declarations += rule.declarations.length;
      });
    });
    return { elements: elements.size, declarations: declarations };
  }

  root.MailproofInliner = {
    parseStylesheet: parseStylesheet,
    parseDeclarations: parseDeclarations,
    specificity: specificity,
    isInlinable: isInlinable,
    inline: inline,
    plan: plan
  };
})(typeof window !== 'undefined' ? window : globalThis);
