import { deepFreeze } from '../freeze';
import type { Version } from '../types';

/** Recorded versions of this workspace, oldest first. */
export const VERSIONS: readonly Version[] = deepFreeze([
  {
    id: 'v42',
    label: 'v42',
    at: '2026-11-09T18:04:00Z',
    author: 'clpi',
    summary: 'rotary embeddings fixed; q_proj reindexed',
    premiseIds: ['pm-01', 'pm-03', 'pm-04', 'pm-05'],
    tensorIds: ['q_proj', 'router'],
    note: 'First admitted state after the rotary fix. Router surface frozen from the start.',
  },
  {
    id: 'v43',
    label: 'v43',
    at: '2026-11-11T07:02:00Z',
    author: 'clpi',
    summary: 'distillation set folded into block 4',
    premiseIds: ['pm-01', 'pm-03', 'pm-04', 'pm-05', 'pm-06'],
    tensorIds: ['q_proj', 'fc1', 'router'],
    note: 'Teacher logits admitted. fc1 exists but is not yet refit at this version.',
  },
  {
    id: 'v44',
    label: 'v44',
    at: '2026-11-13T12:10:00Z',
    author: 'clpi',
    summary: 'dedup pass 07 landed; 3.1% of pairs removed',
    premiseIds: ['pm-01', 'pm-02', 'pm-03', 'pm-04', 'pm-05', 'pm-06', 'pm-07'],
    tensorIds: ['q_proj', 'fc1', 'router'],
    note: 'pm-02 enters here, and pm-07 is derived from pm-01 and pm-02 in the same pass.',
  },
  {
    id: 'v45',
    label: 'v45',
    at: '2026-11-14T06:40:00Z',
    author: 'clpi',
    summary: 'mlp.fc1 refit; mlp.fc2 shard dropped',
    premiseIds: ['pm-01', 'pm-02', 'pm-03', 'pm-04', 'pm-05', 'pm-06', 'pm-07', 'pm-08'],
    tensorIds: ['q_proj', 'fc1', 'fc2', 'router'],
    note: 'fc2 was admitted at this version and later failed to load, which is why it shows an error today.',
  },
  {
    id: 'v46',
    label: 'v46',
    at: '2026-11-16T03:41:00Z',
    author: 'clpi',
    summary: 'preference run 77 + head calibration; head admitted',
    premiseIds: [
      'pm-01', 'pm-02', 'pm-03', 'pm-04', 'pm-05', 'pm-06', 'pm-07', 'pm-08', 'pm-09', 'pm-10', 'pm-11',
    ],
    tensorIds: ['q_proj', 'fc1', 'head', 'fc2', 'router'],
    note: 'Current state of record. pm-10 landed 18 minutes before this snapshot.',
  },
]);

export const VERSION_BY_ID: Record<string, Version> = Object.fromEntries(
  VERSIONS.map((v) => [v.id, v]),
);

export const CURRENT_VERSION_ID = 'v46';
