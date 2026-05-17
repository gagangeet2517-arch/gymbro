export function toDateKey(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function formatDayLabel(dateKey: string): string {
  const today = toDateKey(new Date().toISOString());
  const yesterday = toDateKey(new Date(Date.now() - 86_400_000).toISOString());
  if (dateKey === today) return 'Today';
  if (dateKey === yesterday) return 'Yesterday';
  const d = new Date(dateKey + 'T12:00:00');
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
