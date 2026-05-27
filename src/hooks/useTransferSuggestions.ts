import { useMemo } from 'react';
import type { Contact, Transaction } from '@/types';

export interface SuggestedRecipient extends Contact {
  frequency: number;
  lastSent: Date;
}

export interface SuggestedAmount {
  amount: number;
  frequency: number;
  recipientName?: string;
}

export interface TransferSuggestions {
  recipients: SuggestedRecipient[];
  amounts: SuggestedAmount[];
}

export function useTransferSuggestions(
  contacts: Contact[],
  transactions: Transaction[],
): TransferSuggestions {
  const recipients = useMemo(() => {
    const frequencyMap = new Map<string, { count: number; lastSent: Date; contact: Contact }>();

    for (const contact of contacts) {
      frequencyMap.set(contact.id, {
        count: 0,
        lastSent: new Date(0),
        contact,
      });
    }

    for (const t of transactions) {
      if (t.type !== 'send') continue;
      const matched = contacts.find(
        (c) =>
          c.phone === t.recipientPhone ||
          c.name.toLowerCase() === t.recipientName.toLowerCase(),
      );
      if (matched) {
        const entry = frequencyMap.get(matched.id);
        if (entry) {
          entry.count += 1;
          if (t.timestamp > entry.lastSent) {
            entry.lastSent = t.timestamp;
          }
        }
      }
    }

    return Array.from(frequencyMap.values())
      .filter((e) => e.count > 0)
      .sort((a, b) => b.count - a.count || b.lastSent.getTime() - a.lastSent.getTime())
      .map((e) => ({
        ...e.contact,
        frequency: e.count,
        lastSent: e.lastSent,
      }));
  }, [contacts, transactions]);

  const amounts = useMemo(() => {
    const frequencyMap = new Map<number, { count: number; recipientName?: string }>();

    for (const t of transactions) {
      if (t.type !== 'send') continue;
      const rounded = Math.round(t.amount);
      const existing = frequencyMap.get(rounded);
      if (existing) {
        existing.count += 1;
      } else {
        frequencyMap.set(rounded, { count: 1, recipientName: t.recipientName });
      }
    }

    return Array.from(frequencyMap.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5)
      .map(([amount, info]) => ({
        amount,
        frequency: info.count,
        recipientName: info.recipientName,
      }));
  }, [transactions]);

  return { recipients, amounts };
}
