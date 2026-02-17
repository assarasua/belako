import type { FanTab } from '../lib/types';

type Props = {
  fanTab: FanTab;
  onFanTab: (tab: FanTab) => void;
};

export function BottomNav({ fanTab, onFanTab }: Props) {
  const items: Array<{ tab: FanTab; label: string; icon: string }> = [
    { tab: 'live', label: 'home', icon: 'HM' },
    { tab: 'store', label: 'tienda', icon: 'SH' },
    { tab: 'home', label: 'inicio', icon: 'Live' },
    { tab: 'rewards', label: 'recompensas', icon: 'RW' },
    { tab: 'profile', label: 'perfil', icon: 'ME' }
  ];

  const labels: Record<FanTab, string> = {
    home: 'inicio',
    live: 'home',
    store: 'tienda',
    rewards: 'recompensas',
    profile: 'perfil'
  };

  return (
    <nav className="bottom-nav bottom-nav-fan" aria-label="Navegacion fans">
      {items.map((item) => (
        <button
          key={item.tab}
          className={`${fanTab === item.tab ? 'active' : ''} ${item.tab === 'home' ? 'nav-home' : ''}`.trim()}
          onClick={() => onFanTab(item.tab)}
        >
          <span className="nav-icon">{item.icon}</span>
          <span className="nav-label">{labels[item.tab]}</span>
        </button>
      ))}
    </nav>
  );
}
