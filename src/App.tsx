import { AppRouter } from './app/AppRouter';
import { BottomNav } from './components/BottomNav';
import { Sheets } from './components/Sheets';
import { TopBar } from './components/TopBar';
import { onboardingCopy, useFidelityState } from './state/use-fidelity-state';

export default function App() {
  const model = useFidelityState();
  const viewKey = model.fanTab;
  const showPreEntry = !model.onboardingDone;
  const tabTitle: Record<typeof model.fanTab, string> = {
    home: 'Descubrir',
    live: 'Live Show',
    store: 'Tienda',
    rewards: 'Recompensas',
    profile: 'Perfil'
  };
  const onboardingProgress = ((model.onboardingStep + 1) / 3) * 100;
  const topbarTitle = showPreEntry ? 'Belako SuperFan App' : tabTitle[model.fanTab];
  const topbarSubtitle = showPreEntry ? 'Pre-Onboarding' : 'Belako Editorial Experience';

  return (
    <div className="app-shell">
      <TopBar title={topbarTitle} subtitle={topbarSubtitle} />

      <main className="phone-frame">
        {showPreEntry ? (
          <section className="pre-entry" aria-label="Onboarding previo">
            <p className="badge">WELCOME</p>
            <h2>Diseña tu experiencia fan</h2>
            <p className="hint">Completa 3 pasos y entra directo al universo Belako.</p>
            <div className="progress-track" aria-hidden="true">
              <div className="progress-fill" style={{ width: `${onboardingProgress}%` }} />
            </div>
            <ol className="pre-entry-steps">
              <li className={model.onboardingStep >= 0 ? 'done' : ''}>Personaliza tu experiencia</li>
              <li className={model.onboardingStep >= 1 ? 'done' : ''}>Activa recompensas de fidelidad</li>
              <li className={model.onboardingStep >= 2 ? 'done' : ''}>Prepara tu primer directo</li>
            </ol>
            <article className="metric-card onboarding-message">
              <p>{onboardingCopy(model.onboardingStep)}</p>
            </article>
            <div className="row onboarding-actions">
              <button onClick={model.completeOnboarding}>
                {model.onboardingStep >= 2 ? 'Entrar a la experiencia' : 'Continuar'}
              </button>
              <button className="ghost" onClick={() => model.setOnboardingDone(true)}>
                Saltar
              </button>
            </div>
          </section>
        ) : (
          <section key={viewKey} className="tab-scene">
            <AppRouter model={model} />
          </section>
        )}
      </main>

      {!showPreEntry ? (
        <BottomNav fanTab={model.fanTab} onFanTab={model.setFanTab} />
      ) : null}

      {!showPreEntry ? <Sheets model={model} /> : null}

      {model.statusText ? (
        <p className="feedback fixed" role="status" aria-live="polite">
          {model.statusText}
        </p>
      ) : null}
    </div>
  );
}
