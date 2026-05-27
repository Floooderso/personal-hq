const BASE = '/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options?.headers ?? {}) },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((body as { error?: string }).error ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body: body !== undefined ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body: body !== undefined ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

export async function downloadPDF(subscriptionId: number): Promise<void> {
  const res = await fetch(`/api/subscriptions/${subscriptionId}/cancel-pdf`, { method: 'POST' });
  if (!res.ok) throw new Error('PDF generation failed');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `kuendigung-${subscriptionId}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportCSV(): Promise<void> {
  const res = await fetch('/api/finances/export');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'invoices.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportData(): Promise<void> {
  const res = await fetch('/api/settings/export');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'personal-hq-export.json';
  a.click();
  URL.revokeObjectURL(url);
}
