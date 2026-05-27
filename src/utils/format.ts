export function formatCurrency(amount: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency }).format(amount);
}

export function formatDate(date: string | null, locale = 'de-DE'): string {
  if (!date) return '—';
  return new Date(date).toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatRelative(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return formatDate(date);
}

export function toMonthly(amount: number, cycle: string): number {
  switch (cycle) {
    case 'yearly': return amount / 12;
    case 'weekly': return amount * 4.33;
    case 'quarterly': return amount / 3;
    default: return amount;
  }
}

export function isOverdue(dateStr: string | null, status: string): boolean {
  if (status === 'paid') return false;
  if (!dateStr) return false;
  return new Date(dateStr) < new Date();
}

export function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / 86400000);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).replace(/_/g, ' ');
}
