const DRAFTS_KEY = 'swift_send_transfer_drafts';
const DRAFT_EXPIRY_MS = 24 * 60 * 60 * 1000;

export interface TransferDraft {
  id: string;
  recipientIdentifier?: string;
  recipientName?: string;
  amount?: string;
  purposeCode?: string;
  notes?: string;
  savedAt: number;
  expiresAt: number;
}

export function saveDraft(draft: Omit<TransferDraft, 'savedAt' | 'expiresAt'> & { savedAt?: number; expiresAt?: number }): void {
  try {
    const drafts = listDrafts();
    const now = Date.now();
    const existingIndex = drafts.findIndex((d) => d.id === draft.id);
    const entry: TransferDraft = {
      ...draft,
      savedAt: draft.savedAt ?? now,
      expiresAt: draft.expiresAt ?? now + DRAFT_EXPIRY_MS,
    };
    if (existingIndex >= 0) {
      drafts[existingIndex] = entry;
    } else {
      drafts.push(entry);
    }
    pruneExpired(drafts);
    localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
  } catch {
    // Silently handle storage failures
  }
}

export function listDrafts(): TransferDraft[] {
  try {
    const raw = localStorage.getItem(DRAFTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as TransferDraft[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function getDraft(id: string): TransferDraft | null {
  const drafts = listDrafts();
  return drafts.find((d) => d.id === id) ?? null;
}

export function removeDraft(id: string): void {
  try {
    const drafts = listDrafts().filter((d) => d.id !== id);
    localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
  } catch {
    // Silently handle storage failures
  }
}

export function clearAllDrafts(): void {
  try {
    localStorage.removeItem(DRAFTS_KEY);
  } catch {
    // Silently handle storage failures
  }
}

export function pruneExpired(drafts?: TransferDraft[]): TransferDraft[] {
  const list = drafts ?? listDrafts();
  const now = Date.now();
  const valid = list.filter((d) => d.expiresAt > now);
  if (!drafts) {
    try {
      localStorage.setItem(DRAFTS_KEY, JSON.stringify(valid));
    } catch {
      // Silently handle storage failures
    }
  }
  return valid;
}
