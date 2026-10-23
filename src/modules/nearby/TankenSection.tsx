import { useMemo, useState } from 'react';
import { useOnDemand } from '../../lib/api';
import { distM } from '../../lib/geo';
import type { Facility, Selection } from '../../lib/types';
import {
  FUELS, fmtPrice, fmtStand, fuelPrice, priceLine, tankFacility,
  type Fuel, type TankResponse,
} from '../../lib/tanken';
import { Icon } from '../../components/Icon';
import { ErrorNote, Section, SkeletonRows, Source } from '../../components/ui';
import { tr } from '../../lib/i18n';

type Props = {
  select: (s: Selection) => void;
  flyTo: (lngLat: [number, number], zoom?: number) => void;
  setNearby: (d: { items: Facility[]; color: Record<string, string> } | null) => void;
  onMap: () => void;
  origin: [number, number];
  setLayer: (k: 'nearby', on: boolean) => void;
};

const fmtDist = (m: number | null) => {
  if (m == null) return null;
  return m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toLocaleString('de-DE', { maximumFractionDigits: 1 })} km`;
};

export function TankenSection({ select, flyTo, setNearby, onMap, origin, setLayer }: Props) {
  const [fuel, setFuel] = useState<Fuel>('e10');
  const [sort, setSort] = useState<'price' | 'dist'>('price');
  const t = useOnDemand<TankResponse>('/api/nearby/tanken');
  const d = t.data;
  const fuelLabel = FUELS.find((f) => f.id === fuel)?.label ?? 'E10';
  const outsideFallback = d?.provider === 'infranode' && distM(origin, [9.1829, 48.7758]) > 5000;

  const sorted = useMemo(() => {
    const list = (d?.stations ?? []).map((s) => ({ ...s, dM: distM(origin, [s.lon, s.lat]) }));
    if (sort === 'dist') return list.sort((a, b) => a.dM - b.dM);
    return list.sort((a, b) => {
      if (a.isOpen !== b.isOpen) return a.isOpen ? -1 : 1;
      const pa = fuelPrice(a, fuel);
      const pb = fuelPrice(b, fuel);
      if (pa == null && pb == null) return a.dM - b.dM;
      if (pa == null) return 1;
      if (pb == null) return -1;
      return pa - pb || a.dM - b.dM;
    });
  }, [d, fuel, sort, origin]);

  const top = sorted.slice(0, 8);
  const showMap = () => {
    if (!d) return;
    const items = d.stations.map((s) => tankFacility(s, d.stand, d.source));
    setNearby({ items, color: { tanken: '#D97706' } });
    setLayer('nearby', true);
    onMap();
    flyTo(origin, 12);
  };
  const open = (s: TankResponse['stations'][number]) => {
    const f = tankFacility(s, d!.stand, d!.source);
    select({ type: 'facility', item: f });
    flyTo([f.lon, f.lat], 16);
  };

  return (
    <Section title="Tanken" explain="tanken" aside={d ? `${d.stations.length} Tankstellen` : undefined}>
      {t.error && !d && <ErrorNote text={tr('Tankpreise derzeit nicht abrufbar.')} onRetry={t.reload} />}
      {!d && !t.error && <SkeletonRows rows={4} />}
      {d && (
        <>
          <div className="chips filter-chips">
            {FUELS.map((f) => (
              <button key={f.id} type="button" className={`chip ${fuel === f.id ? 'on' : ''}`} aria-pressed={fuel === f.id} onClick={() => setFuel(f.id)}>
                {f.label}
              </button>
            ))}
            <button type="button" className={`chip ${sort === 'price' ? 'on' : ''}`} aria-pressed={sort === 'price'} onClick={() => setSort('price')}>{tr('Günstigste zuerst')}</button>
            <button type="button" className={`chip ${sort === 'dist' ? 'on' : ''}`} aria-pressed={sort === 'dist'} onClick={() => setSort('dist')}>{tr('Nächste zuerst')}</button>
          </div>

          {d.stale && (
            <p className="muted small">
              Die Preise konnten gerade nicht aktualisiert werden. Angezeigt wird der letzte Stand von {fmtStand(d.stand)} Uhr.
            </p>
          )}
          {t.error && d && !d.stale && (
            <p className="muted small">Aktualisierung fehlgeschlagen; angezeigt wird der letzte geladene Stand.</p>
          )}
          {outsideFallback && (
            <p className="muted small">Der keylose Abruf deckt nur die Innenstadt ab; für Tankstellen in den Außenbezirken ist ein Tankerkönig-Key nötig.</p>
          )}

          {top.length === 0 ? (
            <p className="small">{tr('Derzeit sind keine Tankstellen mit Preisen gemeldet.')}</p>
          ) : (
            <ul className="near-list tank-list">
              {top.map((s) => {
                const p = fuelPrice(s, fuel);
                return (
                  <li key={s.id}>
                    <button type="button" onClick={() => open(s)}>
                      <span className="tank-price" aria-label={`${fuelLabel} ${fmtPrice(p)}`}>
                        <strong>{fmtPrice(p)}</strong>
                        <small>{fuelLabel}</small>
                      </span>
                      <span className="near-main">
                        <span className="near-name">{s.name}{!s.isOpen && <span className="tank-closed">geschlossen</span>}</span>
                        <span className="near-sub">{[fmtDist(s.dM), s.address, s.brand && s.brand !== s.name ? s.brand : null].filter(Boolean).join(' · ')}</span>
                        <span className="near-sub">{priceLine(s)}</span>
                      </span>
                      <Icon name="chevron" size={16} className="muted" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="row-actions">
            <button type="button" className="chip" onClick={showMap}><Icon name="pin" size={16} /> {tr('Auf der Karte')}</button>
            <button type="button" className="chip" onClick={t.reload}><Icon name="refresh" size={16} /> {tr('Preise aktualisieren')}</button>
          </div>

          <Source>
            {d.source}. {d.provider === 'infranode' ? `Keyloser Zugriff im ${d.radiusKm}-km-Radius um die Stadtmitte.` : `Abruf im ${d.radiusKm}-km-Radius um die Stadtmitte.`}
            {' '}Abgerufen {fmtStand(d.stand)} Uhr. Preise ohne Gewähr; maßgeblich ist die Zapfsäule.{' '}
            <a href={d.licenseUrl} target="_blank" rel="noreferrer">Lizenz {d.license}</a>.
          </Source>
        </>
      )}
    </Section>
  );
}
