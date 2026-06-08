# Feature PR

Generate a feature PR from the current branch into `develop`.

## Step 1 — Gather context

Run these commands in parallel:

```bash
git log develop..HEAD --oneline
git diff develop...HEAD --stat
git diff develop...HEAD -- prisma/schema.prisma
```

## Step 2 — Summarize the changes

Group commits and changed files into logical bullet points under a `## Summary` section:

- Write bullets in past tense, noun-first: "Added X", "Fixed Y", "Replaced Z"
- Merge closely related commits into a single bullet
- If a DB migration is included, note it explicitly

## Step 3 — Detect migration or env var changes

If `prisma/schema.prisma` changed or a migration file was added, add a `## Migration` section listing:
- What the migration does (e.g. new table, column rename, index)
- The command to apply it: `npx prisma migrate dev` (local) / `npx prisma migrate deploy` (prod)

If new environment variables were introduced, list them with a one-line description and add a deployment reminder note so they don't get missed when deploying.

Skip this section entirely if neither applies.

## Step 4 — Write the test plan

Produce a `- [ ]` checklist covering:
- Main user flows affected by the changes
- Any DB migration or new env variable
- Auth + cookie behaviour if touched
- Mobile and desktop rendering if UI changed
- Locale switching if i18n strings were added
- `npm run lint && npm run build` must pass

## Step 5 — Emit the PR

### Title format

A plain, descriptive sentence that reads like a task or ticket title. No conventional-commit prefixes (`feat:`, `fix:`, `chore:`).

- Title Case
- Max 70 characters
- Focus on what was built or fixed, not the implementation detail
- Examples:
  - `Google OAuth Integration for User Authentication`
  - `Admin Sync Ratings Idempotency Fix`

### Body format

```markdown
## Summary

- <Bullet>

## Migration

<Only include this section if there is a migration or new env var. When new env vars are present, always end the section with the deployment reminder block below.>

> ⚠️ **New env variables** — set these on the deployment environment before deploying:
> - `VAR_NAME` — description

## Test plan

- [ ] <Scenario>

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

Rules:
- Bullets: capital first letter, no trailing period, one line each
- One `## Summary` block — no sub-headings inside it
- Test plan items are concrete and verifiable, not vague

## Step 6 — Offer to open the PR

After presenting the title and body, ask: _"Want me to open this PR now with `gh pr create`?"_

Do not push or create the PR without explicit confirmation.
