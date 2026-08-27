# Mailproof

**HTML email preflight that runs entirely in your browser.**

Open `mailproof/index.html`, paste an email, and find out what breaks before
50,000 people do.

---

## The problem

Email is the last place on the web where you cannot just write HTML and CSS.

- **Outlook on Windows renders mail with the Microsoft Word engine.** No flexbox,
  no grid, no `position`, no CSS custom properties, no `border-radius`. Multi-column
  layouts collapse into a single stack for roughly a third of business recipients.
- **Gmail truncates any message over 102 KB** and hides the rest behind "View entire
  message" — including, usually, your unsubscribe link.
- **Images are blocked by default** in Outlook and most corporate clients. Until the
  reader clicks "download pictures", alt text is the entire email.
- **Dark mode inverts your palette** whether you planned for it or not. Outlook.com
  flips solid colours wholesale; white logo backgrounds become glowing rectangles.
- **Layout tables read as data tables** to a screen reader: "table, 4 columns,
  12 rows", then cell coordinates before every line of copy.
- **`<style>` blocks are stripped** by Gmail when it serves a non-Gmail account, so
  head-only CSS silently disappears and the message renders as browser-default HTML.

None of this shows up in a browser. It shows up in the inbox, once, permanently.
The tools that catch it — Litmus, Email on Acid — start around $99/month and want
you to upload unsent campaign content to a third party.

## What Mailproof does

| | |
|---|---|
| **40 preflight checks** | Grouped into blockers, warnings and notes. Each one names the clients that get it wrong, explains what the subscriber actually sees, and gives the concrete fix. |
| **Client simulations** | Five viewport widths, Apple-style and Outlook.com-style dark mode, and an images-blocked view that replaces every image with its alt text. |
| **CSS inliner** | Hand-written stylesheet parser that respects specificity, source order and `!important`. Media queries and `:hover` rules stay in the head, where they have to be. |
| **Auto-fix** | Eight mechanical fixes: inline the CSS, strip author comments (keeping `<!--[if mso]>` conditionals), add `role="presentation"`, alt attributes, table resets, `lang`, colour-scheme meta. |
| **Plain-text alternative** | Generates the `text/plain` part your ESP should send alongside the HTML. Missing it is a deliverability penalty at most providers. |
| **Size meter** | Live byte count against the 102 KB Gmail clipping threshold. |

Everything runs client-side. No build step, no dependencies, no network requests,
no upload. The whole thing is five files you can read.

## Running it

```bash
# any static server; the "Load repo template" button needs http, not file://
python3 -m http.server 8000
# then open http://localhost:8000/mailproof/
```

Opening `mailproof/index.html` directly from disk works too — you just lose the
"Load repo template" shortcut, since `fetch` cannot read `file://` URLs.

## Layout

```
mailproof/
├── index.html          three-pane studio: source, preview, report
├── css/studio.css      chrome only; never touches the email being tested
└── js/
    ├── inliner.js      stylesheet parser + specificity-aware CSS inliner
    ├── rules.js        the 40 preflight rules
    ├── transform.js    auto-fixes, plain-text generator, client simulations
    ├── sample.js       a deliberately imperfect sample campaign
    └── app.js          UI wiring
```

## Adding a rule

Rules are self-describing. Append one to the `RULES` array in `js/rules.js`:

```js
{
  id: 'my-rule',
  title: 'Short imperative title',
  severity: 'blocker' | 'warning' | 'info',
  category: 'Layout',
  clients: ['Outlook (Windows)'],
  why: 'What the subscriber actually experiences.',
  fix: 'The concrete change to make.',
  autofix: 'inline',            // optional: key from transform.js FIXES
  run: function (ctx) {
    // ctx: { source, sourceNoComments, lines, bytes, doc, sheet, inlinePlan }
    // return an array of { message, line?, snippet? }
    return [];
  }
}
```

`ctx.doc` is a parsed `Document`, so `querySelectorAll` works. Return an empty
array to pass. Scoring is weighted by severity (blocker 12, warning 5, note 1)
against the total weight on the board, and each rule can only cost its weight
once, so one email with 200 missing alt attributes still scores sanely.

## What it deliberately does not do

- **It does not render in real clients.** Nothing short of a screenshot farm can.
  The dark-mode views are documented approximations of the transformations each
  client applies, not renderings from Outlook itself.
- **It does not write your alt text.** Auto-fix adds `alt=""`, which marks an image
  decorative. Meaningful images need copy a human writes.
- **It does not check your sending domain.** SPF, DKIM and DMARC are the other half
  of deliverability and live outside the HTML.

## Verified against

The repo's own `index.html` boilerplate scores **73** — 2 blockers (10 relative
URLs, uninlined head CSS), 7 warnings (21 layout tables without
`role="presentation"`, 9 images without an explicit width, the instructional
comment block the template itself warns you to remove) and 5 notes.
