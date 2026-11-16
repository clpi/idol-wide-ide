/**
 * Typed domain model for the Wide IDE mock workspace.
 *
 * Everything here is mock data, frozen at module load. The UI derives every
 * preview value from these immutable records; nothing writes back.
 */

export type TensorId = 'q_proj' | 'fc1' | 'head' | 'fc2' | 'router';

export type TensorStatus = 'ready' | 'error' | 'empty';

export type PremiseKind = 'dataset' | 'measurement' | 'constraint' | 'derived' | 'objective';

/** A single cell's contribution from a premise. */
export interface WeightDelta {
  readonly tensor: TensorId;
  readonly r: number;
  readonly c: number;
  /** signed contribution added to the committed value */
  readonly delta: number;
}

export interface Premise {
  readonly id: string;
  readonly label: string;
  readonly kind: PremiseKind;
  /** One sentence a reviewer can audit without opening anything else. */
  readonly statement: string;
  readonly collector: string;
  readonly capturedAt: string;
  /** 0..1 — how much the pipeline trusts this premise. */
  readonly confidence: number;
  /** False for premises owned outside the workspace (cannot be withdrawn here). */
  readonly retractable: boolean;
  /** Lineage: the premises this one was derived from. */
  readonly parents: readonly string[];
  readonly tensorIds: readonly TensorId[];
  readonly deltas: readonly WeightDelta[];
}

export interface CodeSnippet {
  readonly caption: string;
  readonly lines: readonly string[];
}

export interface WeightSet {
  readonly id: TensorId;
  readonly name: string;
  readonly model: string;
  readonly role: string;
  readonly dtype: 'f32';
  readonly shape: readonly [number, number];
  readonly bytes: number;
  readonly status: TensorStatus;
  /** Present for non-ready tensors: why the shard is unusable. */
  readonly statusDetail?: string;
  /** Committed values. Immutable; retraction previews never touch this. */
  readonly values: readonly (readonly number[])[];
  readonly premiseIds: readonly string[];
  readonly snippet: CodeSnippet;
  /** Version of record this tensor was last written in. */
  readonly versionId: string;
}

export interface Version {
  readonly id: string;
  readonly label: string;
  readonly at: string;
  readonly author: string;
  readonly summary: string;
  readonly premiseIds: readonly string[];
  readonly tensorIds: readonly TensorId[];
  readonly note: string;
}

export interface CellStats {
  readonly count: number;
  readonly min: number;
  readonly max: number;
  readonly mean: number;
  readonly std: number;
  readonly maxAbs: number;
  readonly l2: number;
  readonly zeros: number;
}

export interface CellQuery {
  readonly raw: string;
  /** Parsed form, or null when the query is free text with no match. */
  readonly matches: ReadonlySet<string> | null;
  readonly labels: ReadonlySet<string> | null;
  readonly error: string | null;
}

export interface Announcement {
  readonly id: number;
  readonly text: string;
}
