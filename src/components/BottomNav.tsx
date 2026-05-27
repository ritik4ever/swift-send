import { Home, Send, MapPin, Clock, User } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

const navItems = [
  { icon: Home, label: 'Home', path: '/dashboard' },
  { icon: Send, label: 'Send', path: '/send' },
  { icon: MapPin, label: 'Track', path: '/remittance' },
  { icon: Clock, label: 'History', path: '/history' },
  { icon: User, label: 'Profile', path: '/profile' },
];

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border px-4 pb-safe z-50" aria-label="Main navigation">
      <div className="max-w-lg mx-auto flex items-center justify-around py-2">
        {navItems.map(({ icon: Icon, label, path }) => {
          const isActive = location.pathname === path;
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={cn(
                'flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              aria-label={`${label}${isActive ? ' (current page)' : ''}`}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon
                className={cn(
                  'w-6 h-6 transition-transform duration-200',
                  isActive && 'scale-110'
                )}
                aria-hidden="true"
              />
              <span className="text-xs font-medium">{label}</span>
              {isActive && (
                <span className="absolute -bottom-0.5 w-1 h-1 rounded-full bg-primary" aria-hidden="true" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
