# email_template1

An HTML email boilerplate, plus a tool for checking HTML email before you send it.

## Contents

**`index.html`** — the email template. A table-based boilerplate with the usual
client resets (Hotmail `.ExternalClass`, the Yahoo paragraph fix, Outlook link
padding) and inline commentary on which styles need to be brought inline.

**[`mailproof/`](mailproof/)** — **Mailproof**, a zero-dependency HTML email
preflight studio that runs entirely in the browser. Paste an email and it reports
what will break, in which client, and why:

- 40 checks across layout, CSS delivery, images, accessibility, dark mode,
  compliance and deliverability
- client simulations — five widths, Apple and Outlook.com dark mode, and an
  images-blocked view
- a specificity-aware CSS inliner, plus seven other mechanical auto-fixes
- a generated `text/plain` alternative and a live 102 KB Gmail-clip size meter

No build step, no dependencies, no network calls, nothing uploaded anywhere.

```bash
python3 -m http.server 8000   # then open http://localhost:8000/mailproof/
```

See [`mailproof/README.md`](mailproof/README.md) for the full write-up.
