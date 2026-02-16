import type { ArtistTab, FanTab, Role } from '../lib/types';

type Props = {
  role: Role;
  fanTab: FanTab;
  artistTab: ArtistTab;
  onFanTab: (tab: FanTab) => void;
  onArtistTab: (tab: ArtistTab) => void;
};

export function BottomNav({ role, fanTab, artistTab, onFanTab, onArtistTab }: Props) {
  if (role === 'fan') {
    const items: Array<{ tab: FanTab; label: string; icon: string }> = [
      { tab: 'home', label: 'inicio', icon: 'HM' },
      { tab: 'live', label: 'directo', icon: 'TV' },
      { tab: 'rewards', label: 'recompensas', icon: 'RW' },
      { tab: 'profile', label: 'perfil', icon: 'ME' }
    ];

    const labels: Record<FanTab, string> = {
      home: 'inicio',
      live: 'directo',
      rewards: 'recompensas',
      profile: 'perfil'
    };

    return (
      <nav className="bottom-nav bottom-nav-fan" aria-label="Navegacion fans">
        {items.map((item) => (
          <button key={item.tab} className={fanTab === item.tab ? 'active' : ''} onClick={() => onFanTab(item.tab)}>
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-label">{labels[item.tab]}</span>
          </button>
        ))}
      </nav>
    );
  }

  const items: Array<{ tab: ArtistTab; label: string; icon: string }> = [
    { tab: 'dashboard', label: 'panel', icon: 'DB' },
    { tab: 'golive', label: 'emitir', icon: 'ON' },
    { tab: 'orders', label: 'pedidos', icon: 'OR' },
    { tab: 'fans', label: 'fans', icon: 'FN' },
    { tab: 'profile', label: 'perfil', icon: 'ME' }
  ];

  const labels: Record<ArtistTab, string> = {
    dashboard: 'panel',
    golive: 'emitir',
    orders: 'pedidos',
    fans: 'fans',
    profile: 'perfil'
  };

  return (
    <nav className="bottom-nav bottom-nav-artist" aria-label="Navegacion equipo">
      {items.map((item) => (
        <button key={item.tab} className={artistTab === item.tab ? 'active' : ''} onClick={() => onArtistTab(item.tab)}>
          <span className="nav-icon">{item.icon}</span>
          <span className="nav-label">{labels[item.tab]}</span>
        </button>
      ))}
    </nav>
  );
}
