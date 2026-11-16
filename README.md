# Wide IDE

A production-shaped interface for weight-space programming: the editor treats weights as
first-class values, and every learned result carries the premises that produced it.
This screen is the one a programmer lives in — inspect a weight tensor, follow its
premise lineage, and see exactly what retracting a premise would do, without leaving
the editor flow.

Built with **Next.js 14 (App Router) + React 18 + TypeScript (strict)**. No UI library,
no charting library, no CSS framework: the styling is a single token-based stylesheet so
the whole screen is auditable.

## Run it

```bash
npm install
npm run dev          # http://localhost:3000
```

Static build (what the hosted demo serves):

```bash
NEXT_PUBLIC_BASE_PATH=/idol-wide-ide npm run build   # emits ./out
npm run typecheck                                     # tsc --noEmit
```

## Structure

```
app/
  layout.tsx            document shell + metadata
  page.tsx              the workspace: all editor state and keyboard handling
  globals.css           design tokens + every component style
components/
  TopBar.tsx            state hash, preview chip, undo, shortcuts
  VersionTimeline.tsx   version history chips
  ProgramPane.tsx       code pane + weight-set list (left)
  TensorInspector.tsx   searchable cell grid, statistics, diff mode (centre)
  LineagePane.tsx       premise tree, lineage detail, retraction preview (right)
  ShortcutDialog.tsx    keyboard reference, focus-trapped
lib/
  types.ts              the domain model (WeightSet, Premise, Version, stats…)
  derive.ts             preview maths, statistics, cell search, lineage walks, hashes
  hash.ts               FNV-1a 64 content hashing
  freeze.ts             deep freeze helper
  mock/weightSets.ts    5 tensors (3 ready, 1 failing shard, 1 frozen surface)
  mock/premises.ts      11 premises with per-cell contributions and parentage
  mock/versions.ts      5 recorded versions
```

Mock data is generated from fixed seeds, so the workspace is byte-identical on every
load. Tensors hold realistic sparsity (~8% exact zeros); premises hold the exact cells
they contributed to, with the signed delta each one added.

## The guarantee: previews never mutate state

* Every mock record is deep-frozen at module load; an accidental write throws.
* A preview is **derived**: `previewValues(committed, premise)` returns a new matrix with
  that premise's deltas subtracted. The committed matrix is never touched.
* The header shows two hashes. `state` is the content hash of cells + premise ids;
  `preview` appears only while a retraction is being previewed. Leaving the preview
  restores the original hash exactly — verified in the test run
  (`2811 e3d8 62c2 1d67` before and after, `6f26 3aa4 9499 4038` during).
* "Stage preview" only holds the patch in the editor and says so in the interface.
  There is deliberately no commit control: a real withdrawal would be a new version.

## Interactions implemented

**Panes and selection**
1. Select a weight set (click or `[` `]`) → loading skeleton, then the inspector retargets.
2. Filter the weight-set list by name, role, status or premise id.
3. Code pane renders the "weight program" for the selected surface with line numbers and
   token colouring (keywords, premise ids, numbers, comments).
4. Premise list follows first-parent lineage order with indentation, kind badges,
   confidence, a lock for non-retractable premises and a `not in vNN` marker when the
   selected version predates it.
5. "Only this surface" filters the lineage to premises that contributed to the open tensor.

**Tensor inspector**
6. Cell search: `r3c5`, `r3`, `c5`, `>0.25`, `<=-0.1`, `=0`, `0.37`, or a label fragment.
   Non-matching cells dim and every statistic recomputes over the match set.
7. Click a cell (or focus the grid and press Enter) → detail bar with value, preview
   value, the premise contribution and every premise that touched that cell.
8. Arrow keys / Home / End / PageUp / PageDown navigate cells; row and column headers
   stay pinned while scrolling.
9. Diff mode shows each affected cell as `before → after` with direction colouring, and
   adds mean, max|w| and L2 deltas to the statistics strip.

**Retraction preview**
10. Select a premise → affected cells highlight and the diff appears; the lineage detail
    shows the exact before/after/Δ table for the open tensor.
11. `d` toggles the diff while the highlight stays.
12. "Stage preview" locks the patch as staged (amber chip) and "Unstage" releases it.
13. Undo (button, or ⌘Z / Ctrl+Z) walks back through every preview action: premise
    selection, diff toggle, stage, exit.

**History and state**
14. Version timeline: selecting a version updates `aria-current`, the run metadata line,
    the version's hash prefix and which premises count as present.
15. State hash with copy-to-clipboard and a live `preview` hash while previewing.
16. Keyboard dialog (`?`) listing every shortcut, focus-trapped, Esc closes.

**States**
17. Loading: boot skeletons for all three panes (700 ms) and a per-surface skeleton on
    every switch.
18. Empty: the frozen `moe.router` surface, the "no premises touch this surface" branch,
    and the "no cells match" search state.
19. Error: `mlp.fc2` fails as a truncated shard with a transport log; "Retry shard"
    reconnects to a generated shard (labelled simulated).
20. Narrow screens (≤860 px) switch the three panes to tabs; the tensor grid scrolls
    inside its own box so the page never widens.

## Accessibility

Semantic regions with `aria-labelledby`, `role="grid"` with `aria-rowcount`/
`aria-colcount` and per-cell `aria-label`s, `role="listbox"`/`option` for both lists with
`aria-selected`, `aria-pressed` on toggles, `aria-current` on the timeline, a polite
`role="status"` live region that narrates preview and navigation changes, a skip link,
visible `:focus-visible` rings, a focus-trapped dialog, and no interactive element
without an accessible name (checked in the test run).

## Honest limits

The workspace is mock data; the retry is simulated; the hash is FNV-1a 64 for display,
not a cryptographic digest. Previews describe what retraction would do — they do not
write, and the interface never claims a version was created.
