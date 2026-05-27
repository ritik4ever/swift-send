import { useCallback, useEffect, useRef } from 'react';
import { saveDraft, getDraft, removeDraft, pruneExpired, type TransferDraft } from '@/services/draftStorage';

const DRAFT_AUTO_SAVE_MS = 3000;

interface DraftState {
  recipientIdentifier?: string;
  recipientName?: string;
  amount?: string;
  purposeCode?: string;
  notes?: string;
}

export function useTransferDraft(draftId: string) {
  const lastSaveRef = useRef<number>(Date.now());
  const currentStateRef = useRef<DraftState>({});

  const persist = useCallback(
    (state: DraftState) => {
      currentStateRef.current = state;
      const now = Date.now();
      if (now - lastSaveRef.current < DRAFT_AUTO_SAVE_MS) return;
      lastSaveRef.current = now;
      saveDraft({ id: draftId, ...state });
    },
    [draftId],
  );

  const restore = useCallback((): DraftState | null => {
    pruneExpired();
    const draft = getDraft(draftId);
    if (!draft) return null;
    return {
      recipientIdentifier: draft.recipientIdentifier,
      recipientName: draft.recipientName,
      amount: draft.amount,
      purposeCode: draft.purposeCode,
      notes: draft.notes,
    };
  }, [draftId]);

  const discard = useCallback(() => {
    removeDraft(draftId);
    currentStateRef.current = {};
  }, [draftId]);

  const saveNow = useCallback(
    (state: DraftState) => {
      currentStateRef.current = state;
      saveDraft({ id: draftId, ...state });
    },
    [draftId],
  );

  useEffect(() => {
    return () => {
      if (Object.keys(currentStateRef.current).length > 0) {
        saveDraft({ id: draftId, ...currentStateRef.current });
      }
    };
  }, [draftId]);

  return { persist, restore, discard, saveNow };
}
