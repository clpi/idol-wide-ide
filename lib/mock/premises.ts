import { deepFreeze } from '../freeze';
import type { Premise, WeightDelta } from '../types';

function d(tensor: WeightDelta['tensor'], r: number, c: number, delta: number): WeightDelta {
  return { tensor, r, c, delta };
}

/**
 * Premises carried by this workspace.
 *
 * Each premise lists the cells it contributed to, with the signed delta it
 * added. Retraction is therefore a pure subtraction over this list — the
 * preview never rewrites the tensor.
 */
export const PREMISES: readonly Premise[] = deepFreeze([
  {
    id: 'pm-01',
    label: 'corpus shard 11',
    kind: 'dataset',
    statement:
      'Corpus shard 11 of arxiv-cs-lg (48,201 documents), filtered to English and deduplicated against the 2025 snapshot.',
    collector: 'ingest:arxiv',
    capturedAt: '2026-11-09T17:52:10Z',
    confidence: 0.96,
    retractable: true,
    parents: [],
    tensorIds: ['q_proj', 'fc1'],
    deltas: [
      d('q_proj', 0, 0, 0.0125), d('q_proj', 0, 1, -0.0073),
      d('q_proj', 1, 0, 0.0042), d('q_proj', 3, 5, 0.0191),
      d('fc1', 0, 0, 0.0062), d('fc1', 2, 3, -0.0104),
    ],
  },
  {
    id: 'pm-02',
    label: 'human feedback 402',
    kind: 'dataset',
    statement:
      'Batched human feedback, batch 402: 1,884 preference pairs collected 2026-10-30 to 2026-11-02.',
    collector: 'annot:human',
    capturedAt: '2026-11-10T09:15:00Z',
    confidence: 0.88,
    retractable: true,
    parents: ['pm-01'],
    tensorIds: ['q_proj'],
    deltas: [
      d('q_proj', 1, 2, 0.0088),
      d('q_proj', 4, 7, -0.0152),
      d('q_proj', 9, 3, 0.0031),
    ],
  },
  {
    id: 'pm-03',
    label: 'activation norm probe',
    kind: 'measurement',
    statement: 'Activation norm probe at layer 4 over 64 batches: mean 11.42, p99 38.9.',
    collector: 'probe:activations',
    capturedAt: '2026-11-11T02:31:40Z',
    confidence: 0.93,
    retractable: true,
    parents: [],
    tensorIds: ['head', 'fc1'],
    deltas: [
      d('head', 0, 0, -0.0021), d('head', 7, 11, 0.0014),
      d('fc1', 5, 5, 0.0009),
    ],
  },
  {
    id: 'pm-04',
    label: 'q_proj scale guard',
    kind: 'constraint',
    statement:
      'Constraint: |w| <= 2.0 on attn.q_proj rows 0-1, enforced by projection after every step.',
    collector: 'guard:norm',
    capturedAt: '2026-11-11T02:33:02Z',
    confidence: 0.99,
    retractable: true,
    parents: ['pm-03'],
    tensorIds: ['q_proj'],
    deltas: [d('q_proj', 0, 0, 0.0032), d('q_proj', 0, 1, 0.0024)],
  },
  {
    id: 'pm-05',
    label: 'objective ce(next)',
    kind: 'objective',
    statement: 'Objective: next-token cross-entropy, weight 1.0, label smoothing 0.',
    collector: 'train:objective',
    capturedAt: '2026-11-09T17:52:12Z',
    confidence: 1,
    retractable: true,
    parents: [],
    tensorIds: ['fc1'],
    deltas: [d('fc1', 1, 1, 0.0077), d('fc1', 5, 9, -0.0055)],
  },
  {
    id: 'pm-06',
    label: 'teacher logits 1.2M',
    kind: 'dataset',
    statement:
      'Distillation set: teacher logits over 1.2M tokens sampled from idol-xl checkpoint v40.',
    collector: 'distill:teacher',
    capturedAt: '2026-11-11T06:20:00Z',
    confidence: 0.9,
    retractable: true,
    parents: ['pm-05'],
    tensorIds: ['fc1', 'q_proj', 'fc2'],
    deltas: [
      d('fc1', 1, 1, -0.0031), d('fc1', 5, 9, 0.0068),
      d('q_proj', 2, 2, 0.0049),
      d('fc2', 2, 2, 0.0044), d('fc2', 9, 1, -0.0027),
    ],
  },
  {
    id: 'pm-07',
    label: 'dedup pass 0.82',
    kind: 'derived',
    statement:
      'Derived: minhash dedup at 0.82 Jaccard against the eval split, removing 3.1% of pairs.',
    collector: 'index:minhash',
    capturedAt: '2026-11-13T11:04:00Z',
    confidence: 0.84,
    retractable: true,
    parents: ['pm-01', 'pm-02'],
    tensorIds: ['q_proj'],
    deltas: [d('q_proj', 3, 5, -0.0058), d('q_proj', 1, 2, -0.0025)],
  },
  {
    id: 'pm-08',
    label: 'gradient noise 0.37',
    kind: 'measurement',
    statement: 'Measurement: gradient noise scale 0.37 across 24 micro-batches at step 22,900.',
    collector: 'probe:gradient',
    capturedAt: '2026-11-14T05:12:00Z',
    confidence: 0.78,
    retractable: true,
    parents: [],
    tensorIds: ['fc1', 'fc2'],
    deltas: [d('fc1', 7, 7, 0.0011), d('fc2', 4, 4, 0.0013)],
  },
  {
    id: 'pm-09',
    label: 'preference run 77',
    kind: 'dataset',
    statement: 'RLHF preference run 77: 12,400 pairs, reward margin 0.06, beta 0.02.',
    collector: 'rlhf:rank',
    capturedAt: '2026-11-15T19:48:00Z',
    confidence: 0.82,
    retractable: true,
    parents: ['pm-06'],
    tensorIds: ['head'],
    deltas: [
      d('head', 2, 4, 0.0092), d('head', 3, 9, -0.0047),
      d('head', 6, 1, 0.0033),
    ],
  },
  {
    id: 'pm-10',
    label: 'head calibration',
    kind: 'constraint',
    statement:
      'Constraint: lm_head logits calibrated to temperature 1.04 on the 2026-11 holdout slice.',
    collector: 'guard:calibration',
    capturedAt: '2026-11-16T03:22:00Z',
    confidence: 0.95,
    retractable: true,
    parents: ['pm-09'],
    tensorIds: ['head'],
    deltas: [d('head', 0, 0, 0.0018), d('head', 7, 11, -0.0012)],
  },
  {
    id: 'pm-11',
    label: 'tokenizer merges',
    kind: 'dataset',
    statement:
      'Tokenizer merge table, 51,200 merges, frozen at the model cut. Owned outside this workspace.',
    collector: 'tokenizer:frozen',
    capturedAt: '2026-11-09T16:00:00Z',
    confidence: 1,
    retractable: false,
    parents: [],
    tensorIds: ['head'],
    deltas: [d('head', 1, 1, 0.0026)],
  },
]);

export const PREMISE_BY_ID: Record<string, Premise> = Object.fromEntries(
  PREMISES.map((p) => [p.id, p]),
);
