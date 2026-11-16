import type { Version } from '../lib/types';

interface VersionTimelineProps {
  versions: readonly Version[];
  selectedId: string;
  hashes: Record<string, string>;
  onSelect: (id: string) => void;
}

export function VersionTimeline({ versions, selectedId, hashes, onSelect }: VersionTimelineProps) {
  const selected = versions.find((v) => v.id === selectedId);
  return (
    <nav className="timeline" aria-label="Version timeline">
      <span className="timeline-label">History</span>
      <div className="timeline-track" role="list">
        {versions.map((v) => (
          <button
            key={v.id}
            type="button"
            role="listitem"
            className="timeline-item"
            aria-current={v.id === selectedId ? 'true' : undefined}
            aria-label={`${v.label}, ${new Date(v.at).toLocaleString()}, ${v.summary}`}
            title={`${v.summary} · ${v.author} · ${v.premiseIds.length} premises`}
            onClick={() => onSelect(v.id)}
          >
            <span>{v.label}</span>
            <span className="tl-hash">{hashes[v.id]?.slice(0, 8)}</span>
          </button>
        ))}
      </div>
      <span className="timeline-note">
        {selected ? `${selected.author} · ${new Date(selected.at).toLocaleDateString()} · ${selected.premiseIds.length} premises` : ''}
      </span>
    </nav>
  );
}
