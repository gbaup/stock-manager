# Release PR

Generate a standardized release PR from `develop` into `main`.

## Step 1 — Gather context

Run these commands in parallel:

```bash
git log main..HEAD --oneline
git diff main...HEAD --stat
git diff main...HEAD -- .env.local .env.example
gh pr list --base main --state merged --limit 10 --json title,mergedAt \
  | jq 'sort_by(.mergedAt) | reverse | .[].title'
```

## Step 2 — Determine version bump

Parse the highest version from merged release PR titles (format: `Release vX.Y` or `Release vX.Y.Z`).

Apply semver to propose the next version:

| Change type | Bump | Example |
|---|---|---|
| Complete redesign, new design system, breaking DB migrations, new auth paradigm | **Major** `X+1.0` | v2.0 → v3.0 |
| New features: pages, endpoints, game mechanics, significant UI additions | **Minor** `x.Y+1` | v2.0 → v2.1 |
| Bug fixes, small tweaks, config changes, single dependency updates | **Patch** `x.y.Z+1` | v2.1 → v2.1.1 |

Notes:
- Two-part versions (`v2.0`) only grow to three parts for patches: `v2.0.1`
- Major and minor bumps stay two-part: `v3.0`, `v2.1`

**Present the version suggestion with a one-line justification. Wait for confirmation before continuing.**

## Step 2b — Detect new env variables

Scan the diff output from Step 1 (`.env.local`, `.env.example`, and any changes that introduce new `process.env.*` references) for newly added environment variables.

If any are found, carry them into Step 5 — they will appear as a deployment reminder block in the PR body.

## Step 3 — Group changes into sections

Cluster commits and changed files into logical `###` headings. Use the same style as past releases:

- Drop headings with zero items
- Write bullets in past tense, verb-first: "Added X", "Fixed Y", "Replaced Z"

## Step 4 — Write the test plan

Produce a `- [ ]` checklist covering:
- Main user flows affected by the changes
- Any DB migration or new env variable
- Auth + cookie behaviour if touched
- Mobile and desktop rendering if UI changed
- Locale switching if i18n strings were added

## Step 5 — Emit the PR

### Title format

```
🚀 Release vX.Y[.Z] — <tagline listing 2–3 key themes, max 60 chars>
```

- Separate themes with `, ` and `&` before the last one
- No period at the end
- Examples:
  - `Release v2.1 — List Filters & export`
  - `Release v2.0.1 — Filters fix & mobile layout`

### Body format

```markdown
## Release vX.Y[.Z] — Stock manager

<One sentence describing the scope of the release.>

---

## What's new

### <Section>
- <Bullet>

---

## Deployment

<Only include this section when new env variables were detected. List each var and end with the reminder blockquote.>

> ⚠️ **New env variables** — set these on the deployment environment before deploying:
> - `VAR_NAME` — description

---

## Test plan
- [ ] <Scenario>

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

Rules:
- Use `## What's new`, not `## New Features`
- `###` headings are Title Case
- One-sentence summary paragraph — no more
- Bullets: capital first letter, no trailing period, one line each

## Step 6 — Offer to open the PR

After presenting the title and body, ask: _"Want me to open this PR now with `gh pr create`?"_

Do not push or create the PR without explicit confirmation.
