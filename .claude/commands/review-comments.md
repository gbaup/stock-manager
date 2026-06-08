# Review PR Comments

Fetch all review comments on a feature PR, present them in caveman-review format, then launch two parallel adversarial judges to analyze the quality and validity of those comments.

## Usage

`/review-comments [PR_NUMBER]`

- If `PR_NUMBER` is provided, use that PR directly
- If omitted, detect the open PR for the current branch

---

## Step 1 — Identify the PR

If `$ARGUMENTS` contains a number, use it as `PR_NUMBER`.

Otherwise, run:

```bash
gh pr view --json number,title,headRefName,baseRefName
```

Confirm the PR targets `develop`. If it targets a different base, note it and continue anyway.

Resolve the repo slug:

```bash
gh repo view --json owner,name | jq -r '"\(.owner.login)/\(.name)"'
```

---

## Step 2 — Fetch review comments

Run in parallel:

```bash
# Inline review comments (file + line level)
gh api repos/{OWNER_REPO}/pulls/{PR_NUMBER}/comments --paginate \
  | jq '[.[] | {
      id,
      path,
      line: (.line // .original_line),
      body,
      user: .user.login,
      resolved: false,
      created_at
    }]'

# Top-level review summaries
gh api repos/{OWNER_REPO}/pulls/{PR_NUMBER}/reviews --paginate \
  | jq '[.[] | {id, state, body, user: .user.login, submitted_at}]'
```

For each inline comment, also fetch the relevant code context (the specific file section being discussed):

```bash
gh api repos/{OWNER_REPO}/pulls/{PR_NUMBER}/comments --paginate \
  | jq '[.[] | {path, diff_hunk, body}]'
```

The `diff_hunk` field contains the surrounding code lines — use this as the code context for each comment when sending to judges.

---

## Step 3 — Triage human comments by severity

Classify each comment into one of:

| Emoji | Type | When |
|---|---|---|
| 🔴 | `bug` | Broken behavior — will cause an incident |
| 🟡 | `risk` | Works but fragile — race, missing null check, swallowed error |
| 🔵 | `nit` | Style, naming, micro-optimization — author can ignore |
| ❓ | `q` | Genuine question, not a suggestion |

If the comment already contains a severity marker (e.g. from Copilot), honor it. Otherwise infer from the content.

Skip pure approval comments (`LGTM`, `Approved`, no body) — don't list those.

---

## Step 4 — Present human comments in caveman-review format

Print a header:

```
PR #<N> — <title>
<N> comment(s) · Reviewers: <comma-separated list>
```

Then list comments grouped by severity, highest first (🔴 → 🟡 → 🔵 → ❓):

```
<file>:L<line>: <emoji> <type>: <problem>. <fix>.
```

Rules:
- One line per finding
- Use exact file path and line number
- Use backticks around symbol/function/variable names
- Include the *why* if the fix isn't obvious from the problem statement
- For security findings or architectural disagreements: write a full paragraph, then resume terse
- Collapse duplicates that point at the same issue
- Mark already-resolved comments with ~~strikethrough~~ and list them at the end

---

## Step 5 — Launch two parallel judges to analyze the comments

After presenting human comments, launch **Judge A and Judge B simultaneously** (async, never sequential). Neither judge knows the other exists. The orchestrator (you) never analyzes comments itself — only coordinates and synthesizes.

Each judge receives the full list of PR comments plus the `diff_hunk` context for each inline comment.

### Judge Prompt (identical for both)

```
You are an adversarial reviewer of code review comments. Your job is to analyze each comment and assess whether it is valid, justified, and actionable.

## PR Comments to Analyze

<paste full list of comments here, each with its diff_hunk context>

For each comment, evaluate:

1. **Validity**: Is the issue described actually present in the code shown?
2. **Severity accuracy**: Is the severity the reviewer implied (bug vs nit vs question) correct?
3. **Fix correctness**: If a fix is suggested, is it actually the right fix?
4. **Clarity**: Is the comment clear enough to act on?

## Output Format — MANDATORY

One line per comment, using this format:

<file>:L<line>: <verdict> <assessment>. <note if needed>.

Verdict prefixes:
- ✅ valid: — issue is real, severity is accurate, fix is sound
- ⚠️ overblown: — issue exists but severity is overstated
- ❌ invalid: — issue is not actually present in the code shown
- 🔀 wrong-fix: — issue is real but suggested fix is incorrect or incomplete
- ❓ unclear: — not enough context to assess

Rules:
- No hedging — use ❓ unclear: if you genuinely can't tell from the diff_hunk
- No restating what the comment says — assess it
- If a comment is ❌ invalid, briefly explain what the code actually does
- If a comment is ✅ valid with nothing to add, just write "valid: confirmed."

If ALL comments are valid: return exactly:
VERDICT: ALL VALID — No issues with the review comments.
```

---

## Step 6 — Synthesize both judges' assessments

After both judges return, compare their verdicts per comment:

```
CONFIRMED VALID     → both judges say ✅ valid          → high confidence, proceed with fix
CONFIRMED INVALID   → both judges say ❌ invalid         → push back on reviewer
CONFIRMED OVERBLOWN → both judges say ⚠️ overblown       → downgrade severity
CONFIRMED WRONG-FIX → both judges say 🔀 wrong-fix       → do not apply suggested fix blindly
DISAGREEMENT        → judges give different verdicts     → flag for manual decision
UNCLEAR             → one or both judges say ❓ unclear   → needs more context
```

Print a synthesis header:

```
## Comment Analysis — Judge Synthesis
```

Then a verdict table:

```markdown
| Comment | File | Judge A | Judge B | Status |
|---------|------|---------|---------|--------|
| null deref on `user` | auth.ts:L42 | ✅ valid | ✅ valid | CONFIRMED VALID |
| rename `tmp` | useMatch.ts:L15 | ⚠️ overblown | ⚠️ overblown | CONFIRMED OVERBLOWN |
| use `useCallback` here | Counter.tsx:L88 | ✅ valid | ❌ invalid | DISAGREEMENT |
| missing error boundary | App.tsx:L5 | ❓ unclear | ❓ unclear | UNCLEAR |
```

For DISAGREEMENT rows: include a one-line note explaining what each judge said.

---

## Step 7 — Final summary

End with:

```
### Summary
Comments: X ✅ confirmed valid  ·  Y ❌ invalid  ·  Z ⚠️ overblown  ·  W 🔀 wrong-fix  ·  V ❓ unclear  ·  U disagreement

Overall: <safe to act on all / review some before acting / push back on reviewer>
```

If all comments are confirmed valid: print `JUDGMENT: APPROVED ✅ — All review comments are sound. Proceed with fixes.`
