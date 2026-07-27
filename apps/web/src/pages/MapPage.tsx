import { TERRITORY_DECAY_DAYS } from '@runturf/shared';
import { MapView } from '../components/MapView';
import { FlagIcon } from '../components/icons';
import { useTerritoryOverlay } from '../territory/useTerritoryOverlay';

export function MapPage() {
  const { attach } = useTerritoryOverlay();

  return (
    <div className="relative h-full">
      <MapView onMap={attach} />
      <div className="glass pointer-events-none absolute top-3 left-3 flex items-center gap-2.5 px-3.5 py-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-volt/15 text-volt">
          <FlagIcon size={18} />
        </span>
        <div>
          <div className="text-[14px] font-bold text-ink">Territory map</div>
          <div className="text-[12px] text-ink-2">Run through a cell to claim it</div>
          <div className="text-[11px] text-ink-3">
            Turf fades after {TERRITORY_DECAY_DAYS} days — run it again to defend it
          </div>
        </div>
      </div>
    </div>
  );
}
