import { useEffect, useRef, useState } from 'react';
import type { FidelityModel } from '../state/use-fidelity-state';

type GoogleCredentialResponse = {
  credential?: string;
};

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: GoogleCredentialResponse) => void;
            ux_mode?: 'popup' | 'redirect';
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              theme?: 'outline' | 'filled_black' | 'filled_blue';
              size?: 'large' | 'medium' | 'small';
              shape?: 'rectangular' | 'pill' | 'circle' | 'square';
              text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
              width?: number;
            }
          ) => void;
        };
      };
    };
  }
}

let gisScriptPromise: Promise<void> | null = null;

function loadGoogleScript(): Promise<void> {
  if (gisScriptPromise) {
    return gisScriptPromise;
  }
  gisScriptPromise = new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('No se pudo cargar Google Identity Services.'));
    document.head.appendChild(script);
  });
  return gisScriptPromise;
}

export function AuthGate({ model }: { model: FidelityModel }) {
  const googleButtonRef = useRef<HTMLDivElement | null>(null);
  const [authIntent, setAuthIntent] = useState<'login' | 'signup'>('login');
  const clientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID || '').trim();
  const canRenderGoogle = Boolean(clientId);

  useEffect(() => {
    let cancelled = false;

    async function setupGoogleButton() {
      if (!canRenderGoogle || !googleButtonRef.current) {
        return;
      }
      try {
        await loadGoogleScript();
        if (cancelled || !window.google?.accounts?.id || !googleButtonRef.current) {
          return;
        }

        googleButtonRef.current.innerHTML = '';
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => {
            if (!response.credential) {
              return;
            }
            void model.loginWithGoogleToken(response.credential);
          },
          ux_mode: 'popup'
        });
        window.google.accounts.id.renderButton(googleButtonRef.current, {
          theme: 'outline',
          size: 'large',
          shape: 'pill',
          text: authIntent === 'login' ? 'signin_with' : 'signup_with',
          width: 320
        });
      } catch {
        // Error shown by clientId / authError fallback copy.
      }
    }

    setupGoogleButton();
    return () => {
      cancelled = true;
    };
  }, [authIntent, canRenderGoogle, clientId, model]);

  return (
    <main className="auth-shell" aria-label="Inicio de sesión">
      <section className="auth-card">
        <header className="auth-head">
          <p className="auth-kicker">Belako SuperFan App</p>
          <h1>{authIntent === 'login' ? 'Bienvenido de vuelta' : 'Crea tu Fan Zone'}</h1>
          <p className="auth-copy">
            {authIntent === 'login'
              ? 'Accede a tus conciertos, compras y progreso de fan.'
              : 'Regístrate y empieza tu journey de tiers Belako desde el primer directo.'}
          </p>
        </header>

        <div className="auth-mode-switch auth-mode-switch-pro" role="tablist" aria-label="Modo de acceso">
          <button
            className={authIntent === 'login' ? 'primary' : 'ghost'}
            role="tab"
            aria-selected={authIntent === 'login'}
            onClick={() => setAuthIntent('login')}
          >
            Iniciar sesión
          </button>
          <button
            className={authIntent === 'signup' ? 'primary' : 'ghost'}
            role="tab"
            aria-selected={authIntent === 'signup'}
            onClick={() => setAuthIntent('signup')}
          >
            Crear cuenta
          </button>
        </div>

        <div className="auth-icon-row" aria-hidden="true">
          <span className="auth-icon">CONCIERTOS</span>
          <span className="auth-icon">TIENDA</span>
          <span className="auth-icon">JOURNEY</span>
        </div>

        <article className="auth-feature-list">
          <p>Incluye:</p>
          <ul>
            <li>Acceso rápido a directos y conciertos.</li>
            <li>Checkout en euros con métodos guardados.</li>
            <li>Progreso por tiers: Fan, Super, Ultra, God.</li>
          </ul>
        </article>

        <div className="auth-cta-shell">
          {canRenderGoogle ? <div className="auth-google-button" ref={googleButtonRef} /> : null}

          {!canRenderGoogle ? (
            <p className="error-text">Falta configurar `VITE_GOOGLE_CLIENT_ID` para habilitar Google SSO.</p>
          ) : null}

          {model.authError ? <p className="error-text">{model.authError}</p> : null}
          {model.authStatus === 'logging_in' ? <p className="hint">Validando sesión segura con Google...</p> : null}
        </div>

        <small className="auth-footnote auth-footnote-pro">
          Al continuar aceptas el uso de inicio de sesión seguro y el tratamiento de datos para tu cuenta fan.
        </small>
      </section>
    </main>
  );
}
