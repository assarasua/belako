import type { Role } from '../lib/types';

type Props = {
  role: Role;
  onSwitchRole: (nextRole: Role) => void;
};

export function TopBar({ role, onSwitchRole }: Props) {
  return (
    <header className="topbar">
      <div>
        <p className="eyebrow">Belako Superfan App - MVP</p>
        <h1>Belako SuperFan App</h1>
      </div>
      <div className="role-toggle" role="tablist" aria-label="Role switch">
        <button className={role === 'fan' ? 'active' : ''} onClick={() => onSwitchRole('fan')}>
          Fans
        </button>
        <button className={role === 'artist' ? 'active' : ''} onClick={() => onSwitchRole('artist')}>
          Equipo
        </button>
      </div>
    </header>
  );
}
