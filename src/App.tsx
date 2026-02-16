import { AppRouter } from './app/AppRouter';
import { BottomNav } from './components/BottomNav';
import { Sheets } from './components/Sheets';
import { TopBar } from './components/TopBar';
import { onboardingCopy, useFidelityState } from './state/use-fidelity-state';

export default function App() {
  const model = useFidelityState();
  const viewKey = `${model.role}-${model.role === 'fan' ? model.fanTab : model.artistTab}`;
  const showPreEntry = model.role === 'fan' && !model.onboardingDone;

  return (
    <div className="app-shell">
      <TopBar role={model.role} onSwitchRole={model.switchRole} />

      <main className="phone-frame">
        {showPreEntry ? (
          <section className="pre-entry" aria-label="Onboarding previo">
            <p className="badge">WELCOME</p>
            <h2>Belako SuperFan App</h2>
            <p className="hint">Antes de entrar, completa 3 pasos rápidos.</p>
            <ol className="pre-entry-steps">
              <li className={model.onboardingStep >= 0 ? 'done' : ''}>Personaliza tu experiencia</li>
              <li className={model.onboardingStep >= 1 ? 'done' : ''}>Activa recompensas Belako Coin</li>
              <li className={model.onboardingStep >= 2 ? 'done' : ''}>Prepara tu primer directo</li>
            </ol>
            <article className="metric-card">
              <p>{onboardingCopy(model.onboardingStep)}</p>
            </article>
            <div className="row">
              <button onClick={model.completeOnboarding}>
                {model.onboardingStep >= 2 ? 'Entrar a la app' : 'Siguiente paso'}
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
        <BottomNav
          role={model.role}
          fanTab={model.fanTab}
          artistTab={model.artistTab}
          onFanTab={model.setFanTab}
          onArtistTab={model.setArtistTab}
        />
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
