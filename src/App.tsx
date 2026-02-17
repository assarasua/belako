import { AppRouter } from './app/AppRouter';
import { AuthGate } from './components/AuthGate';
import { BottomNav } from './components/BottomNav';
import { OnboardingFlow } from './components/OnboardingFlow';
import { Sheets } from './components/Sheets';
import { TopBar } from './components/TopBar';
import { useFidelityState } from './state/use-fidelity-state';

export default function App() {
  const model = useFidelityState();
  if (model.authStatus !== 'logged_in') {
    return <AuthGate model={model} />;
  }

  if (model.shouldShowOnboarding) {
    return <OnboardingFlow model={model} />;
  }

  const viewKey = model.fanTab;
  const tabTitle: Record<typeof model.fanTab, string> = {
    home: 'Descubrir',
    live: 'Home',
    store: 'Tienda',
    rewards: 'Recompensas',
    profile: 'Perfil'
  };
  const topbarTitle = tabTitle[model.fanTab];
  const topbarSubtitle = 'Belako Fan Zone';

  return (
    <div className="app-shell">
      <TopBar title={topbarTitle} subtitle={topbarSubtitle} />

      <main className="phone-frame">
        <section key={viewKey} className="tab-scene">
          <AppRouter model={model} />
        </section>
      </main>

      <BottomNav fanTab={model.fanTab} onFanTab={model.setFanTab} />

      <Sheets model={model} />

      {model.statusText ? (
        <p className="feedback fixed" role="status" aria-live="polite">
          {model.statusText}
        </p>
      ) : null}
    </div>
  );
}
