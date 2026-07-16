import { MapView } from '../components/MapView';
import { useTerritoryOverlay } from '../territory/useTerritoryOverlay';

export function MapPage() {
  const { attach } = useTerritoryOverlay();

  return (
    <div className="relative h-full">
      <MapView onMap={attach} />
      <div className="pointer-events-none absolute top-3 left-3 rounded-xl bg-slate-900/85 px-4 py-2 backdrop-blur">
        <div className="text-sm font-bold text-white">Territory map</div>
        <div className="text-xs text-slate-400">Cells captured by runners appear here</div>
      </div>
    </div>
  );
}
