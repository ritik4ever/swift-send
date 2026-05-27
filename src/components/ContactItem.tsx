import { Contact } from '@/types';
import { cn } from '@/lib/utils';
import { User } from 'lucide-react';

interface ContactItemProps {
  contact: Contact;
  onClick?: () => void;
  selected?: boolean;
}

const countryFlags: Record<string, string> = {
  MX: '🇲🇽',
  PH: '🇵🇭',
  GT: '🇬🇹',
  SV: '🇸🇻',
  US: '🇺🇸',
};

export function ContactItem({ contact, onClick, selected }: ContactItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-4 p-4 rounded-xl transition-all duration-200',
        selected
          ? 'bg-primary/10 border-2 border-primary'
          : 'bg-card hover:bg-secondary/50 border-2 border-transparent shadow-card',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary'
      )}
      aria-label={`Select ${contact.name} as recipient`}
      aria-pressed={selected}
    >
      <div className="relative flex-shrink-0" aria-hidden="true">
        <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center">
          <User className="w-5 h-5 text-muted-foreground" />
        </div>
        <span className="absolute -bottom-1 -right-1 text-lg">
          {countryFlags[contact.countryCode] || '🌍'}
        </span>
      </div>

      <div className="flex-1 text-left min-w-0">
        <p className="font-semibold text-foreground truncate">{contact.name}</p>
        <p className="text-sm text-muted-foreground truncate">{contact.phone}</p>
      </div>

      <span className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded-md" aria-label={`Country: ${contact.country}`}>
        {contact.country}
      </span>
    </button>
  );
}
