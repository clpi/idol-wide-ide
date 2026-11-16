import { deepFreeze } from '../freeze';
import type { TensorId, WeightSet } from '../types';

/**
 * Deterministic tensor generator.
 *
 * Committed mock weights, generated from a fixed seed so the workspace is
 * identical on every load and between machines. Values are rounded to 6 dp and
 * roughly 8% of cells are exactly zero, which gives the inspector realistic
 * sparsity instead of uniform noise.
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeTensor(rows: number, cols: number, seed: number): number[][] {
  const rnd = mulberry32(seed);
  const out: number[][] = [];
  for (let r = 0; r < rows; r += 1) {
    const row: number[] = [];
    for (let c = 0; c < cols; c += 1) {
      if (rnd() < 0.08) {
        row.push(0);
        continue;
      }
      // triangular-ish noise, scaled to a plausible init range
      const g = (rnd() + rnd() + rnd() - 1.5) * 0.52;
      row.push(Number(g.toFixed(6)));
    }
    out.push(row);
  }
  return out;
}

const qProj = makeTensor(12, 16, 0x51a7);
const fc1 = makeTensor(10, 14, 0x9c31);
const head = makeTensor(8, 12, 0x2be5);

export const WEIGHT_SETS: readonly WeightSet[] = deepFreeze([
  {
    id: 'q_proj' as TensorId,
    name: 'attn.q_proj',
    model: 'idol-xl · block 4',
    role: 'attention query projection',
    dtype: 'f32',
    shape: [12, 16] as const,
    bytes: 12 * 16 * 4,
    status: 'ready' as const,
    values: qProj,
    premiseIds: ['pm-01', 'pm-02', 'pm-04', 'pm-05', 'pm-07'],
    snippet: {
      caption: 'attn.q_proj · block 4',
      lines: [
        'tensor attn.q_proj { f32[12, 16] }',
        '',
        '  bind pm-01            # corpus shard 11',
        '  bind pm-02            # human feedback 402',
        '  derive pm-07 <- pm-01, pm-02',
        '',
        '  constrain |w| <= 2.0  # pm-04 scale guard',
        '  objective ce(next)    # pm-05 weight 1.0',
        '',
        'retract pm-02',
        '  -> preview 3 cells, state unchanged',
      ],
    },
    versionId: 'v46',
  },
  {
    id: 'fc1' as TensorId,
    name: 'mlp.fc1',
    model: 'idol-xl · block 4',
    role: 'mlp up-projection',
    dtype: 'f32',
    shape: [10, 14] as const,
    bytes: 10 * 14 * 4,
    status: 'ready' as const,
    values: fc1,
    premiseIds: ['pm-01', 'pm-06', 'pm-08', 'pm-03'],
    snippet: {
      caption: 'mlp.fc1 · block 4',
      lines: [
        'tensor mlp.fc1 { f32[10, 14] }',
        '',
        '  bind pm-01            # corpus shard 11',
        '  bind pm-06            # teacher logits 1.2M',
        '  observe pm-08         # gradient noise 0.37',
        '',
        '  objective kl(teacher || student)',
        '  steps 24_000  lr 3e-4  bs 128',
        '',
        'state = atoms(sum over premises)',
      ],
    },
    versionId: 'v45',
  },
  {
    id: 'head' as TensorId,
    name: 'lm_head',
    model: 'idol-xl · block 4',
    role: 'output head',
    dtype: 'f32',
    shape: [8, 12] as const,
    bytes: 8 * 12 * 4,
    status: 'ready' as const,
    values: head,
    premiseIds: ['pm-09', 'pm-10', 'pm-11', 'pm-03'],
    snippet: {
      caption: 'lm_head · block 4',
      lines: [
        'tensor lm_head { f32[8, 12] }',
        '',
        '  bind pm-09            # preference run 77',
        '  bind pm-11            # tokenizer merges (frozen)',
        '',
        '  calibrate temperature = 1.04   # pm-10',
        '  assert sum(p) = 1 per row',
        '',
        'retract pm-10',
        '  -> preview 2 cells, state unchanged',
      ],
    },
    versionId: 'v46',
  },
  {
    id: 'fc2' as TensorId,
    name: 'mlp.fc2',
    model: 'idol-xl · block 4',
    role: 'mlp down-projection',
    dtype: 'f32',
    shape: [12, 10] as const,
    bytes: 12 * 10 * 4,
    status: 'error' as const,
    statusDetail:
      'shard idle-7 aborted mid-stream: ETIMEDOUT after 30.0 s while reading cells [4:12, 0:10]. The tensor is not in the workspace.',
    values: [],
    premiseIds: ['pm-06', 'pm-08'],
    snippet: {
      caption: 'mlp.fc2 · block 4',
      lines: [
        'tensor mlp.fc2 { f32[12, 10] }',
        '',
        '  bind pm-06  bind pm-08',
        '  load shard idle-7',
        '',
        '! ETIMEDOUT at byte 148_284 of 480',
        '! tensor not admitted to the workspace',
      ],
    },
    versionId: 'v45',
  },
  {
    id: 'router' as TensorId,
    name: 'moe.router',
    model: 'idol-xl · block 4',
    role: 'mixture-of-experts routing',
    dtype: 'f32',
    shape: [0, 0] as const,
    bytes: 0,
    status: 'empty' as const,
    statusDetail:
      'Frozen tensor. Routing is a non-learned hash, so this surface carries no trainable cells and no premises.',
    values: [],
    premiseIds: [],
    snippet: {
      caption: 'moe.router · block 4',
      lines: [
        'tensor moe.router { f32[0, 0] }',
        '',
        '  frozen by design:',
        '    route = hash(token_id) mod n_experts',
        '',
        '  no cells -> no premises -> nothing to retract',
      ],
    },
    versionId: 'v42',
  },
]);

export const WEIGHT_SET_BY_ID: Record<string, WeightSet> = Object.fromEntries(
  WEIGHT_SETS.map((set) => [set.id, set]),
);

export const DEFAULT_TENSOR_ID: TensorId = 'q_proj';

/**
 * Cells for mlp.fc2 after a successful reconnect. Deterministic, like the
 * committed tensors; used only when the operator retries the failed shard.
 */
export function buildRecoveredFc2(): number[][] {
  return makeTensor(12, 10, 0x7f42);
}
