import { useMemo } from 'react';
import { useData } from '../../lib/data';
import { usePolling } from '../../lib/api';
import { fmtNum, occupancy, ago, fmtDec } from '../../lib/format';
import { LayerRow, Section, Source, ErrorNote, LiveDot, Disclosure } from '../../components/ui';
import { useStops } from '../../lib/stops';
import { distM, nearestStops } from '../../lib/geo';
import { LineBadge } from '../../components/LineBadge';
import type { ModuleProps } from '../types';
import { Anschluss } from '../../components/Anschluss';
import { BahnHbf } from '../../components/BahnHbf';
import { PuenktlichkeitSection } from '../../components/Puenktlichkeit';

const QUICK = ['Hauptbahnhof', 'Charlottenplatz', 'Stadtmitte', 'Schlossplatz', 'Bad Cannstatt Wilhelmsplatz', 'Vaihingen', 'Marienplatz', 'Feuersee'];

type PrSite = { id: string | number; name: string; address: string; lat: number; lon: number; capacity: number | null; free: number | null; live: boolean; fee: string | null; restrictions: { type: string; capacity: number }[] };
type BikeSite = { id: string | number; name: string; address: string; lat: number; lon: number; capacity: number | null; free: number | null; live: boolean; bookableUrl: string | null };
type RadStation = { id: string; name: string; lat: number | null; lon: number | null; latestDate: string | null; latestDayCount: number | null; latestHourCount: number | null; total7d: number; temperatur: number | null; wetter: string | null };

