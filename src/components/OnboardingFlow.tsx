import type { FidelityModel } from '../state/use-fidelity-state';

const ONBOARDING_STEPS = [
  {
    title: 'Descubre directos en tiempo real',
    description: 'Accede a shows en directo y vive la energía de Belako desde una experiencia mobile-first.',
    icon: 'LIVE'
  },
  {
    title: 'Compra merch oficial en euros',
    description: 'Compra rápida y segura con Stripe, con checkout optimizado para móvil y datos guardados.',
    icon: 'SHOP'
  },
  {
    title: 'Sube tu nivel fan con XP',
    description: 'Completa acciones clave para progresar por tiers y desbloquear estatus en la comunidad.',
    icon: 'XP'
  }
] as const;

export function OnboardingFlow({ model }: { model: FidelityModel }) {
  const step = Math.min(model.onboardingStep, ONBOARDING_STEPS.length - 1);
  const current = ONBOARDING_STEPS[step];
  const isLast = step === ONBOARDING_STEPS.length - 1;
  const progress = ((step + 1) / ONBOARDING_STEPS.length) * 100;

  return (
    <main className="onboarding-shell" aria-label="Onboarding">
      <section className="onboarding-card">
        <p className="auth-kicker">Bienvenido{model.authUserEmail ? ` · ${model.authUserEmail}` : ''}</p>
        <div className="onboarding-icon-wrap" aria-hidden="true">
          <span className="onboarding-icon">{current.icon}</span>
        </div>
        <h1>{current.title}</h1>
        <p className="auth-copy">{current.description}</p>

        <div className="progress-track" aria-hidden="true">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <small className="hint">Paso {step + 1} de {ONBOARDING_STEPS.length}</small>

        <div className="onboarding-fixed-actions">
          <button
            className="primary"
            onClick={() => {
              if (isLast) {
                model.finishOnboardingForCurrentUser();
                return;
              }
              model.completeOnboardingStep();
            }}
          >
            {isLast ? 'Entrar a la app' : 'Continuar'}
          </button>
        </div>
      </section>
    </main>
  );
}
