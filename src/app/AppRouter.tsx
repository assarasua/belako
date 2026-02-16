import { ArtistScreens } from '../features/artist/ArtistScreens';
import { FanScreens } from '../features/fan/FanScreens';
import type { FidelityModel } from '../state/use-fidelity-state';

export function AppRouter({ model }: { model: FidelityModel }) {
  return model.role === 'fan' ? <FanScreens model={model} /> : <ArtistScreens model={model} />;
}
