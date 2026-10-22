import { useEffect, useMemo, useState } from 'react';
import type { ModuleProps } from '../types';
import { usePolling } from '../../lib/api';
import { ErrorNote, Section, Source, SkeletonRows } from '../../components/ui';
import { Icon } from '../../components/Icon';
import { SpeakButton } from '../../components/SpeakButton';
import { PrintSign } from '../../components/PrintSign';
import '../../styles/schnittstellen.css';

type Tab = 'karte' | 'zahlen' | 'transparenz' | 'fundstuecke' | 'ausgabe';

interface KatalogLayer {
  name: string; title: string; abstract: string; workspace: string;
  crs: string | null; bbox: number[] | null; frei: boolean;
}
interface Katalog {
  count: number; frei: number; workspaces: { id: string; count: number }[];
  layers: KatalogLayer[]; stand: string; hinweis: string; source: string;
}
interface WfsAntwort {
  type: 'FeatureCollection'; features: GeoJSON.Feature[];
  meta: { layer: string; title: string; count: number; source: string; license: string; bbox: string };
}
interface Adresse { id: string; label: string; type?: string | null; typ?: string | null; lat: number; lon: number; street?: string | null; nr?: string | null }
interface AdressAntwort { items: Adresse[]; source: string }
interface KomunisEntry {
  position: string; title: string; date: string | null; typ: string | null;
  unid: string | null; children: number; leaf: boolean; url: string | null;
}
interface KomunisAntwort { start: string; entries: KomunisEntry[]; timestamp: string | null; source: string; hinweis: string }
interface KomunisDok { url: string; xlsx: string[]; source: string }
interface FdsItem { id: number; title: string; status: string; statusLabel: string; created: string; lastMessage: string; url: string; publicBody: string }
interface FdsAntwort { total: number; items: FdsItem[]; allCount: number; source: string; portal: string; hinweis: string }
interface FoodPoint { id: number; name: string; lat: number; lon: number; url: string }
interface FoodAntwort {
  region: { id: number; name: string; description: string | null; lat: number; lon: number };
  stats: { activeFoodSharePoints?: number; activeHomeRegionFoodsavers?: number; savedFoodKgLastMonth?: number } | null;
  points: FoodPoint[]; events: unknown[]; source: string; license: string; hinweis: string;
}
interface GbifItem { id: number; name: string; scientific: string | null; date: string | null; place: string | null; lat: number; lon: number; url: string | null; dataset: string | null; license: string | null }
interface GbifAntwort { items: GbifItem[]; total: number; lat: number; lon: number; radius: number; source: string; license: string; hinweis: string }
interface OsmNote { id: number; text: string; date: string | null; comments: number; lat: number; lon: number; url: string | null }
interface OsmAntwort { items: OsmNote[]; lat: number; lon: number; radius: number; source: string; hinweis: string; newNote: string }
interface WikItem { id: string; name: string; lat: number; lon: number; url: string | null }
interface WikAntwort { items: WikItem[]; total: number; query: string; source: string; hinweis: string }
interface LibItem { ppn: string; title: string; author: string | null; year: string | null; url: string }
interface LibAntwort { items: LibItem[]; total: number; query: string; source: string }
interface DcatItem { id: string; title: string; notes: string | null; modified: string | null; license: string | null; organization: string | null; url: string }
interface DcatAntwort { total: number; items: DcatItem[]; neu: DcatItem[]; source: string; hinweis: string }
interface CkanItem extends DcatItem { resources: { name: string; format: string | null; url: string }[] }
interface CkanAntwort { total: number; items: CkanItem[]; neu: CkanItem[]; firstRun: boolean; source: string; hinweis: string; stand: string }
interface SpEvent { id: string; title: string; date: string; time: string | null; location: string | null; categories: string[]; url: string }
interface SpAusstellung { id: number; title: string; from: string | null; to: string | null; location: string | null; category: string | null; url: string }
interface SpAntwort { events: SpEvent[]; exhibitions: SpAusstellung[]; source: string; lizenz: string; hinweis: string; stand: string }

function useDebounced<T>(value: T, ms = 350) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

function fcFromPoints<T extends { id: string | number; name: string; lat: number | null; lon: number | null }>(
  items: T[], layer: string, title: string,
): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: items.filter((x) => x.lat != null && x.lon != null).map((x) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [x.lon!, x.lat!] },
      properties: {
        id: String(x.id), _layer: layer, _layerTitle: title, _name: x.name,
        _props: JSON.stringify(x),
      },
    })),
  };
}

const fmtDay = (s: string | null) => {
  if (!s) return '';
  const d = new Date(s);
  return Number.isNaN(+d) ? s : d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
};
const base = (name: string) => name.replace(/^[^:]+:/, '').replace(/_EPSG\d+(_TIFF)?$/i, '');

