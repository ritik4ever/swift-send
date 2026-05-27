import type { EscrowEntry, EscrowSummary, EscrowStatus } from '@/types/escrow';

export async function getEscrowForTransfer(transferId: string): Promise<EscrowEntry | null> {
  try {
    const { apiFetch } = await import('@/lib/api');
    const response = await apiFetch(`/escrow/transfer/${transferId}`);
    if (!response.ok) return null;
    return (await response.json()) as EscrowEntry;
  } catch {
    return null;
  }
}

export async function getEscrowSummary(transferId: string): Promise<EscrowSummary | null> {
  try {
    const { apiFetch } = await import('@/lib/api');
    const response = await apiFetch(`/escrow/transfer/${transferId}/summary`);
    if (!response.ok) return null;
    return (await response.json()) as EscrowSummary;
  } catch {
    return null;
  }
}

export async function ensureEscrow(
  transferId: string,
  amount: number,
  currency: string,
): Promise<EscrowEntry | null> {
  try {
    const { apiFetch } = await import('@/lib/api');
    const response = await apiFetch('/escrow/ensure', {
      method: 'POST',
      body: JSON.stringify({ transferId, amount, currency }),
    });
    if (!response.ok) return null;
    return (await response.json()) as EscrowEntry;
  } catch {
    return null;
  }
}

type StatusChangeCallback = (entry: EscrowEntry) => void;

export function onEscrowStatusChange(callback: StatusChangeCallback): () => void {
  const intervalId = window.setInterval(async () => {
    try {
      const { apiFetch } = await import('@/lib/api');
      const response = await apiFetch('/escrow/updates');
      if (!response.ok) return;
      const entries = (await response.json()) as EscrowEntry[];
      for (const entry of entries) {
        callback(entry);
      }
    } catch {
      // Silently handle polling errors
    }
  }, 5000);
  return () => window.clearInterval(intervalId);
}
