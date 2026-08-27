/*
 * Mailproof :: preflight rules
 * ------------------------------------------------------------------
 * Every rule states three things a linter usually leaves out:
 *   why   -- what actually happens to the subscriber
 *   where -- the clients that get it wrong
 *   fix   -- the concrete change to make
 * Findings are grouped by rule, and each rule can only cost you its weight
 * once, so one email with 200 missing alt attributes still scores sanely.
 */
(function (root) {
  'use strict';

  var WEIGHT = { blocker: 12, warning: 5, info: 1 };

  /* -------------------------------------------------------------- helpers */

  function lineOf(ctx, needle) {
    if (!needle) return null;
    var idx = ctx.source.indexOf(needle);
    if (idx === -1) return null;
    return ctx.source.slice(0, idx).split('\n').length;
  }

  function outer(el, max) {
    var html = (el.outerHTML || '').replace(/\s+/g, ' ').trim();
    max = max || 120;
    return html.length > max ? html.slice(0, max) + '…' : html;
  }

  function hit(ctx, el, message) {
    var snippet = outer(el);
    return {
      message: message,
      snippet: snippet,
      line: lineOf(ctx, (el.outerHTML || '').split('\n')[0].trim().slice(0, 60))
    };
  }

  function textHit(ctx, match, message) {
    return { message: message, snippet: match, line: lineOf(ctx, match) };
  }

  function all(ctx, selector) {
    try { return Array.prototype.slice.call(ctx.doc.querySelectorAll(selector)); }
    catch (e) { return []; }
  }

  function scanSource(ctx, regex, mapper, limit) {
    var out = [];
    var re = new RegExp(regex.source, regex.flags.indexOf('g') === -1 ? regex.flags + 'g' : regex.flags);
    var m;
    while ((m = re.exec(ctx.sourceNoComments)) !== null) {
      out.push(mapper(m));
      if (limit && out.length >= limit) break;
      if (m.index === re.lastIndex) re.lastIndex++;
    }
    return out;
  }

  function styleOf(el) {
    return (el.getAttribute('style') || '').toLowerCase();
  }

  function isAbsolute(url) {
    return /^(https?:|mailto:|tel:|cid:|data:|sms:|#|\{\{|\{%|\*\|)/i.test(url.trim());
  }

  /* ---------------------------------------------------------------- rules */

  var RULES = [

    /* ===== Delivery & document ===== */
    {
      id: 'missing-doctype',
      title: 'No DOCTYPE declaration',
      severity: 'blocker',
      category: 'Document',
      clients: ['Outlook.com', 'Yahoo Mail', 'AOL'],
      why: 'Without a DOCTYPE the client picks its own, usually quirks mode. Line-height, table box-sizing and image spacing all shift, so the layout you approved is not the layout that ships.',
      fix: 'Add <!DOCTYPE html> (or the XHTML 1.0 Strict doctype) as the very first line.',
      run: function (ctx) {
        return /<!doctype/i.test(ctx.source) ? [] : [{ message: 'The document starts without a DOCTYPE.', line: 1 }];
      }
    },
    {
      id: 'gmail-clipping',
      title: 'Message will be clipped by Gmail',
      severity: 'blocker',
      category: 'Delivery',
      clients: ['Gmail (web, iOS, Android)'],
      why: 'Gmail truncates any message body over 102 KB and hides the rest behind a "View entire message" link. Everything past the cut, including your unsubscribe link and tracking pixel, stops rendering, which skews open rates and can breach CAN-SPAM.',
      fix: 'Strip comments and unused CSS, shorten repeated inline styles, and move long content to a landing page.',
      run: function (ctx) {
        var kb = (ctx.bytes / 1024).toFixed(1);
        if (ctx.bytes > 102400) {
          return [{ message: 'HTML body is ' + kb + ' KB, over the 102 KB Gmail clipping threshold.' }];
        }
        return [];
      }
    },
    {
      id: 'size-warning',
      title: 'Close to the Gmail clipping limit',
      severity: 'warning',
      category: 'Delivery',
      clients: ['Gmail'],
      why: 'Merge tags, personalisation and tracking parameters are expanded by your ESP after you hand over the file, so a template that measures under 102 KB locally can cross the line in production.',
      fix: 'Keep the source under about 90 KB to leave headroom for merge-tag expansion.',
      run: function (ctx) {
        if (ctx.bytes > 92160 && ctx.bytes <= 102400) {
          return [{ message: 'HTML body is ' + (ctx.bytes / 1024).toFixed(1) + ' KB; under 90 KB is the safe zone.' }];
        }
        return [];
      }
    },
    {
      id: 'external-stylesheet',
      title: 'External stylesheet will never load',
      severity: 'blocker',
      category: 'CSS delivery',
      clients: ['Every major client'],
      why: 'No mail client fetches remote stylesheets. The rules simply never apply, and the email falls back to unstyled HTML.',
      fix: 'Move the rules into a <style> block, then inline them.',
      run: function (ctx) {
        return all(ctx, 'link[rel~="stylesheet" i], link[href$=".css" i]').map(function (el) {
          return hit(ctx, el, 'Remote stylesheet reference: ' + (el.getAttribute('href') || ''));
        });
      }
    },
    {
      id: 'script-tag',
      title: 'Script tag present',
      severity: 'blocker',
      category: 'Delivery',
      clients: ['Every major client'],
      why: 'Scripts are stripped by every mailbox provider, and their presence is a well-known spam-filter signal that can send the whole campaign to junk.',
      fix: 'Delete the script. Anything interactive has to be done with CSS or moved to a landing page.',
      run: function (ctx) {
        return all(ctx, 'script').map(function (el) { return hit(ctx, el, 'Script element found.'); });
      }
    },
    {
      id: 'unsupported-element',
      title: 'Unsupported element',
      severity: 'blocker',
      category: 'Delivery',
      clients: ['Outlook', 'Gmail', 'Yahoo Mail'],
      why: 'Forms, frames and embedded media are removed by content sanitisers. Where they are not removed they trigger security warnings, and a stripped form leaves a visually broken hole in the layout.',
      fix: 'Replace with a linked image or a call-to-action button pointing at a web page.',
      run: function (ctx) {
        return all(ctx, 'form, iframe, object, embed, video, audio, canvas, input, button, select, textarea').map(function (el) {
          return hit(ctx, el, '<' + el.tagName.toLowerCase() + '> is not supported in email.');
        });
      }
    },
    {
      id: 'relative-urls',
      title: 'Relative URL in the email',
      severity: 'blocker',
      category: 'Delivery',
      clients: ['Every major client'],
      why: 'An email has no base document, so a relative path resolves against the webmail host (mail.google.com) or nothing at all. Images render as broken icons and links 404.',
      fix: 'Make every href and src fully qualified, including the https:// scheme.',
      run: function (ctx) {
        var out = [];
        all(ctx, '[src], [href], [background]').forEach(function (el) {
          ['src', 'href', 'background'].forEach(function (attr) {
            var v = el.getAttribute(attr);
            if (v && !isAbsolute(v)) out.push(hit(ctx, el, attr + '="' + v + '" is relative.'));
          });
        });
        return out;
      }
    },
    {
      id: 'insecure-http',
      title: 'Asset loaded over plain HTTP',
      severity: 'warning',
      category: 'Delivery',
      clients: ['Gmail', 'Outlook.com', 'Apple Mail'],
      why: 'Webmail runs over HTTPS and proxies your images. Mixed-content assets are often blocked outright, and some clients show a security notice on the message.',
      fix: 'Serve every image and link target over https://.',
      run: function (ctx) {
        var seen = {};
        return scanSource(ctx, /(?:src|href|background)\s*=\s*["']http:\/\/[^"']+["']/gi, function (m) {
          return m[0];
        }).filter(function (s) { if (seen[s]) return false; seen[s] = 1; return true; })
          .map(function (s) { return textHit(ctx, s, 'Insecure asset: ' + s.slice(0, 90)); });
      }
    },
    {
      id: 'author-comments',
      title: 'Author comments left in the markup',
      severity: 'warning',
      category: 'Delivery',
      clients: ['Gmail', 'spam filters'],
      why: 'Comment blocks count against the 102 KB Gmail limit and, when they contain boilerplate instructions or URLs, raise the text-to-markup ratio that content filters score. Template instructions also leak into "view source" for anyone curious.',
      fix: 'Strip every non-conditional comment before sending. Conditional comments (<!--[if mso]>) must be kept.',
      run: function (ctx) {
        var comments = ctx.source.match(/<!--(?!\[if)[\s\S]*?-->/g) || [];
        var bytes = comments.reduce(function (n, c) { return n + c.length; }, 0);
        if (!comments.length) return [];
        return [{
          message: comments.length + ' comment block(s) taking up ' + (bytes / 1024).toFixed(1) + ' KB (' +
            Math.round((bytes / ctx.bytes) * 100) + '% of the file).',
          snippet: comments[0].replace(/\s+/g, ' ').slice(0, 120) + '…',
          line: lineOf(ctx, comments[0].slice(0, 40))
        }];
      }
    },
    {
      id: 'missing-title',
      title: 'No <title>',
      severity: 'info',
      category: 'Document',
      clients: ['Webmail "view in browser"'],
      why: 'The title becomes the tab name in the hosted web version of the message and is read out by some screen readers as the document name.',
      fix: 'Add a <title> matching the subject line.',
      run: function (ctx) {
        var t = ctx.doc.querySelector('title');
        if (!t || !t.textContent.trim()) return [{ message: 'No title element.' }];
        if (/your (message )?(subject|title)|untitled|lorem/i.test(t.textContent)) {
          return [{ message: 'Placeholder title still in place: "' + t.textContent.trim() + '"', line: lineOf(ctx, t.textContent.trim()) }];
        }
        return [];
      }
    },
    {
      id: 'missing-lang',
      title: 'No lang attribute on <html>',
      severity: 'warning',
      category: 'Accessibility',
      clients: ['Screen readers'],
      why: 'Without a declared language a screen reader falls back to the user\'s system voice, so an English email can be read aloud with German phonetics. It is a one-attribute fix that measurably affects comprehension.',
      fix: 'Add lang="en" (and xml:lang="en" for XHTML doctypes) to the <html> element.',
      run: function (ctx) {
        var html = ctx.doc.documentElement;
        return html && html.getAttribute('lang') ? [] : [{ message: '<html> has no lang attribute.', line: lineOf(ctx, '<html') }];
      }
    },
    {
      id: 'charset-meta',
      title: 'No character set declared',
      severity: 'warning',
      category: 'Document',
      clients: ['Outlook', 'Yahoo Mail'],
      why: 'Missing a charset means curly quotes, em dashes and emoji render as mojibake in clients that guess wrong, which looks like a broken send even though the copy is fine.',
      fix: 'Add <meta charset="utf-8"> or the http-equiv Content-Type equivalent.',
      run: function (ctx) {
        var has = ctx.doc.querySelector('meta[charset], meta[http-equiv="Content-Type" i]');
        return has ? [] : [{ message: 'No charset meta tag.' }];
      }
    },

    /* ===== Layout & CSS support ===== */
    {
      id: 'flex-grid',
      title: 'Flexbox or Grid layout',
      severity: 'blocker',
      category: 'Layout',
      clients: ['Outlook 2007-2021 (Windows)', 'Outlook.com'],
      why: 'Windows Outlook renders mail with the Microsoft Word engine, which has no support for flex or grid. Every child collapses into a single full-width stack, so multi-column layouts fall apart for roughly a third of business recipients.',
      fix: 'Use nested tables, or wrap the modern layout in a <!--[if mso]> table fallback.',
      run: function (ctx) {
        return scanSource(ctx, /display\s*:\s*(inline-)?(flex|grid)/gi, function (m) {
          return textHit(ctx, m[0], 'Uses ' + m[0] + '.');
        }, 8);
      }
    },
    {
      id: 'positioning',
      title: 'CSS positioning',
      severity: 'blocker',
      category: 'Layout',
      clients: ['Outlook (Windows)', 'Gmail'],
      why: 'position is ignored by the Word engine and stripped by Gmail. Elements you positioned out of flow snap back to document order, usually landing on top of the content underneath.',
      fix: 'Rebuild the effect with table cells, padding, or a pre-composed image.',
      run: function (ctx) {
        return scanSource(ctx, /position\s*:\s*(absolute|fixed|sticky|relative)/gi, function (m) {
          return textHit(ctx, m[0], 'Uses ' + m[0] + '.');
        }, 8);
      }
    },
    {
      id: 'css-variables',
      title: 'CSS custom properties',
      severity: 'blocker',
      category: 'Layout',
      clients: ['Outlook (Windows)', 'Gmail', 'Yahoo Mail'],
      why: 'var() resolves to nothing in the Word engine and Gmail strips custom property declarations, so colours and spacing fall back to the browser default: black text on transparent, unstyled boxes.',
      fix: 'Resolve variables to literal values at build time.',
      run: function (ctx) {
        return scanSource(ctx, /var\(\s*--[\w-]+/gi, function (m) {
          return textHit(ctx, m[0], 'Custom property reference ' + m[0] + ').');
        }, 6);
      }
    },
    {
      id: 'modern-units',
      title: 'Viewport or root-relative units',
      severity: 'warning',
      category: 'Layout',
      clients: ['Outlook (Windows)', 'Outlook.com'],
      why: 'rem, vw, vh and ch are dropped by the Word engine, so a width:50vw element takes its intrinsic width instead. Type sized in rem falls back to the client default, often 16px where you wanted 13px.',
      fix: 'Use px for type and spacing, and percentages for fluid widths.',
      run: function (ctx) {
        return scanSource(ctx, /:\s*[\d.]+(rem|vw|vh|vmin|vmax|ch)\b/gi, function (m) {
          return textHit(ctx, m[0], 'Unit ' + m[1] + ' in ' + m[0].trim());
        }, 8);
      }
    },
    {
      id: 'background-image',
      title: 'CSS background image without a VML fallback',
      severity: 'warning',
      category: 'Layout',
      clients: ['Outlook 2007-2021 (Windows)'],
      why: 'The Word engine ignores background-image on everything except <body>. A hero panel that relies on it renders as a flat block, and any white text on top lands on a white background: invisible copy.',
      fix: 'Add a <!--[if mso]><v:rect ...> VML fallback, or set a background-color that keeps the text readable.',
      run: function (ctx) {
        if (!/background(-image)?\s*:[^;"']*url\(/i.test(ctx.sourceNoComments)) return [];
        if (/v:rect|v:fill|mso-/i.test(ctx.sourceNoComments)) return [];
        return scanSource(ctx, /background(-image)?\s*:[^;"']*url\([^)]*\)/gi, function (m) {
          return textHit(ctx, m[0], 'Background image with no VML fallback: ' + m[0].slice(0, 80));
        }, 5);
      }
    },
    {
      id: 'fragile-css',
      title: 'CSS that degrades in Outlook',
      severity: 'warning',
      category: 'Layout',
      clients: ['Outlook (Windows)'],
      why: 'Rounded corners, shadows, transforms, opacity and object-fit are silently dropped by the Word engine. The email still works, but square-cornered buttons and full-opacity overlays can look unfinished next to the approved design.',
      fix: 'Treat these as progressive enhancement, and check the square-cornered version is acceptable.',
      run: function (ctx) {
        var props = ['border-radius', 'box-shadow', 'text-shadow', 'transform', 'transition', 'animation', 'object-fit', 'gap', 'filter'];
        var found = {};
        props.forEach(function (p) {
          var re = new RegExp(p.replace('-', '\\-') + '\\s*:', 'i');
          if (re.test(ctx.sourceNoComments)) found[p] = true;
        });
        var keys = Object.keys(found);
        if (!keys.length) return [];
        return [{ message: 'Dropped by the Word engine: ' + keys.join(', ') + '.' }];
      }
    },
    {
      id: 'div-margin',
      title: 'Margin used for spacing',
      severity: 'info',
      category: 'Layout',
      clients: ['Outlook.com', 'Outlook (Windows)'],
      why: 'Margins on div and p elements are unreliable across the Word engine and Outlook.com, and collapse differently again in Yahoo. Spacing you can see locally can vanish entirely for some recipients.',
      fix: 'Put padding on the containing <td> instead, or use spacer rows.',
      run: function (ctx) {
        var els = all(ctx, 'div[style*="margin"], p[style*="margin"]');
        if (!els.length) return [];
        return [{ message: els.length + ' div/p element(s) rely on margin for spacing.', snippet: outer(els[0]) }];
      }
    },
    {
      id: 'web-fonts',
      title: 'Web font with no fallback stack',
      severity: 'warning',
      category: 'Typography',
      clients: ['Outlook (Windows)', 'Gmail', 'Yahoo Mail'],
      why: 'Only Apple Mail and a few others load web fonts. Everyone else falls back to the next entry in the stack, and when there is not one the client picks Times New Roman: a different measure, a different line count, and a layout that reflows.',
      fix: 'Always end the font-family with a websafe face and a generic family, e.g. Georgia, "Times New Roman", serif.',
      run: function (ctx) {
        var out = [];
        if (/@font-face|fonts\.googleapis\.com|fonts\.gstatic\.com/i.test(ctx.sourceNoComments)) {
          out.push({ message: 'Custom web font declared; only Apple Mail and a minority of clients will load it.' });
        }
        scanSource(ctx, /font-family\s*:\s*([^;"'}]+)/gi, function (m) { return m[1]; }, 40)
          .forEach(function (stack) {
            if (!/\b(serif|sans-serif|monospace|cursive|fantasy)\s*$/i.test(stack.trim())) {
              out.push(textHit(ctx, stack.trim().slice(0, 70), 'Font stack ends without a generic family: ' + stack.trim().slice(0, 70)));
            }
          });
        return out.slice(0, 6);
      }
    },
    {
      id: 'fixed-width-only',
      title: 'No responsive rules',
      severity: 'info',
      category: 'Layout',
      clients: ['Mobile clients'],
      why: 'More than half of opens are on a phone. A fixed 600px table with no media query is shrunk to fit, which drops effective type size to around 9px and makes tap targets too small to hit reliably.',
      fix: 'Add a @media (max-width: 600px) block, or move to a fluid/hybrid layout that works without media query support.',
      run: function (ctx) {
        var hasMedia = ctx.sheet.atRules.some(function (a) { return a.name === 'media'; });
        var hasFluid = /width\s*:\s*100%/i.test(ctx.sourceNoComments);
        if (hasMedia || hasFluid) return [];
        return [{ message: 'No @media block and no fluid widths found.' }];
      }
    },

    /* ===== CSS delivery ===== */
    {
      id: 'uninlined-css',
      title: 'Styles left in the head',
      severity: 'blocker',
      category: 'CSS delivery',
      clients: ['Gmail with a non-Gmail account (GANGA)', 'older Yahoo Mail', 'some Android clients'],
      why: 'These clients delete the entire <style> block before rendering. Anything that lives only in the head, including your brand colours, type sizes and table widths, disappears, and the message renders as raw browser-default HTML.',
      fix: 'Inline every static declaration onto the element. Keep only media queries and :hover rules in the head.',
      autofix: 'inline',
      run: function (ctx) {
        if (!ctx.inlinePlan || !ctx.inlinePlan.declarations) return [];
        return [{
          message: ctx.inlinePlan.declarations + ' declaration(s) across ' + ctx.inlinePlan.elements +
            ' element(s) are still head-only. Run Auto-fix to inline them.'
        }];
      }
    },

    /* ===== Images ===== */
    {
      id: 'img-missing-alt',
      title: 'Image without alt text',
      severity: 'blocker',
      category: 'Images',
      clients: ['Outlook (images off by default)', 'Screen readers'],
      why: 'Outlook and most corporate clients block remote images until the reader clicks "download pictures". Until then alt text is the only content on screen. An image-only call to action with no alt is an email with no call to action.',
      fix: 'Write meaningful alt text on every meaningful image, and alt="" on purely decorative ones.',
      autofix: 'alt',
      run: function (ctx) {
        return all(ctx, 'img').filter(function (el) {
          return el.getAttribute('alt') === null;
        }).map(function (el) {
          return hit(ctx, el, 'No alt attribute on ' + (el.getAttribute('src') || 'image') + '.');
        });
      }
    },
    {
      id: 'img-missing-dimensions',
      title: 'Image without explicit width',
      severity: 'warning',
      category: 'Images',
      clients: ['Outlook (Windows)'],
      why: 'With no width attribute, Outlook draws the image at its native pixel size. A 2x retina asset then renders at double size and blows the table out past the layout width, pushing the rest of the email sideways.',
      fix: 'Set the width attribute (not just CSS) to the intended display width.',
      run: function (ctx) {
        return all(ctx, 'img').filter(function (el) {
          return !el.getAttribute('width') && !/width\s*:/.test(styleOf(el));
        }).map(function (el) { return hit(ctx, el, 'No width on ' + (el.getAttribute('src') || 'image') + '.'); });
      }
    },
    {
      id: 'img-display-block',
      title: 'Image without display:block',
      severity: 'info',
      category: 'Images',
      clients: ['Gmail', 'Outlook.com', 'Yahoo Mail'],
      why: 'Inline images sit on the text baseline, so the client adds a few pixels of descender space underneath. In a sliced layout that shows up as thin white lines cutting through the design.',
      fix: 'Add style="display:block" to images used as layout blocks.',
      run: function (ctx) {
        var els = all(ctx, 'img').filter(function (el) { return !/display\s*:\s*block/.test(styleOf(el)); });
        if (!els.length) return [];
        return [{ message: els.length + ' image(s) without display:block may show a gap underneath.', snippet: outer(els[0]) }];
      }
    },
    {
      id: 'image-heavy',
      title: 'Image-heavy with little live text',
      severity: 'warning',
      category: 'Deliverability',
      clients: ['Spam filters', 'Outlook with images off'],
      why: 'Content filters score image-only mail as a spam signal because it hides copy from analysis. Combined with images-off defaults, an all-image email arrives as a stack of empty boxes.',
      fix: 'Keep headlines and the call to action as live HTML text; aim for at least 60% text by area.',
      run: function (ctx) {
        var text = (ctx.doc.body ? ctx.doc.body.textContent : '').replace(/\s+/g, ' ').trim();
        var imgs = all(ctx, 'img').length;
        if (imgs >= 3 && text.length < 500) {
          return [{ message: imgs + ' images against only ' + text.length + ' characters of live text.' }];
        }
        return [];
      }
    },

    /* ===== Tables & accessibility ===== */
    {
      id: 'table-role-presentation',
      title: 'Layout table without role="presentation"',
      severity: 'warning',
      category: 'Accessibility',
      clients: ['Screen readers (VoiceOver, NVDA, JAWS)'],
      why: 'A screen reader announces "table, 4 columns, 12 rows" and then navigates cell by cell, reading grid coordinates before the copy. On a nested email layout that turns a 30-second read into a maze.',
      fix: 'Add role="presentation" to every table used for layout rather than data.',
      autofix: 'role',
      run: function (ctx) {
        return all(ctx, 'table').filter(function (el) {
          if ((el.getAttribute('role') || '').toLowerCase() === 'presentation') return false;
          return !el.querySelector('th') && !el.querySelector('caption');
        }).map(function (el) {
          return hit(ctx, el, 'Layout table missing role="presentation".');
        });
      }
    },
    {
      id: 'table-attrs',
      title: 'Table without reset attributes',
      severity: 'info',
      category: 'Layout',
      clients: ['Outlook', 'Yahoo Mail'],
      why: 'Clients apply their own default cell padding and border spacing. Without the explicit zeroes you get a few unexpected pixels around every cell, which compounds through nested tables into visible misalignment.',
      fix: 'Set border="0" cellpadding="0" cellspacing="0" on every table.',
      autofix: 'tableattrs',
      run: function (ctx) {
        var els = all(ctx, 'table').filter(function (el) {
          return el.getAttribute('cellpadding') === null || el.getAttribute('cellspacing') === null || el.getAttribute('border') === null;
        });
        if (!els.length) return [];
        return [{ message: els.length + ' table(s) missing border/cellpadding/cellspacing resets.', snippet: outer(els[0]) }];
      }
    },
    {
      id: 'small-type',
      title: 'Type below 14px',
      severity: 'warning',
      category: 'Accessibility',
      clients: ['iOS Mail', 'mobile clients'],
      why: 'iOS bumps text under about 13px up to its own minimum, which reflows the line count and can break a carefully sized layout. It is also below the readable threshold for a lot of readers on a phone.',
      fix: 'Set body copy at 14-16px and legal text no smaller than 12px.',
      run: function (ctx) {
        var found = scanSource(ctx, /font-size\s*:\s*(\d+(?:\.\d+)?)px/gi, function (m) {
          return { size: parseFloat(m[1]), text: m[0] };
        }, 60).filter(function (f) { return f.size < 14; });
        if (!found.length) return [];
        var sizes = {};
        found.forEach(function (f) { sizes[f.size] = true; });
        return [{
          message: found.length + ' declaration(s) below 14px (' + Object.keys(sizes).sort().join('px, ') + 'px).',
          snippet: found[0].text,
          line: lineOf(ctx, found[0].text)
        }];
      }
    },
    {
      id: 'vague-link-text',
      title: 'Non-descriptive link text',
      severity: 'info',
      category: 'Accessibility',
      clients: ['Screen readers'],
      why: 'Screen reader users often pull up a list of links to navigate. A list of six entries all reading "click here" gives them nothing to choose between.',
      fix: 'Make the link text describe the destination, e.g. "See the September collection".',
      run: function (ctx) {
        return all(ctx, 'a').filter(function (el) {
          return /^(click here|here|read more|more|link|learn more|this)$/i.test((el.textContent || '').trim());
        }).map(function (el) { return hit(ctx, el, 'Link text is "' + el.textContent.trim() + '".'); });
      }
    },
    {
      id: 'tap-target',
      title: 'Call to action too small to tap',
      severity: 'info',
      category: 'Accessibility',
      clients: ['iOS Mail', 'Gmail Android'],
      why: 'Apple and Google both put the minimum comfortable tap target at 44px. A text link with no padding is roughly 20px tall, so on a phone it takes two attempts, and the second one often lands on the wrong link.',
      fix: 'Give button links at least 12px of vertical padding, or set a line-height near 44px.',
      run: function (ctx) {
        var els = all(ctx, 'a').filter(function (el) {
          var s = styleOf(el);
          if (!/background|border|display\s*:\s*(block|inline-block)/.test(s)) return false;
          return !/padding/.test(s) && !/line-height/.test(s);
        });
        return els.map(function (el) { return hit(ctx, el, 'Button-style link with no padding or line-height.'); });
      }
    },

    /* ===== Dark mode ===== */
    {
      id: 'color-scheme-meta',
      title: 'No dark-mode declaration',
      severity: 'warning',
      category: 'Dark mode',
      clients: ['Apple Mail', 'Outlook.com', 'Gmail (Android/iOS)'],
      why: 'Without a declared colour scheme, clients that force dark mode invert your palette themselves. Outlook.com flips solid colours wholesale, so a dark logo on a white panel becomes a light logo on a dark panel, and any text baked into an image stays the original colour and disappears.',
      fix: 'Add <meta name="color-scheme" content="light dark"> and <meta name="supported-color-schemes" content="light dark">, plus color-scheme: light dark in the CSS.',
      autofix: 'colorscheme',
      run: function (ctx) {
        var hasMeta = ctx.doc.querySelector('meta[name="color-scheme" i]');
        var hasSupported = ctx.doc.querySelector('meta[name="supported-color-schemes" i]');
        var out = [];
        if (!hasMeta) out.push({ message: 'No <meta name="color-scheme">.' });
        if (!hasSupported) out.push({ message: 'No <meta name="supported-color-schemes">.' });
        return out;
      }
    },
    {
      id: 'dark-mode-untested',
      title: 'Hardcoded light palette with no dark-mode rules',
      severity: 'info',
      category: 'Dark mode',
      clients: ['Apple Mail', 'Gmail (mobile)'],
      why: 'White panels get inverted to near-black by the client. Logos and icons saved as flat PNGs with white backgrounds keep their white box, which shows up as a bright rectangle floating in a dark email.',
      fix: 'Add a @media (prefers-color-scheme: dark) block, and use transparent PNGs for logos.',
      run: function (ctx) {
        if (/prefers-color-scheme/i.test(ctx.sourceNoComments)) return [];
        var whites = (ctx.sourceNoComments.match(/#(fff|ffffff)\b|:\s*white\b/gi) || []).length;
        if (whites < 2) return [];
        return [{ message: whites + ' white colour value(s) and no prefers-color-scheme block.' }];
      }
    },

    /* ===== Compliance & deliverability ===== */
    {
      id: 'unsubscribe-link',
      title: 'No unsubscribe link',
      severity: 'blocker',
      category: 'Compliance',
      clients: ['CAN-SPAM', 'GDPR', 'Gmail bulk-sender rules'],
      why: 'A clear opt-out is required by CAN-SPAM, and since 2024 Gmail and Yahoo require one-click unsubscribe from bulk senders or they start rejecting mail. Readers who cannot find one hit "report spam" instead, which damages domain reputation for every future send.',
      fix: 'Add a visible unsubscribe link in the footer, wired to your ESP\'s opt-out merge tag.',
      run: function (ctx) {
        if (/unsubscribe|opt[- ]?out|manage (your )?preferences|list-unsubscribe/i.test(ctx.sourceNoComments)) return [];
        return [{ message: 'No unsubscribe or preference-centre link found.' }];
      }
    },
    {
      id: 'physical-address',
      title: 'No postal address in the footer',
      severity: 'warning',
      category: 'Compliance',
      clients: ['CAN-SPAM'],
      why: 'CAN-SPAM requires a valid physical postal address in every commercial message. Filters also look for one as a legitimacy signal, so leaving it out costs both compliance and inbox placement.',
      fix: 'Add the registered business address to the footer.',
      run: function (ctx) {
        var text = ctx.doc.body ? ctx.doc.body.textContent : '';
        var looksLikeAddress = /\b\d{1,5}\s+[A-Za-z][\w.'-]*\s+(street|st|road|rd|avenue|ave|drive|dr|lane|ln|blvd|boulevard|suite|ste|way|court|ct)\b/i.test(text) ||
          /\b[A-Z]{2}\s+\d{5}(-\d{4})?\b/.test(text) ||
          /\b[A-Z]{1,2}\d{1,2}[A-Z]?\s*\d[A-Z]{2}\b/.test(text);
        return looksLikeAddress ? [] : [{ message: 'No postal address detected in the body copy.' }];
      }
    },
    {
      id: 'preheader',
      title: 'No preheader text',
      severity: 'warning',
      category: 'Deliverability',
      clients: ['Gmail', 'Apple Mail', 'Outlook'],
      why: 'The inbox list shows the first text it finds after the subject line. With no preheader that is whatever comes first in the markup, which is usually "View this email in your browser" or, worse, a run of alt text. It is prime real estate for open rates, given away by accident.',
      fix: 'Add a hidden preheader div at the top of the body with 40-100 characters of summary copy, followed by non-breaking-space padding.',
      run: function (ctx) {
        var head = ctx.sourceNoComments.slice(0, 4000);
        if (/display\s*:\s*none|max-height\s*:\s*0|font-size\s*:\s*0|preheader|preview[-_ ]?text/i.test(head)) return [];
        return [{ message: 'No hidden preheader block near the top of the body.' }];
      }
    },
    {
      id: 'spam-words',
      title: 'Spam trigger phrases',
      severity: 'warning',
      category: 'Deliverability',
      clients: ['Content filters'],
      why: 'No single phrase sends you to junk, but filters score them cumulatively alongside link count, image ratio and sender reputation. A footer full of them can be the difference between the inbox and Promotions.',
      fix: 'Rewrite in plain language, and keep urgency claims specific rather than generic.',
      run: function (ctx) {
        var words = ['act now', 'apply now', 'buy direct', 'call now', 'cash bonus', 'cheap', 'click here',
          'congratulations', 'credit card offers', 'double your', 'earn extra cash', 'free access', 'free gift',
          'free money', 'guarantee', 'no obligation', 'no strings attached', 'once in a lifetime', 'order now',
          'risk free', 'satisfaction guaranteed', 'this is not spam', 'urgent', 'winner', 'you have been selected',
          '100% free', 'limited time', 'miracle', 'no credit check', 'money back'];
        var text = (ctx.doc.body ? ctx.doc.body.textContent : '').toLowerCase();
        var found = words.filter(function (w) { return text.indexOf(w) !== -1; });
        if (!found.length) return [];
        return [{ message: 'Trigger phrases in the copy: ' + found.slice(0, 8).map(function (f) { return '"' + f + '"'; }).join(', ') + '.' }];
      }
    },
    {
      id: 'shouting',
      title: 'Shouting punctuation or all-caps copy',
      severity: 'info',
      category: 'Deliverability',
      clients: ['Content filters'],
      why: 'Runs of capitals and exclamation marks are weighted by content filters and, separately, are read letter-by-letter by some screen readers ("S-A-L-E").',
      fix: 'Use sentence case and let the design carry the emphasis.',
      run: function (ctx) {
        var text = (ctx.doc.body ? ctx.doc.body.textContent : '').replace(/\s+/g, ' ');
        var out = [];
        var caps = text.match(/\b[A-Z]{5,}(\s+[A-Z]{2,}){1,}\b/g) || [];
        if (caps.length) out.push({ message: 'All-caps run: "' + caps[0].slice(0, 50) + '".' });
        if (/!{2,}/.test(text)) out.push({ message: 'Repeated exclamation marks in the copy.' });
        return out;
      }
    },
    {
      id: 'link-count',
      title: 'High link count',
      severity: 'info',
      category: 'Deliverability',
      clients: ['Content filters'],
      why: 'Filters treat a high ratio of links to text as a phishing pattern, and readers faced with twenty choices tend to make none.',
      fix: 'Cut to one primary call to action plus the footer links.',
      run: function (ctx) {
        var links = all(ctx, 'a[href]').length;
        if (links <= 15) return [];
        return [{ message: links + ' links in the message.' }];
      }
    },
    {
      id: 'tracking-pixel',
      title: 'No open-tracking pixel',
      severity: 'info',
      category: 'Analytics',
      clients: ['Reporting'],
      why: 'Without a tracking pixel you have no open data at all. Worth knowing before the send, not after the report is due. (Apple Mail Privacy Protection already distorts this metric, so treat opens as directional.)',
      fix: 'Most ESPs inject one automatically. If yours does not, add a 1x1 image at the end of the body.',
      run: function (ctx) {
        var pixel = all(ctx, 'img').some(function (el) {
          var w = parseInt(el.getAttribute('width') || '0', 10);
          var h = parseInt(el.getAttribute('height') || '0', 10);
          return (w === 1 && h === 1) || /open|track|beacon|pixel/i.test(el.getAttribute('src') || '');
        });
        return pixel ? [] : [{ message: 'No 1x1 tracking pixel found.' }];
      }
    }
  ];

  /* ---------------------------------------------------------------- audit */

  function audit(ctx) {
    var findings = [];
    RULES.forEach(function (rule) {
      var hits;
      try { hits = rule.run(ctx) || []; }
      catch (err) { hits = []; }
      if (!hits.length) return;
      findings.push({
        id: rule.id,
        title: rule.title,
        severity: rule.severity,
        category: rule.category,
        clients: rule.clients,
        why: rule.why,
        fix: rule.fix,
        autofix: rule.autofix || null,
        hits: hits,
        count: hits.length
      });
    });

    var order = { blocker: 0, warning: 1, info: 2 };
    findings.sort(function (a, b) {
      if (order[a.severity] !== order[b.severity]) return order[a.severity] - order[b.severity];
      return b.count - a.count;
    });

    // Score against the total weight on the board rather than subtracting from
    // 100, so a badly broken email still lands somewhere informative instead of
    // pinning at zero.
    var maxWeight = RULES.reduce(function (n, r) { return n + WEIGHT[r.severity]; }, 0);
    var penalty = findings.reduce(function (n, f) { return n + WEIGHT[f.severity]; }, 0);
    var counts = { blocker: 0, warning: 0, info: 0 };
    findings.forEach(function (f) { counts[f.severity]++; });

    return {
      findings: findings,
      counts: counts,
      passed: RULES.length - findings.length,
      total: RULES.length,
      penalty: penalty,
      maxWeight: maxWeight,
      score: Math.round(100 * Math.max(0, maxWeight - penalty) / maxWeight)
    };
  }

  root.MailproofRules = { RULES: RULES, audit: audit, WEIGHT: WEIGHT };
})(typeof window !== 'undefined' ? window : globalThis);