export function SchnittstellenPanel({ center, flyTo, setWissen, setLayer }: ModuleProps) {
  const [tab, setTab] = useState<Tab>('karte');
  // Karte
  const katalog = usePolling<Katalog>('/api/stadt/wfs/katalog', 24 * 3600_000);
  const [catQ, setCatQ] = useState('');
  const [group, setGroup] = useState('alle');
  const [onlyFree, setOnlyFree] = useState(true);
  const [allLayers, setAllLayers] = useState(false);
  const [active, setActive] = useState<KatalogLayer | null>(null);
  const [mapTitle, setMapTitle] = useState('Stadt-Layer');
  const [layerData, setLayerData] = useState<WfsAntwort | null>(null);
  const [layerBusy, setLayerBusy] = useState(false);
  const [layerErr, setLayerErr] = useState<string | null>(null);
  const [addrQ, setAddrQ] = useState('');
  const addrDeb = useDebounced(addrQ);
  const addr = usePolling<AdressAntwort>(addrDeb.trim().length >= 3 ? `/api/stadt/adresse?q=${encodeURIComponent(addrDeb.trim())}` : null, 5 * 60_000);

  // KOMUNIS
  const [path, setPath] = useState<{ position: string; title: string }[]>([]);
  const komunisStart = path[path.length - 1]?.position ?? '';
  const komunis = usePolling<KomunisAntwort>(`/api/stadt/komunis?start=${encodeURIComponent(komunisStart)}`, 12 * 3600_000);
  const [docs, setDocs] = useState<Record<string, KomunisDok>>({});
  const [docBusy, setDocBusy] = useState<string | null>(null);

  // Transparenz
  const fds = usePolling<FdsAntwort>('/api/stadt/fragdenstaat?limit=30', 6 * 3600_000);
  const dcat = usePolling<DcatAntwort>('/api/stadt/katalog', 12 * 3600_000);
  const ckan = usePolling<CkanAntwort>('/api/stadt/ckan', 12 * 3600_000);
  const stadtpalais = usePolling<SpAntwort>('/api/stadt/stadtpalais', 6 * 3600_000);
  const [fdsFilter, setFdsFilter] = useState<'alle' | 'offen' | 'beantwortet'>('alle');
  const [ckanQ, setCkanQ] = useState('');
  const ckanItems = useMemo(() => {
    const q = ckanQ.trim().toLowerCase();
    if (!q) return ckan.data?.items ?? [];
    return (ckan.data?.items ?? []).filter((d) => `${d.title} ${d.organization ?? ''} ${d.notes ?? ''}`.toLowerCase().includes(q));
  }, [ckan.data, ckanQ]);

  // Fundstücke
  const food = usePolling<FoodAntwort>('/api/stadt/foodsharing', 12 * 3600_000);
  const gbif = usePolling<GbifAntwort>(`/api/stadt/gbif?lat=${center[1].toFixed(4)}&lon=${center[0].toFixed(4)}&r=2500`, 12 * 3600_000);
  const osm = usePolling<OsmAntwort>(`/api/stadt/osm-notes?lat=${center[1].toFixed(4)}&lon=${center[0].toFixed(4)}&r=2000`, 15 * 60_000);
  const wik = usePolling<WikAntwort>('/api/stadt/wikidata', 24 * 3600_000);
  const [libQ, setLibQ] = useState('Stuttgart');
  const libDeb = useDebounced(libQ);
  const lib = usePolling<LibAntwort>(`/api/stadt/bibliothek?q=${encodeURIComponent(libDeb.trim())}`, 3600_000);

  // Ausgabe
  const [print, setPrint] = useState<{ title: string; subtitle?: string; url: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const activeName = active?.name ?? 'GEOLINE_FLEX:A62_BRU_BRUNNEN_Brunnen_in_Betr_EPSG25832';
  const activeTitle = mapTitle || active?.title || 'Brunnen in Betrieb';

  const filtered = useMemo(() => {
    const q = catQ.trim().toLowerCase();
    return (katalog.data?.layers ?? []).filter((l) => {
      if (onlyFree && !l.frei) return false;
      if (group !== 'alle' && l.workspace !== group) return false;
      if (!q) return true;
      return `${l.title} ${l.name}`.toLowerCase().includes(q);
    });
  }, [katalog.data, catQ, group, onlyFree]);
  const shownLayers = allLayers ? filtered.slice(0, 80) : filtered.slice(0, 12);

  const loadLayer = async (l: KatalogLayer) => {
    setLayerBusy(true); setLayerErr(null); setActive(l); setMapTitle(l.title);
    try {
      const r = await fetch(`/api/stadt/wfs?layer=${encodeURIComponent(l.name)}&lat=${center[1].toFixed(5)}&lon=${center[0].toFixed(5)}&r=3&limit=400`);
      const j = await r.json() as WfsAntwort & { error?: string };
      if (!r.ok) throw new Error(j.error ?? `Fehler ${r.status}`);
      setLayerData(j);
      setWissen(j);
      setLayer('wissen', true);
      flyTo(center, 13);
    } catch (e) {
      setLayerErr((e as Error).message);
      setLayerData(null); setWissen(null);
    } finally { setLayerBusy(false); }
  };

  const hideWissen = () => { setWissen(null); setLayer('wissen', false); setLayerData(null); };

  const openDoc = async (e: KomunisEntry) => {
    if (!e.unid) return;
    setDocBusy(e.unid);
    try {
      const r = await fetch(`/api/stadt/komunis/doc?unid=${encodeURIComponent(e.unid)}`);
      const j = await r.json() as KomunisDok & { error?: string };
      if (!r.ok) throw new Error(j.error ?? 'Dokument nicht erreichbar');
      setDocs((d) => ({ ...d, [e.unid!]: j }));
    } catch (err) {
      setDocs((d) => ({ ...d, [e.unid!]: { url: e.url ?? '', xlsx: [], source: (err as Error).message } }));
    } finally { setDocBusy(null); }
  };

  const showFc = (items: { id: string | number; name: string; lat: number | null; lon: number | null }[], layer: string, title: string) => {
    const fc = fcFromPoints(items, layer, title);
    setWissen(fc);
    setLayer('wissen', true);
    setMapTitle(title);
    if (items.length) flyTo([items[0].lon ?? center[0], items[0].lat ?? center[1]], 13);
  };

  const feed = (path: string) => `${window.location.origin}${path}`;
  const layerFeed = `/api/stadt/wfs?layer=${encodeURIComponent(activeName)}&lat=${center[1].toFixed(4)}&lon=${center[0].toFixed(4)}&r=3&limit=300`;
  const layerRss = `/api/stadt/wfs.rss?layer=${encodeURIComponent(activeName)}`;

  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* egal */ }
  };

  const fdsItems = (fds.data?.items ?? []).filter((x) => {
    if (fdsFilter === 'alle') return true;
    const done = ['response_received', 'resolved', 'successful', 'partially_successful', 'refused', 'not_held', 'withdrawn'].includes(x.status);
    return fdsFilter === 'beantwortet' ? done : !done;
  });

  return (
    <div className="module wiss">
      <div className="wiss-tabs seg" role="tablist" aria-label="Stadtwissen">
        {([['karte', 'Karte'], ['zahlen', 'Zahlen'], ['transparenz', 'Transparenz'], ['fundstuecke', 'Fundstücke'], ['ausgabe', 'Ausgabe']] as [Tab, string][]).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>

      {tab === 'karte' && (
        <div className="wiss-pane">
          <p className="wiss-lead">
            Die Stadt betreibt hunderte Fachlayer, einen eigenen Geocoder und ein Statistikarchiv.
            Hier lassen sich die freigegebenen Layer direkt auf die Karte legen – mit Quelle und Lizenz.
          </p>

          <Section title="Adresse finden" aside="amtlicher Geocoder">
            <label className="wiss-search">
              <Icon name="search" size={17} />
              <input value={addrQ} onChange={(e) => setAddrQ(e.target.value)} placeholder="Adresse, Straße oder Haltestelle" aria-label="Adresse suchen" />
            </label>
            {addr.data?.items?.length ? (
              <ul className="wiss-suggest">
                {addr.data.items.slice(0, 5).map((a) => (
                  <li key={`${a.id}-${a.lat}-${a.lon}`}>
                    <button type="button" onClick={() => flyTo([a.lon, a.lat], 16)}>
                      <span><strong>{a.label}</strong>{a.typ && <small>{a.typ}</small>}</span>
                      <Icon name="pin" size={15} />
                    </button>
                  </li>
                ))}
              </ul>
            ) : addr.loading && addrDeb.trim().length >= 3 ? <p className="muted small">Suche …</p> : null}
            {addr.error && <ErrorNote text={addr.error} onRetry={addr.reload} />}
            <Source>{addr.data?.source ?? 'Landeshauptstadt Stuttgart, gis6 Location Finder'}</Source>
          </Section>

          <Section title="Stadt-Layer" aside={`${katalog.data?.count ?? 458} im Katalog · ${katalog.data?.frei ?? 77} freigegeben`}>
            <p className="wiss-small">{katalog.data?.hinweis ?? 'Der Katalog wird aus den WFS-Capabilities der Stadt geladen.'}</p>
            <div className="wiss-controls">
              <label className="wiss-search">
                <Icon name="search" size={16} />
                <input value={catQ} onChange={(e) => setCatQ(e.target.value)} placeholder="Layer durchsuchen, z. B. Brunnen, B-Plan, Lärm" aria-label="Layer durchsuchen" />
              </label>
              <select value={group} onChange={(e) => setGroup(e.target.value)} aria-label="Workspace filtern">
                <option value="alle">Alle Workspaces</option>
                {(katalog.data?.workspaces ?? []).map((w) => <option key={w.id} value={w.id}>{w.id} ({w.count})</option>)}
              </select>
              <label className="wiss-check">
                <input type="checkbox" checked={onlyFree} onChange={(e) => setOnlyFree(e.target.checked)} />
                <span>Nur freigegebene Layer</span>
              </label>
            </div>
            {katalog.loading && !katalog.data && <SkeletonRows rows={4} />}
            {katalog.error && <ErrorNote text={katalog.error} onRetry={katalog.reload} />}
            <ul className="wiss-layer-list">
              {shownLayers.map((l) => (
                <li key={l.name} className={active?.name === l.name ? 'is-active' : ''}>
                  <div className="wiss-layer-main">
                    <span className="wiss-layer-title">{l.title}</span>
                    <span className="wiss-layer-name">{l.name}</span>
                  </div>
                  {l.frei ? (
                    <button type="button" className="chip wiss-mini" onClick={() => void loadLayer(l)} disabled={layerBusy}>
                      {layerBusy && active?.name === l.name ? 'Lädt …' : 'Karte'}
                    </button>
                  ) : (
                    <span className="wiss-lock" title="Für diesen Layer fehlt die Freigabe als Open Data">Freigabe nötig</span>
                  )}
                </li>
              ))}
            </ul>
            {filtered.length > 12 && !allLayers && (
              <button type="button" className="show-more" onClick={() => setAllLayers(true)}>Alle {filtered.length} Treffer anzeigen</button>
            )}
            {filtered.length === 0 && <p className="muted small">Kein Layer gefunden.</p>}
            {layerErr && <ErrorNote text={layerErr} />}
            {layerData && (
              <div className="wiss-active">
                <div>
                  <strong>{layerData.meta.title}</strong>
                  <small>{layerData.meta.count} Objekte im Ausschnitt · {layerData.meta.license}</small>
                </div>
                <div className="wiss-active-actions">
                  <a className="chip wiss-mini" href={feed(`/api/stadt/wfs?layer=${encodeURIComponent(layerData.meta.layer)}&lat=${center[1].toFixed(4)}&lon=${center[0].toFixed(4)}&r=3&limit=300`)} target="_blank" rel="noreferrer">GeoJSON</a>
                  <button type="button" className="chip wiss-mini" onClick={hideWissen}>Ausblenden</button>
                </div>
              </div>
            )}
            <Source disclosure>{katalog.data?.source ?? 'Landeshauptstadt Stuttgart, Stadtmessungsamt, Geoserver'} · Katalog: {katalog.data?.stand ?? '24 h Cache'}</Source>
          </Section>

          <Section title="Offene Daten im Katalog" aside="DCAT-AP">
            {dcat.data ? (
              <>
                <p className="wiss-small">{dcat.data.total} Datensätze zu Stuttgart im GovData-Katalog. {dcat.data.neu.length > 0 ? `${dcat.data.neu.length} davon sind seit dem letzten Lauf neu.` : 'Der Änderungsfeed ist auf dem aktuellen Stand.'}</p>
                <ul className="wiss-link-list">
                  {(dcat.data.neu.length ? dcat.data.neu : dcat.data.items).slice(0, 8).map((d) => (
                    <li key={d.id}><a href={d.url} target="_blank" rel="noreferrer">{d.title}<small>{[d.organization, d.modified ? fmtDay(d.modified) : null].filter(Boolean).join(' · ')}</small></a></li>
                  ))}
                </ul>
              </>
            ) : dcat.loading ? <SkeletonRows rows={3} /> : dcat.error ? <ErrorNote text={dcat.error} onRetry={dcat.reload} /> : null}
            <Source>{dcat.data?.source ?? 'GovData.de, CKAN-/DCAT-AP-Katalog'}</Source>
          </Section>

          <Section title="Open Data der Stadt" aside={ckan.data ? `${ckan.data.total} Datensätze` : undefined}>
            {ckan.data ? (
              <>
                <p className="wiss-small">
                  Der städtische CKAN-Katalog ist die lokale Ergänzung zu GovData: 140 Datensätze des Statistischen Amts und des Stadtmessungsamts,
                  überwiegend CC BY 4.0. {ckan.data.firstRun ? 'Der Ausgangsstand wurde gespeichert.' : ckan.data.neu.length > 0 ? `${ckan.data.neu.length} davon sind seit dem letzten Lauf neu.` : 'Der Änderungsfeed ist auf dem aktuellen Stand.'}
                </p>
                <label className="wiss-search">
                  <Icon name="search" size={17} />
                  <input value={ckanQ} onChange={(e) => setCkanQ(e.target.value)} placeholder="Datensätze durchsuchen, z. B. Wahl, Klima, Mieten" aria-label="Open-Data-Katalog durchsuchen" />
                </label>
                <ul className="wiss-link-list">
                  {ckanItems.slice(0, 8).map((d) => (
                    <li key={d.id}>
                      <a href={d.url} target="_blank" rel="noreferrer">
                        {d.title}
                        <small>{[d.organization, d.modified ? fmtDay(d.modified) : null, d.license].filter(Boolean).join(' · ')}</small>
                      </a>
                    </li>
                  ))}
                </ul>
                {ckanQ && ckanItems.length === 0 && <p className="muted small">Kein Datensatz gefunden.</p>}
                <a className="wiss-more" href="https://opendata.stuttgart.de/" target="_blank" rel="noreferrer">Alle Datensätze bei OpenData@Stuttgart <Icon name="external" size={14} /></a>
              </>
            ) : ckan.loading ? <SkeletonRows rows={3} /> : ckan.error ? <ErrorNote text={ckan.error} onRetry={ckan.reload} /> : null}
            <Source disclosure>{ckan.data?.source ?? 'Landeshauptstadt Stuttgart, OpenData@Stuttgart (CKAN)'} · {ckan.data?.hinweis}</Source>
          </Section>
        </div>
      )}

      {tab === 'zahlen' && (
        <div className="wiss-pane">
          <p className="wiss-lead">Amtliche Statistik nach Stadtbezirk und Stadtteil, monatlich fortgeschrieben. Die XLSX-Dateien enthalten die Zeitreihen.</p>
          <Section title="Kiez in Zahlen" aside={komunisStart ? `Position ${komunisStart}` : '16 Kategorien'}>
            <div className="wiss-crumbs">
              <button type="button" onClick={() => setPath([])} className={path.length === 0 ? 'is-current' : ''}>Alle</button>
              {path.map((p, i) => (
                <span key={p.position}>
                  <Icon name="chevron" size={12} />
                  <button type="button" onClick={() => setPath(path.slice(0, i + 1))} className={i === path.length - 1 ? 'is-current' : ''}>{p.title}</button>
                </span>
              ))}
            </div>
            {komunis.loading && !komunis.data && <SkeletonRows rows={5} />}
            {komunis.error && <ErrorNote text={komunis.error} onRetry={komunis.reload} />}
            <ul className="wiss-data-list">
              {(komunis.data?.entries ?? []).map((e) => (
                <li key={e.position}>
                  <div className="wiss-data-main">
                    <strong>{e.title}</strong>
                    <small>{[e.date, e.typ, e.leaf ? (e.typ ? null : 'Tabelle') : `${e.children} Unterpunkte`].filter(Boolean).join(' · ')}</small>
                  </div>
                  {e.leaf ? (
                    <div className="wiss-data-actions">
                      {docs[e.unid ?? '']?.xlsx?.length ? (
                        docs[e.unid ?? ''].xlsx.slice(0, 2).map((x, i) => (
                          <a key={x} className="chip wiss-mini" href={x} target="_blank" rel="noreferrer">XLSX{i ? ' 2' : ''}</a>
                        ))
                      ) : (
                        <button type="button" className="chip wiss-mini" onClick={() => void openDoc(e)} disabled={docBusy === e.unid}>
                          {docBusy === e.unid ? 'Lädt …' : 'Tabelle'}
                        </button>
                      )}
                      {e.url && <a className="chip wiss-mini" href={e.url} target="_blank" rel="noreferrer">Seite</a>}
                    </div>
                  ) : (
                    <button type="button" className="chip wiss-mini" onClick={() => setPath([...path, { position: e.position, title: e.title }])}>Öffnen</button>
                  )}
                </li>
              ))}
            </ul>
            {!komunis.loading && !komunis.data?.entries?.length && <p className="muted small">Keine Tabellen auf dieser Ebene.</p>}
            <Source disclosure>{komunis.data?.source ?? 'Landeshauptstadt Stuttgart, Statistisches Amt (KOMUNIS)'} · {komunis.data?.hinweis}</Source>
          </Section>
        </div>
      )}

      {tab === 'transparenz' && (
        <div className="wiss-pane">
          <p className="wiss-lead">Was die Stadt von sich aus veröffentlicht – und was Bürgerinnen und Bürger über Informationsfreiheit erfragen.</p>
          <Section title="IFG-Anfragen" aside={fds.data ? `${fds.data.total} Anfragen` : undefined}>
            <div className="wiss-chips">
              {([['alle', 'Alle'], ['offen', 'Offen'], ['beantwortet', 'Beantwortet']] as const).map(([id, label]) => (
                <button key={id} type="button" className={`chip wiss-mini ${fdsFilter === id ? 'on' : ''}`} onClick={() => setFdsFilter(id)}>{label}</button>
              ))}
            </div>
            {fds.loading && !fds.data && <SkeletonRows rows={4} />}
            {fds.error && <ErrorNote text={fds.error} onRetry={fds.reload} />}
            <ul className="wiss-data-list">
              {fdsItems.slice(0, 12).map((x) => (
                <li key={x.id}>
                  <div className="wiss-data-main">
                    <a href={x.url} target="_blank" rel="noreferrer"><strong>{x.title}</strong></a>
                    <small>{[x.statusLabel, fmtDay(x.lastMessage || x.created)].filter(Boolean).join(' · ')}</small>
                  </div>
                </li>
              ))}
            </ul>
            {fds.data?.portal && <a className="wiss-more" href={fds.data.portal} target="_blank" rel="noreferrer">Alle Anfragen bei FragDenStaat <Icon name="external" size={14} /></a>}
            <Source disclosure>{fds.data?.source ?? 'FragDenStaat'} · {fds.data?.hinweis}</Source>
          </Section>

          <Section title="Haushalt und Politik" aside="Transparenzportale">
            <ul className="wiss-link-list">
              <li><a href="https://offenerhaushalt.de/" target="_blank" rel="noreferrer">Offener Haushalt<small>Haushaltsdaten der Kommunen, Open Knowledge Foundation</small></a></li>
              <li><a href="https://transparenz-bw.de/" target="_blank" rel="noreferrer">Transparenzportal Baden-Württemberg<small>Landesrechnungshof und öffentliche Haushaltsdaten</small></a></li>
              <li><a href="https://oparl.org/" target="_blank" rel="noreferrer">OParl<small>Offener Standard für Ratsinformationssysteme; ALLRIS-Anfrage vorbereitet</small></a></li>
              <li><a href="https://www.stuttgart.de/service/gelbe-karte/" target="_blank" rel="noreferrer">Gelbe Karte Stuttgart<small>Ideen und Beschwerden im öffentlichen Raum; Open311-Anfrage vorbereitet</small></a></li>
              <li><a href="https://stuttgart-meine-stadt.de/participation" target="_blank" rel="noreferrer">Stuttgart – meine Stadt<small>Beteiligungsportal; API ist nicht für automatische Abrufe freigegeben</small></a></li>
            </ul>
            <Source>Die Beteiligungs-API wird bewusst nicht automatisch abgefragt (robots.txt). Die vorhandenen B-Plan- und Wahldaten stehen im Adressprofil.</Source>
          </Section>
        </div>
      )}

      {tab === 'fundstuecke' && (
        <div className="wiss-pane">
          <p className="wiss-lead">Offene Netze und versteckte Schnittstellen: Das StadtPalais veröffentlicht seine Termine als WordPress-REST, dazu kommen Lebensmittelteilen, Artenfunde und Lücken im Wissensgraphen.</p>

          <Section title="StadtPalais: Termine" aside={stadtpalais.data ? `${stadtpalais.data.events.length} in 21 Tagen` : undefined}>
            {stadtpalais.loading && !stadtpalais.data && <SkeletonRows rows={3} />}
            {stadtpalais.error && <ErrorNote text={stadtpalais.error} onRetry={stadtpalais.reload} />}
            {stadtpalais.data && (
              <>
                <p className="wiss-small">
                  Der AJAX-Endpunkt <code>/wp-admin/admin-ajax.php?action=events</code> filtert die Termine serverseitig nach Datum.
                  Übernommen werden nur Titel, Zeit, Ort, Kategorie und Link – keine Beschreibungen oder Bilder.
                </p>
                <ul className="wiss-data-list">
                  {stadtpalais.data.events.slice(0, 8).map((e) => (
                    <li key={`${e.id}-${e.date}`}>
                      <div className="wiss-data-main">
                        <a href={e.url} target="_blank" rel="noreferrer"><strong>{e.title}</strong></a>
                        <small>{[fmtDay(e.date), e.time, e.location, e.categories.slice(0, 2).join(', ')].filter(Boolean).join(' · ')}</small>
                      </div>
                    </li>
                  ))}
                </ul>
                {!stadtpalais.data.events.length && <p className="muted small">Keine Termine im Zeitfenster.</p>}
                <Source disclosure>{stadtpalais.data.source} · {stadtpalais.data.lizenz}</Source>
              </>
            )}
          </Section>

          <Section title="StadtPalais: Ausstellungen" aside={stadtpalais.data ? `${stadtpalais.data.exhibitions.length} laufend oder künftig` : undefined}>
            {stadtpalais.loading && !stadtpalais.data && <SkeletonRows rows={3} />}
            {stadtpalais.error && <ErrorNote text={stadtpalais.error} onRetry={stadtpalais.reload} />}
            {stadtpalais.data && (
              <>
                <ul className="wiss-data-list">
                  {stadtpalais.data.exhibitions.slice(0, 8).map((x) => (
                    <li key={x.id}>
                      <div className="wiss-data-main">
                        <a href={x.url} target="_blank" rel="noreferrer"><strong>{x.title}</strong></a>
                        <small>{[x.from ? `ab ${fmtDay(x.from)}` : null, x.to ? `bis ${fmtDay(x.to)}` : null, x.location, x.category].filter(Boolean).join(' · ')}</small>
                      </div>
                    </li>
                  ))}
                </ul>
                {!stadtpalais.data.exhibitions.length && <p className="muted small">Keine laufenden Ausstellungen gemeldet.</p>}
                <Source disclosure>{stadtpalais.data.source} · {stadtpalais.data.hinweis}</Source>
              </>
            )}
          </Section>

          <Section title="Fairteiler" aside={food.data ? `${food.data.points.length} Standorte` : undefined}>
            {food.loading && !food.data && <SkeletonRows rows={3} />}
            {food.error && <ErrorNote text={food.error} onRetry={food.reload} />}
            {food.data && (
              <>
                <p className="wiss-small">Öffentlich freigegebene Fairteiler in Stuttgart. Keine Live-Status- oder Korbdaten – die sind nur eingeloggt sichtbar.</p>
                <div className="wiss-chips">
                  <button type="button" className="chip wiss-mini on" onClick={() => showFc(food.data!.points, 'foodsharing', 'Fairteiler Stuttgart')}>Alle auf die Karte</button>
                </div>
                <ul className="wiss-data-list">
                  {food.data.points.slice(0, 8).map((p) => (
                    <li key={p.id}>
                      <div className="wiss-data-main"><strong>{p.name}</strong><small>{p.lat.toFixed(4)}, {p.lon.toFixed(4)}</small></div>
                      <div className="wiss-data-actions">
                        <button type="button" className="chip wiss-mini" onClick={() => { showFc([p], 'foodsharing', p.name); flyTo([p.lon, p.lat], 16); }}>Karte</button>
                        <a className="chip wiss-mini" href={p.url} target="_blank" rel="noreferrer">Info</a>
                      </div>
                    </li>
                  ))}
                </ul>
                <Source disclosure>{food.data.source} · {food.data.license}</Source>
              </>
            )}
          </Section>

          <Section title="Arten im Umkreis" aside={gbif.data ? `${gbif.data.total.toLocaleString('de-DE')} Funde` : undefined}>
            {gbif.loading && !gbif.data && <SkeletonRows rows={3} />}
            {gbif.error && <ErrorNote text={gbif.error} onRetry={gbif.reload} />}
            {gbif.data && (
              <>
                <div className="wiss-chips">
                  <button type="button" className="chip wiss-mini on" onClick={() => showFc(gbif.data!.items, 'gbif', 'Artenfunde (GBIF)')}>Alle auf die Karte</button>
                </div>
                <ul className="wiss-data-list">
                  {gbif.data.items.slice(0, 8).map((x) => (
                    <li key={x.id}>
                      <div className="wiss-data-main">
                        <a href={x.url ?? '#'} target="_blank" rel="noreferrer"><strong>{x.name}</strong></a>
                        <small>{[x.scientific !== x.name ? x.scientific : null, x.date, x.place].filter(Boolean).join(' · ')}</small>
                      </div>
                      <button type="button" className="chip wiss-mini" onClick={() => { showFc([x], 'gbif', x.name); flyTo([x.lon, x.lat], 16); }}>Karte</button>
                    </li>
                  ))}
                </ul>
                <Source disclosure>{gbif.data.source} · {gbif.data.license}</Source>
              </>
            )}
          </Section>

          <Section title="OSM-Hinweise" aside={osm.data ? `${osm.data.items.length} offen` : undefined}>
            {osm.loading && !osm.data && <SkeletonRows rows={3} />}
            {osm.error && <ErrorNote text={osm.error} onRetry={osm.reload} />}
            {osm.data && (
              <>
                <p className="wiss-small">Offene Hinweise der OSM-Community im Umkreis von zwei Kilometern. Lesen ist offen; zum Schreiben genügt ein kostenloses OSM-Konto.</p>
                <div className="wiss-chips">
                  <button type="button" className="chip wiss-mini on" onClick={() => showFc(osm.data!.items.map((x) => ({ id: x.id, name: x.text || `Hinweis ${x.id}`, lat: x.lat, lon: x.lon })), 'osm-notes', 'OSM-Hinweise')}>Alle auf die Karte</button>
                  <a className="chip wiss-mini" href={osm.data.newNote} target="_blank" rel="noreferrer">Neuen Hinweis schreiben</a>
                </div>
                <ul className="wiss-data-list">
                  {osm.data.items.slice(0, 6).map((x) => (
                    <li key={x.id}>
                      <div className="wiss-data-main">
                        <a href={x.url ?? '#'} target="_blank" rel="noreferrer"><strong>{x.text || `Hinweis ${x.id}`}</strong></a>
                        <small>{[fmtDay(x.date), x.comments > 1 ? `${x.comments} Kommentare` : null].filter(Boolean).join(' · ')}</small>
                      </div>
                      <button type="button" className="chip wiss-mini" onClick={() => { showFc([{ id: x.id, name: x.text, lat: x.lat, lon: x.lon }], 'osm-notes', 'OSM-Hinweis'); flyTo([x.lon, x.lat], 17); }}>Karte</button>
                    </li>
                  ))}
                </ul>
                <Source disclosure>{osm.data.source} · {osm.data.hinweis}</Source>
              </>
            )}
          </Section>

          <Section title="Was fehlt im Netz?" aside={wik.data ? `${wik.data.items.length} Orte` : undefined}>
            {wik.loading && !wik.data && <SkeletonRows rows={3} />}
            {wik.error && <ErrorNote text={wik.error} onRetry={wik.reload} />}
            {wik.data && (
              <>
                <p className="wiss-small">Orte in Stuttgart mit Wikidata-Koordinate, aber ohne verlinkten Wikipedia-Artikel. Ein Qualitätscheck für die Wissensbasis der Stadt – keine amtliche Liste.</p>
                <div className="wiss-chips">
                  <button type="button" className="chip wiss-mini on" onClick={() => showFc(wik.data!.items, 'wikidata', 'Wikidata-Lücken')}>Alle auf die Karte</button>
                </div>
                <ul className="wiss-data-list">
                  {wik.data.items.slice(0, 8).map((x) => (
                    <li key={x.id}>
                      <div className="wiss-data-main"><a href={x.url ?? '#'} target="_blank" rel="noreferrer"><strong>{x.name}</strong></a><small>{x.lat.toFixed(4)}, {x.lon.toFixed(4)}</small></div>
                      <button type="button" className="chip wiss-mini" onClick={() => { showFc([{ ...x, lat: x.lat, lon: x.lon }], 'wikidata', x.name); flyTo([x.lon, x.lat], 16); }}>Karte</button>
                    </li>
                  ))}
                </ul>
                <Source disclosure>{wik.data.source} · {wik.data.hinweis}</Source>
              </>
            )}
          </Section>

          <Section title="Bibliothek" aside={lib.data ? `${lib.data.total.toLocaleString('de-DE')} Treffer` : undefined}>
            <label className="wiss-search">
              <Icon name="search" size={17} />
              <input value={libQ} onChange={(e) => setLibQ(e.target.value)} placeholder="Bücher zur Stadtgeschichte, Vereine, Bauwerke" aria-label="Bibliothekskatalog durchsuchen" />
            </label>
            {lib.loading && !lib.data && <SkeletonRows rows={3} />}
            {lib.error && <ErrorNote text={lib.error} onRetry={lib.reload} />}
            <ul className="wiss-data-list">
              {(lib.data?.items ?? []).slice(0, 8).map((x) => (
                <li key={x.ppn}>
                  <div className="wiss-data-main">
                    <a href={x.url} target="_blank" rel="noreferrer"><strong>{x.title}</strong></a>
                    <small>{[x.author, x.year].filter(Boolean).join(' · ')}</small>
                  </div>
                </li>
              ))}
            </ul>
            <Source disclosure>{lib.data?.source ?? 'K10plus / Südwestdeutscher Bibliotheksverbund (SRU)'}</Source>
          </Section>
        </div>
      )}

      {tab === 'ausgabe' && (
        <div className="wiss-pane">
          <p className="wiss-lead">Jede Ansicht ist auch eine Schnittstelle: als Feed, als permanenter Link, als Schild zum Ausdrucken oder als Kiosk.</p>

          <Section title="Feeds und Exporte" aside="offen, ohne Key">
            <ul className="wiss-link-list">
              <li><a href={feed(layerFeed)} target="_blank" rel="noreferrer">GeoJSON · {activeTitle}<small>Aktueller Kartenausschnitt, WGS84, direkt weiterverarbeitbar</small></a></li>
              <li><a href={feed(layerRss)} target="_blank" rel="noreferrer">RSS · {activeTitle}<small>Änderungen und Objekte des Layers als Feed</small></a></li>
              <li><a href={feed('/api/wasgeht.ics')} target="_blank" rel="noreferrer">iCal · Was geht<small>Termine als Kalenderabo</small></a></li>
              <li><a href={feed('/api/stadtgedaechtnis.rss')} target="_blank" rel="noreferrer">RSS · Stadtgedächtnis<small>Neue Meldungen, Bekanntmachungen und OSM-Orte</small></a></li>
              <li><a href={feed('/api/stadt/fragdenstaat.rss')} target="_blank" rel="noreferrer">RSS · FragDenStaat<small>Neue IFG-Anfragen an die Stadt</small></a></li>
              <li><a href={feed('/api/archiv')} target="_blank" rel="noreferrer">CSV · Offenes Archiv<small>Besucherzahlen und Wartezeit-Stufen</small></a></li>
              <li><a href={feed('/api/stadt/wfs/katalog')} target="_blank" rel="noreferrer">JSON · WFS-Katalog<small>Alle Layer mit Workspace, BBox und Freigabestatus</small></a></li>
              <li><a href={feed('/api/stadt/ckan')} target="_blank" rel="noreferrer">JSON · Open Data der Stadt<small>140 Datensätze aus dem städtischen CKAN mit Download-Links</small></a></li>
              <li><a href={feed('/api/stadt/stadtpalais')} target="_blank" rel="noreferrer">JSON · StadtPalais<small>Termine der nächsten 21 Tage und laufende Ausstellungen</small></a></li>
            </ul>
          </Section>

          <Section title="Permanente Links und Teilen" aside="zitierfähig">
            <p className="wiss-small">Der aktuelle Kartenausschnitt steht in der Adresse. Objekte lassen sich über ihren Layer und ihre ID verlinken; die Detailansicht zeigt den Link beim Öffnen.</p>
            <div className="wiss-chips">
              <button type="button" className="chip wiss-mini" onClick={() => void copy(window.location.href)}>{copied ? 'Kopiert' : 'Link zu dieser Ansicht kopieren'}</button>
              <SpeakButton text={`Open Stuttgart. ${activeTitle}. ${layerData ? `${layerData.meta.count} Objekte im Ausschnitt.` : ''} Die Karte zeigt offene Daten der Landeshauptstadt Stuttgart.`} />
            </div>
            <div className="wiss-chips">
              <button type="button" className="chip wiss-mini" onClick={() => setPrint({ title: activeTitle, subtitle: 'Open Stuttgart · Stadt-Layer', url: window.location.href })}>Schild mit QR-Code drucken</button>
              <a className="chip wiss-mini" href={`https://www.openstreetmap.org/note/new#map=18/${center[1].toFixed(5)}/${center[0].toFixed(5)}`} target="_blank" rel="noreferrer">Problem auf OSM melden</a>
              <a className="chip wiss-mini" href={`${window.location.origin}${window.location.pathname}?display=kiosk`} target="_blank" rel="noreferrer">Kiosk-Modus öffnen</a>
            </div>
            <p className="wiss-small">Die OSM-Notiz öffnet den offiziellen Editor; ein kostenloses OSM-Konto genügt. Die Meldung verbessert alle Karten, nicht nur diese App.</p>
          </Section>

          <Section title="Standards und Schnittstellen" aside="Was schon läuft">
            <div className="wiss-standards">
              {[
                { group: 'Offene Standards', items: [
                  ['Open311 / Gelbe Karte', 'Anfrage vorbereitet, kein offener Endpunkt', 'link', 'https://www.stuttgart.de/service/gelbe-karte/'],
                  ['DCAT-AP / GovData', 'Katalog und Änderungsfeed integriert', 'live', 'https://www.govdata.de/'],
                  ['CAP', 'Warnungen über NINA/MoWaS, Polygone auf der Karte', 'live', 'https://www.dwd.de/'],
                  ['SensorThings / NGSI-LD', 'kein Stuttgarter Endpunkt bekannt', 'none', 'https://www.ogc.org/standards/sensorthings'],
                  ['OParl / ALLRIS', 'Anfrage vorbereitet, noch kein Feed', 'link', 'https://oparl.org/'],
                ] },
                { group: 'Physisch und zugänglich', items: [
                  ['QR-Schild / Deep Link', 'Druckfunktion mit QR-Code integriert', 'live', ''],
                  ['Kiosk-Modus', '?display=kiosk, rotierende Karten', 'live', ''],
                  ['TTS / Vorlesen', 'Web Speech API, ohne Cloud', 'live', ''],
                  ['Leichte Sprache', 'eigene Seite in der App', 'live', ''],
                ] },
                { group: 'Transparenz und Wissen', items: [
                  ['FragDenStaat', '285 Anfragen, lesend integriert', 'live', 'https://fragdenstaat.de/'],
                  ['OpenData@Stuttgart', '140 Datensätze über CKAN integriert', 'live', 'https://opendata.stuttgart.de/'],
                  ['WordPress REST / AJAX', 'StadtPalais-Termine und -Ausstellungen integriert', 'live', 'https://www.stadtpalais-stuttgart.de/'],
                  ['Offener Haushalt', 'Verweis, keine kommunale Maschinenschnittstelle', 'link', 'https://offenerhaushalt.de/'],
                  ['Wikidata SPARQL', 'Lückenabfrage integriert', 'live', 'https://query.wikidata.org/'],
                  ['GND / SRU', 'Endpunkt derzeit nicht erreichbar; Verweis', 'link', 'https://www.dnb.de/'],
                  ['DDB / Europeana', 'Key nötig, noch nicht angebunden', 'key', 'https://www.deutsche-digitale-bibliothek.de/'],
                ] },
                { group: 'Archiv und Ausgabe', items: [
                  ['IIIF', 'Viewer-Standard vorbereitet; freie Stuttgarter Manifeste fehlen', 'link', 'https://iiif.io/'],
                  ['SRU / OAI-PMH', 'K10plus-Suche integriert', 'live', 'https://kxp.k10plus.de/'],
                  ['RSS / iCal / GeoJSON', 'Feeds integriert', 'live', ''],
                  ['Web Push / ntfy', 'nicht eingerichtet, Kanal möglich', 'none', 'https://ntfy.sh/'],
                  ['ActivityPub', 'nicht eingerichtet, Bot-Konto möglich', 'none', 'https://www.w3.org/TR/activitypub/'],
                ] },
                { group: 'Bürger-Wissenschaft', items: [
                  ['OSM Notes', 'Meldelink integriert, Schreiben mit OSM-Konto', 'live', 'https://www.openstreetmap.org/'],
                  ['Foodsharing', '12 Fairteiler integriert', 'live', 'https://foodsharing.de/'],
                  ['GBIF', 'Artenfunde integriert', 'live', 'https://www.gbif.org/'],
                ] },
              ].map((g) => (
                <div key={g.group} className="wiss-standard-group">
                  <h4>{g.group}</h4>
                  {g.items.map(([name, note, status, url]) => (
                    <div key={name} className="wiss-standard">
                      <span className={`wiss-status is-${status}`}>{status === 'live' ? 'integriert' : status === 'key' ? 'Key nötig' : status === 'link' ? 'Verweis' : 'offen'}</span>
                      <span className="wiss-standard-main">
                        {url ? <a href={url} target="_blank" rel="noreferrer">{name}</a> : <strong>{name}</strong>}
                        <small>{note}</small>
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <Source disclosure>Recherchestand 22.10.2026. Technisch erreichbar ist nicht automatisch frei nutzbar; Layer außerhalb der Open-Data-Liste brauchen die Freigabe des Stadtmessungsamts.</Source>
          </Section>

          <Section title="3D-Stadtmodell" aside="nur Deep-Link">
            <p className="wiss-small">Das offizielle 3D-Stadtmodell ist ausdrücklich nicht Open Data. Deshalb gibt es keinen Tile-Import, sondern nur den Weg zum amtlichen Viewer.</p>
            <a className="chip wiss-mini" href="https://3d.stuttgart.de/" target="_blank" rel="noreferrer">Stuttgart 3D öffnen <Icon name="external" size={13} /></a>
          </Section>
        </div>
      )}

      {print && <PrintSign title={print.title} subtitle={print.subtitle} url={print.url} onClose={() => setPrint(null)} />}
    </div>
  );
}
