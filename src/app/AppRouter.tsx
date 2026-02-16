import { FanScreens } from '../features/fan/FanScreens';
import type { FidelityModel } from '../state/use-fidelity-state';

export function AppRouter({ model }: { model: FidelityModel }) {
  return <FanScreens model={model} />;
}
