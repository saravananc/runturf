import type { PurchaseResult, ShopView } from '@runturf/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { get, post } from '../api/client';
import { CoinIcon } from '../components/icons';
import { EmptyState } from '../components/ui';

const ICON_TONE: Record<string, string> = {
  xp_boost: 'text-gold',
  streak_freeze: 'text-skyx',
};

export function ShopPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['shop'], queryFn: () => get<ShopView>('/shop') });

  const buy = useMutation({
    mutationFn: (code: string) => post<PurchaseResult>(`/shop/${code}/buy`),
    onSuccess: () => {
      // Balance shows on Profile too; refresh both.
      qc.invalidateQueries({ queryKey: ['shop'] });
      qc.invalidateQueries({ queryKey: ['stats'] });
    },
  });

  return (
    <div className="mx-auto h-full w-full max-w-lg overflow-y-auto p-4 pb-8">
      <div className="flex items-baseline justify-between">
        <h1 className="t-title text-ink">Shop</h1>
        {data && (
          <span className="inline-flex items-center gap-1.5 text-[15px] font-bold text-gold">
            <CoinIcon size={16} /> {data.coins}
          </span>
        )}
      </div>
      <p className="mt-0.5 text-[13px] text-ink-2">Spend coins on perks for your next run</p>

      {isLoading && <p className="py-10 text-center text-ink-2">Loading…</p>}

      <div className="mt-5 space-y-2.5">
        {data?.items.length === 0 && (
          <EmptyState icon={<CoinIcon size={32} />} title="Nothing in stock yet" />
        )}
        {data?.items.map((item) => {
          const affordable = data.coins >= item.cost;
          return (
            <div key={item.code} className="card anim-rise flex items-center gap-3.5 p-4">
              <span className={`text-3xl ${ICON_TONE[item.code] ?? ''}`} aria-hidden="true">
                {item.icon}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[14.5px] font-bold text-ink">{item.name}</span>
                  {item.owned > 0 && (
                    <span className="rounded-full bg-volt/15 px-2 py-0.5 text-[11px] font-extrabold text-volt">
                      ×{item.owned}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-[12px] text-ink-2">{item.description}</p>
              </div>
              <button
                onClick={() => buy.mutate(item.code)}
                disabled={!affordable || buy.isPending}
                className="btn btn-primary shrink-0 px-3.5 py-2 text-[13px]"
              >
                <CoinIcon size={14} /> {item.cost}
              </button>
            </div>
          );
        })}
      </div>

      {buy.isError && (
        <p role="alert" className="mt-3 text-center text-[13px] font-medium text-ember">
          {buy.error instanceof Error ? buy.error.message : 'Purchase failed'}
        </p>
      )}
    </div>
  );
}