export function MobilityPanel({ visible, toggle, select, flyTo, setLayer, focus, center }: ModuleProps) {
  // Je Anliegen sind nur die passenden Abschnitte offen. Ohne Fokus bleibt alles offen —
  // der Zustand, den man über „Alle Themen“ erreicht.
  const FOCUS_SECTIONS: Record<string, string[]> = {
    parken: ['stop', 'parken', 'pr', 'rad'],
    verkehr: ['stop', 'unfall', 'verkehr', 'bahn', 'puenktlich'],
  };
  const open = (k: string) => {
    const list = focus ? FOCUS_SECTIONS[focus] : null;
    return !list ? true : list.includes(k);
  };
  const { parking, sharing, roadworks, traffic, weather, unfaelle } = useData();
  const stops = useStops();
  const pr = usePolling<{ sites: PrSite[] }>('/api/parkandride', 120_000);
  const br = usePolling<{ sites: BikeSite[]; totalSites: number }>('/api/bikeandride', 120_000);
  const rad = usePolling<{ stations: RadStation[]; latestDate: string | null; totalLatestDay: number }>('/api/radzaehler', 1800_000);

  const park = useMemo(() => {
    const sites = parking.data?.sites ?? [];
    const live = sites.filter((s) => s.free != null);
    const high85 = live.filter((s) => s.capacity && s.free != null && (1 - s.free / s.capacity) >= 0.85);
    const isPR = /^p\+r|park\s*\+?\s*ride/i;
    const nearby = live
      .filter((s) => !isPR.test(s.name))
      .map((s) => ({ ...s, dist: distM(center, [s.lon, s.lat]) }))
      .sort((a, b) => a.dist - b.dist);
    return {
      free: live.reduce((a, s) => a + (s.free ?? 0), 0),
      cap: live.reduce((a, s) => a + (s.capacity ?? 0), 0),
      live: live.length,
      total: sites.length,
      top: nearby.slice(0, 5),
      full: live.filter((s) => occupancy(s.free, s.capacity) === 'full').length,
      high85: high85.length,
    };
  }, [parking.data, center]);

  const share = useMemo(() => {
    const items = sharing.data?.items ?? [];
    const c = { car: 0, bike: 0, scooter: 0 };
    for (const i of items) c[i.kind] += i.station ? (i.available ?? 0) : 1;
    return c;
  }, [sharing.data]);

  const works = roadworks.data?.items ?? [];
  const active = works.filter((w) => w.status === 'active').length;

  const meld = traffic.data?.items ?? [];
  const akut = meld.filter((t) => t.typ === 'Unfall' || t.typ === 'Stau' || t.typ === 'Sperrung');

  const quick = QUICK.map((n) => stops.find((s) => s.properties.name === n)).filter(Boolean);

  // Park+Ride mit nächster S-/U-Bahn-Haltestelle verknüpfen (Vernetzung zu Parkhäusern & Baustellen)
  const prRecommended = useMemo(() => {
    const list = pr.data?.sites ?? [];
    const stgtEdge = list.filter((s) => /stuttgart|vaihingen|sommerrain|weilimdorf|obertürkheim|rohr|zuffenhausen|österfeld|degerloch|plieningen|bad cannstatt|fellbach|korntal|leinfelden/i.test(`${s.name} ${s.address}`));
    const pool = stgtEdge.length >= 4 ? stgtEdge : list;
    return pool.slice(0, 6).map((s) => {
      const nearStop = nearestStops(stops, [s.lon, s.lat], 1, 600)[0]?.stop ?? null;
      return { site: s, stop: nearStop };
    });
  }, [pr.data, stops]);

  const brStats = useMemo(() => {
    const list = br.data?.sites ?? [];
    const live = list.filter((s) => s.free != null && s.capacity != null);
    return {
      total: list.length,
      liveCount: live.length,
      free: live.reduce((sum, s) => sum + (s.free ?? 0), 0),
      cap: live.reduce((sum, s) => sum + (s.capacity ?? 0), 0),
      top: live.filter((s) => (s.free ?? 0) > 0).slice(0, 4),
    };
  }, [br.data]);

  return (
    <div className="module mobility" data-focus={focus ?? 'alle'}>
      <Section className="sec-stop" title="Haltestelle wählen" explain="abfahrten" aside="Echtzeit-Abfahrten" collapsible defaultOpen={open('stop') && focus !== 'parken' && focus !== 'verkehr'}>
        <div className="chips">
          {quick.map((s) => (
            <button key={s!.properties.id} type="button" className="chip" onClick={() => {
              const c = s!.geometry.coordinates as [number, number];
              select({ type: 'stop', id: s!.properties.id, name: s!.properties.name, lngLat: c, lines: s!.properties.lines });
              flyTo(c, 15);
            }}>
              {s!.properties.name.replace(' Wilhelmsplatz', '')}
            </button>
          ))}
        </div>
      </Section>

      <Section className="sec-map" title="Auf der Karte" collapsible defaultOpen={false}>
        <div className="layer-list">
          <LayerRow icon="train" tone="ink" title="Stadtbahn und S-Bahn" on={visible.network} onToggle={() => toggle('network')}
            meta="Liniennetz nach VVS-Fahrplan" />
          <LayerRow icon="stop" tone="ink" title="Haltestellen" on={visible.stops} onToggle={() => toggle('stops')}
            meta={`${fmtNum(stops.length)} Halte, antippen für Abfahrten`} />
          <LayerRow icon="parking" tone="green" title="Parkhäuser" on={visible.parking} onToggle={() => toggle('parking')}
            loading={parking.loading && !parking.data}
            meta={parking.error && !parking.data ? 'nicht erreichbar' : <><LiveDot stale={!!parking.error} /> {fmtNum(park.free)} Plätze frei in {park.live} Häusern</>} />
          <LayerRow icon="share" tone="blue" title="Sharing" on={visible.sharing} onToggle={() => toggle('sharing')}
            loading={sharing.loading && !sharing.data}
            meta={sharing.error && !sharing.data ? 'nicht erreichbar' : <><LiveDot stale={!!sharing.error} /> {fmtNum(share.car)} Autos · {fmtNum(share.bike)} Räder · {fmtNum(share.scooter)} Scooter</>} />
          <LayerRow icon="cone" tone="amber" title="Baustellen" on={visible.roadworks} onToggle={() => toggle('roadworks')}
            loading={roadworks.loading && !roadworks.data}
            meta={roadworks.error && !roadworks.data ? 'nicht erreichbar' : `${active} im Bau · ${works.length - active} geplant`} />
          <LayerRow icon="warn" tone="amber" title="Verkehrsmeldungen" on={visible.traffic} onToggle={() => toggle('traffic')}
            loading={traffic.loading && !traffic.data}
            meta={traffic.error && !traffic.data ? 'nicht erreichbar' : <><LiveDot stale={!!traffic.error} /> {meld.filter((t) => t.typ === 'Unfall').length} Unfälle · {meld.filter((t) => t.typ === 'Stau').length} Staus · {meld.filter((t) => t.typ === 'Sperrung').length} Sperrungen</>} />
          <LayerRow icon="route" tone="green" title="Hauptradrouten" on={visible.bike} onToggle={() => toggle('bike')}
            meta="Radnetz der Stadt Stuttgart" />
          <LayerRow icon="warn" tone="amber" title="Unfallorte mit Personenschaden" on={visible.unfall} onToggle={() => toggle('unfall')}
            loading={unfaelle.loading && !unfaelle.data}
            meta={unfaelle.error && !unfaelle.data ? 'nicht erreichbar' : unfaelle.data ? `${fmtNum(unfaelle.data.stats.gesamt)} Unfälle ${unfaelle.data.stand}, davon ${fmtNum(unfaelle.data.stats.rad)} mit Rad` : 'wird geladen'} />
        </div>
      </Section>

      {unfaelle.data && (
        <Section className="sec-unfall" title={`Unfallatlas ${unfaelle.data.stand}`} explain="unfall" aside={`${fmtNum(unfaelle.data.stats.gesamt)} Unfälle`} collapsible defaultOpen={open('unfall')}>
          <p className="small">
            Punktgenaue Unfälle mit Personenschaden im Stuttgarter Stadtgebiet. {fmtNum(unfaelle.data.stats.tote)} Menschen wurden getötet,
            {' '}{fmtNum(unfaelle.data.stats.schwer)} schwer und {fmtNum(unfaelle.data.stats.leicht)} leicht verletzt.
            {' '}Beteiligt: {fmtNum(unfaelle.data.stats.rad)} Radfahrende, {fmtNum(unfaelle.data.stats.fuss)} zu Fuß Gehende, {fmtNum(unfaelle.data.stats.pkw)} Pkw.
          </p>
          <div className="chips filter-chips">
            <button type="button" className={`chip ${visible.unfall ? 'on' : ''}`} aria-pressed={visible.unfall} onClick={() => toggle('unfall')}>
              {visible.unfall ? 'Unfallorte ausblenden' : 'Unfallorte einblenden'}
            </button>
            <button type="button" className="chip" onClick={() => { setLayer('unfall', true); flyTo([9.18, 48.779], 12); }}>Alle auf der Karte</button>
          </div>
          {unfaelle.data.schwerpunkte.length > 0 && (
            <>
              <h4 className="sub-head">Räumliche Schwerpunkte</h4>
              <ul className="rank-list">
                {unfaelle.data.schwerpunkte.slice(0, 5).map((s, i) => (
                  <li key={`${s.lat},${s.lon},${i}`}>
                    <button type="button" onClick={() => { setLayer('unfall', true); flyTo([s.lon, s.lat], 15.5); }}>
                      <span className="rank-name">{s.anzahl} Unfälle auf engem Raum</span>
                      <span className="rank-val">{s.rad ? `${s.rad}× Rad` : ''}{s.fuss ? `${s.rad ? ' · ' : ''}${s.fuss}× Fuß` : ''}{s.tote ? ` · ${s.tote} tödlich` : ''}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
          <p className="muted small">{unfaelle.data.hinweis}</p>
          <Source>{unfaelle.data.source} · <a href={unfaelle.data.url} target="_blank" rel="noreferrer">Unfallatlas öffnen</a></Source>
        </Section>
      )}

      <Section className="sec-verkehr" title="Verkehrsmeldungen" explain="verkehr" aside={traffic.updatedAt ? ago(traffic.updatedAt) : undefined} collapsible defaultOpen={open('verkehr')}>
        {traffic.error && !traffic.data && <ErrorNote text="Verkehrsmeldungen gerade nicht erreichbar." onRetry={traffic.reload} />}
        {traffic.data && !akut.length && <p className="muted small">Derzeit keine Unfälle, Staus oder Sperrungen gemeldet. {meld.length ? `${meld.length} Meldungen zu Baustellen und Sonstigem.` : ''}</p>}
        <ul className="traffic-list">
          {akut.slice(0, 6).map((t) => (
            <li key={t.id}>
              <button type="button" onClick={() => { setLayer('traffic', true); flyTo([t.lon, t.lat], 14.5); }}>
                <span className={`traffic-typ typ-${t.typ}`}>{t.typ}</span>
                <span className="traffic-text">{t.text}</span>
                <span className="traffic-src">{t.quelle}{t.seit ? `, seit ${new Date(t.seit).toLocaleString('de-DE', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })} Uhr` : ''}</span>
              </button>
            </li>
          ))}
        </ul>
        {akut.length > 6 && <p className="muted small">Weitere {akut.length - 6} Meldungen auf der Karte.</p>}
        <p className="muted small">Gemeldete Ereignisse inkl. Baustellen-Linien und Sperrungen der Autobahn GmbH (A8, A81, A831).</p>
      </Section>

      <PuenktlichkeitSection className="sec-puenktlich" />
      <Anschluss className="sec-anschluss" />
      <BahnHbf className="sec-bahn" />

      <Section className="sec-parken" title="Parkhäuser in der Nähe" explain="parken" aside={parking.updatedAt ? `${ago(parking.updatedAt)} · nach Entfernung` : 'nach Entfernung'} collapsible defaultOpen={open('parken')}>
        {parking.error && !parking.data && <ErrorNote text="Parkdaten gerade nicht erreichbar." onRetry={parking.reload} />}
        {park.cap > 0 && (
          <div className="occ-summary">
            <div className="occ-big">
              <span className="num">{Math.round((1 - park.free / park.cap) * 100)}<small>%</small></span>
              <span className="lbl">durchschnittlich belegt</span>
            </div>
            <div className="occ-bar" aria-hidden>
              <span style={{ width: `${(1 - park.free / park.cap) * 100}%` }} />
            </div>
            <p className="muted small">{park.full ? `${park.full} ${park.full === 1 ? 'Parkhaus' : 'Parkhäuser'} voll oder nahezu voll belegt.` : 'Derzeit kein Parkhaus voll belegt.'}</p>
          </div>
        )}
        <ul className="rank-list">
          {park.top.map((s) => {
            const occ = occupancy(s.free, s.capacity);
            return (
              <li key={s.id}>
                <button type="button" onClick={() => { select({ type: 'parking', id: s.id }); flyTo([s.lon, s.lat], 15.5); }}>
                  <span className={`occ-dot occ-${occ}`} aria-hidden />
                  <span className="rank-name">{s.name}</span>
                  <span className="rank-val"><strong>{s.free}</strong> frei <span className="rank-dist">{s.dist < 1000 ? `${Math.round(s.dist / 10) * 10} m` : `${(s.dist / 1000).toLocaleString('de-DE', { maximumFractionDigits: 1 })} km`}</span></span>
                </button>
              </li>
            );
          })}
        </ul>
      </Section>

      {prRecommended.length > 0 && (
        <Section className="sec-pr" title="Park+Ride (P+R) am Stadtrand" explain="parkandride" aside={pr.data ? `${pr.data.sites.length} Anlagen in der Region` : undefined} collapsible defaultOpen={open('pr')}>
          <p className="muted small">
            {park.high85 > 0 || active > 10
              ? `In der Innenstadt sind ${park.high85 ? `${park.high85} Parkhäuser zu über 85 % ausgelastet` : ''}${park.high85 && active > 10 ? ' und ' : ''}${active > 10 ? `${active} Baustellen im Bau` : ''}. P+R-Anlagen mit direktem S- und Stadtbahn-Anschluss:`
              : 'P+R-Anlagen im VVS-Gebiet mit direktem Übergang zu S-Bahn und Stadtbahn:'}
          </p>
          <ul className="near-list">
            {prRecommended.map(({ site, stop }) => (
              <li key={site.id}>
                <button type="button" onClick={() => {
                  if (stop) {
                    const c = stop.geometry.coordinates as [number, number];
                    select({ type: 'stop', id: stop.properties.id, name: stop.properties.name, lngLat: c, lines: stop.properties.lines });
                  }
                  flyTo([site.lon, site.lat], 15.5);
                }}>
                  <span className="near-main">
                    <span className="near-name">{site.name}</span>
                    {stop && (
                      <span className="near-lines">
                        {stop.properties.lines.slice(0, 6).map((l) => <LineBadge key={l} line={l} size="sm" />)}
                      </span>
                    )}
                    <span className="near-sub">
                      {site.free != null && site.capacity != null
                        ? `${site.free} von ${site.capacity} frei (Echtzeit)`
                        : site.capacity != null ? `${site.capacity} Stellplätze` : 'P+R-Anlage'}
                      {site.fee ? ` · ${site.fee}` : ''}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {(brStats.total > 0 || (rad.data?.stations?.length ?? 0) > 0) && (
        <Section className="sec-rad" title="Radverkehr: Zählstellen und Bike+Ride" explain="radzaehler" aside={rad.data?.latestDate ? `Stand ${new Date(`${rad.data.latestDate}T12:00:00`).toLocaleDateString('de-DE')}` : undefined} collapsible defaultOpen={open('rad')}>
          {brStats.total > 0 && (
            <p className="small">
              <strong>Bike+Ride-Fahrradboxen:</strong> {brStats.free} von {brStats.cap} Boxen an {brStats.liveCount} Echtzeit-Anlagen frei ({brStats.total} Anlagen im VVS-Gebiet). An Haltestellen mit Bike+Ride erscheint die Belegung direkt im Abfahrtsmonitor.
            </p>
          )}
          {rad.data && rad.data.stations.length > 0 && (
            <>
              <p className="muted small">
                Städtische Eco-Counter-Querschnitte: {rad.data.totalLatestDay > 0 ? <><strong>{fmtNum(rad.data.totalLatestDay)}</strong> gezählte Fahrten am letzten Messtag</> : `${rad.data.stations.length} aktive Zählstellen`}
                {weather.data ? ` (aktuell ${fmtDec(weather.data.temperature)} °C, ${Math.round(weather.data.precipitation ?? 0)} mm Niederschlag)` : ''}.
              </p>
              <ul className="rank-list">
                {rad.data.stations.slice(0, 6).map((st) => (
                  <li key={st.id}>
                    <button type="button" onClick={() => { setLayer('bike', true); if (st.lon != null && st.lat != null) flyTo([st.lon, st.lat], 15); }}>
                      <span className="rank-name">{st.name}</span>
                      <span className="rank-val">
                        {st.latestDayCount != null ? <><strong>{fmtNum(st.latestDayCount)}</strong> / Tag</> : <><strong>{fmtNum(st.total7d)}</strong> (7 Tage)</>}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Section>
      )}

      <Source disclosure>
        Fahrplan: VVS (CC BY 4.0). Abfahrten: EFA-BW/NVBW (dl-de/by-2-0). Parken, P+R und Bike+Ride: Stadt Stuttgart, PBW, VRS, VVS, Kienzler über MobiData BW (ParkAPI).
        Fahrradzählstellen: Landeshauptstadt Stuttgart über MobiData BW (Eco-Counter, CC BY 4.0). Sharing: Anbieter über MobiData BW.
        Baustellen und Radrouten: Landeshauptstadt Stuttgart (Open Data). Verkehrsmeldungen: LMS BW / IVLZ Stuttgart über MobiData BW (dl-de/by-2-0); Autobahn GmbH des Bundes.
      </Source>
    </div>
  );
}

