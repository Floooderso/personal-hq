type PillColor = 'green' | 'yellow' | 'red' | 'blue' | 'gray';

const statusMap: Record<string, PillColor> = {
  active: 'green', paid: 'green', success: 'green', up: 'green', done: 'green',
  pending: 'yellow', paused: 'yellow', planning: 'yellow', on_hold: 'yellow',
  overdue: 'red', cancelled: 'red', failure: 'red', suspended: 'red', down: 'red',
  draft: 'blue', ideas: 'blue', inactive: 'gray', unknown: 'gray',
};

interface Props {
  status: string;
  label?: string;
}

export function StatusPill({ status, label }: Props) {
  const color = statusMap[status.toLowerCase()] ?? 'gray';
  const displayLabel = label ?? status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  return (
    <span className={`pill pill-${color}`}>
      <span className="pill-dot" />
      {displayLabel}
    </span>
  );
}
