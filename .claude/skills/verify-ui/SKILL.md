---
name: verify-ui
description: How to verify a UI change actually landed before claiming it works. Use whenever you've changed something visual or interactive and need to confirm the result. Rule of thumb — anything COMPLEX (interactive/hover/collapsed/animated/conditional state, layout, colors, real rendered DOM) must be checked with the Claude Code browser extension by opening the page; SIMPLE checks (a string is present, a class is in the markup, it compiles/builds, a route returns 200) can use the command line.
---

# Verifying a UI change

Never claim a UI change works — or describe what a page renders — from source
alone. Pick the cheapest tool that can actually answer the question, then say
how you verified.

## Decide: complex → browser, simple → CLI

**Use the Claude Code browser extension** (open the page, inspect the live
DOM / rendered result) when the answer depends on what the browser actually
produced:

- interactive / hover / focus / collapsed-expanded / animated / conditional
  states that **do not exist in server HTML** (e.g. tooltips, sidebar collapse,
  dropdown menus, the date-range picker);
- layout, spacing, alignment, overflow, responsive behavior;
- colors, theme tokens, gradients, the actual computed style;
- client-side data/filtering (URL-driven view-model changes, chart re-renders);
- "does this look right" / "what does this page show".

This matters most for this app: the sidebar tooltips (orange, portaled), the
collapse trigger hover (`#5ecccb`), filter bars over `backdrop-blur`, and the
sales date-range select are all states that **don't appear in curl'd HTML**.

**Use the command line** when a cheap, deterministic check is sufficient:

- it compiles / type-checks: `npx tsc --noEmit`;
- it builds: `npm run build` (and the route's bundle size looks sane);
- a route responds: `curl -sS -o /dev/null -w '%{http_code}' http://localhost:3000/vendas`;
- a string/class is present in the **server** markup: `curl -s … | grep`;
- a file/prop/wiring is correct: read the source.

If unsure whether something is "simple", treat it as complex and open the page —
a class being in the markup does not prove it rendered as intended.

## If the browser tool is NOT available

Say so explicitly. Do the CLI checks you can, then **ask the user to verify
visually** — never imply something was visually confirmed when it wasn't. This
is a hard rule from CLAUDE.md ("Visual verification (browser)").

## Login / preview protocol (this project)

The app is behind SSO login, and **only the user can log in**. So:

- **By default, the user opens the preview, logs in, and validates it themselves.**
  Do NOT open a browser/preview to validate on your own initiative — just make the
  change, run the CLI gate, and hand it over for the user to check.
- **Validate yourself only when the user explicitly asks you to.** In that case:
  - If a screen/session is **already open**, go ahead and validate in sequence.
  - If **nothing is open yet**, start the preview, then **wait for the user to log
    in**. Surface a click-to-continue control (an AskUserQuestion with an option
    like "Estou logado — pode validar") and only proceed once they click it.
    Never assume the login happened.
- Either way, report how you verified and never imply a logged-in page was checked
  when it wasn't.

## Workflow

1. Make the change.
2. CLI gate first: `npx tsc --noEmit` + `npm run build` (or dev server running).
   Cheap, catches the obvious breakage before opening a browser.
3. For anything complex, open the page in the browser extension and inspect the
   actual state (trigger the hover/click/collapse you changed).
4. Report **how** you verified ("opened /vendas, hovered the sidebar item, the
   tooltip is orange and above the blur" vs. "tsc + build clean; couldn't open a
   browser — please confirm visually").

## Don't

- Don't describe a rendered page you only read the source of.
- Don't claim a hover/collapsed/interactive state works from server HTML.
- Don't say "verified visually" unless you actually opened the page.
