// "Meine Adresse": was für einen Ort gilt, auf einer Seite. Angaben aus /api/adresse/profil,
// Bürgerbüro-Wartezeit, Grundschulbezirk, Haltestellen und Parkhäuser in Gehweite.
import { useMemo, useState } from 'react';
import { usePolling } from '../../lib/api';
import { useData } from '../../lib/data';
import { distM, nearestStops, walkMin, within } from '../../lib/geo';
import { fmtNum } from '../../lib/format';
import { Explain } from '../../lib/info';
import { useStops } from '../../lib/stops';
import type { Facility, Selection } from '../../lib/types';
import { Icon } from '../../components/Icon';
import { LineBadge } from '../../components/LineBadge';
import { ErrorNote, Section } from '../../components/ui';

type Wahllokal = { name: string; address: string; lat: number | null; lon: number | null; lage: string; zugang: string; tuer: string; lift: string; barrierefrei: string; stand: string };
type Fac = Facility & { dist: number };
export type Verwaltung = { id?: string; name: string; lat: number; lon: number; address?: string; web?: string; booking?: string; hours?: string; services?: { name: string; url?: string; online?: boolean }[]; dist: number };
export type Profil = {
  wahl: { bezirk: string; briefwahlbezirk: string; stadtbezirk: string; landtagswahlkreis: string | null; bundestagswahlkreis: string | null; stand: string; lokal: Wahllokal | null } | null | { error: string };
  starkregen: { flaechen: { szenario: string; betroffen: boolean }[]; fliessweg: number | null; hq100?: { betroffen: boolean; imUmkreis100m: boolean } } | { error: string };
  laerm: { strasse: Laerm | null; schiene: Laerm | null } | { error: string };
  waermeplanung?: { quartier: string | null; gebietsbezeichnung: string | null; potenziale: string | null; beginnLeitungsbau: string | null; leitungslaengeKm: string | null; wohnungen: number | null; verbrauchsdichte: number | null; hauptenergietraeger: string | null; steckbrief: string | null; steckbriefUrl: string | null } | null;
  gruendach?: { adresse: string | null; dachtyp: string | null; flaecheM2: number | null; bestandGruendachM2: number | null; eignung: string | null; url: string | null } | null;
  solar?: { adresse: string | null; flaecheM2: number | null; pvKwp: number | null; stromKwhA: number | null; solarthermieKwhA: number | null; co2Tonnen: number | null; hauptgebaeude: boolean } | null;
  geothermie?: { elevMin: number | null; elevMax: number | null; tiefeText: string | null; randbedingung: string | null } | null;
  abwasserwaerme?: { geeignetesGebiet: boolean; naechsteHaltungM: number | null; eignung: string | null; waermeentzugsleistungKw: string | null } | null;
  wohnlage?: { lage: string | null; stand: string | null } | null;
  milieuschutz?: { aktiv: boolean; name: string | null } | null;
  satzungen?: { baumschutz: { aktiv: boolean; zone: string | null }; denkmalschutz: { aktiv: boolean; name: string | null }; sanierungsgebiet: { aktiv: boolean; name: string | null } } | null;
  jod?: { imBezirk: boolean; ausgabestelle: { name: string; address: string | null; dist: number; imBezirk: boolean } | null; hinweis: string } | null;
  bewohnerparken?: string | null;
  escooter?: { abstellverbotszone: boolean; naechsteAbstellflaeche: { name: string; dist: number } | null } | null;
  schulwege?: { radschulwegDistM: number | null; achtungsstellen: { dist: number; hinweis: string }[]; gehschulweg: { schule: string | null; beschreibung: string | null; url: string | null } | null } | null;
  klima?: { klimatop: string | null; beschreibung: string | null; kaltluftwind: boolean; luftleitbahn: string | null } | null;
  baeume?: { anzahl150m: number; topArten: { art: string; anzahl: number }[]; aeltesterBaum: { pflanzjahr: number; art: string } | null; pollenBaeume: Record<string, number>; jungeBaeume150m?: number; naturdenkmaeler?: number } | null;
  notfall: Fac | null; leuchtturm: Fac | null; kuehl: Fac[]; trinkbrunnen: Fac | null; toilette: Fac | null;
  verwaltung: Verwaltung[] | null;
  source: string;
};
type Laerm = { lden: number; ln: number | null; gebaeude: string; adresse: string | null };
export type BbItem = { id: number; label: string; text: string; status: number; lat?: number; lon?: number; name?: string; address?: string; booking?: string; url: string; notes: string[]; usual?: { value: number; n: number } | null };

type Plan = { id: string; nummer: string; name: string; jahr: number | null; amOrt: boolean; abstand: number; karte: string | null; dokumente: Record<string, string | undefined> };
type Plaene = { plaene: Plan[]; auslegung: { derzeitKeine: boolean; verfahren: { titel: string; dokumente: { titel?: string; url: string }[] }[]; seite: string } | null; source: string };
type Wahl = { available: boolean; wahl?: { titel: string; stimme: string }; ergebnis?: { wahlbeteiligung: number; parteien: { partei: string; anteil: number }[] }; stadt?: { wahlbeteiligung: number }; hinweis?: string };
type Maengel = { url: string; angaben: { text: string }; hinweis: string };

const fmtDist = (m: number) => (m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toLocaleString('de-DE', { maximumFractionDigits: 1 })} km`);
const hasErr = (x: unknown): x is { error: string } => !!x && typeof x === 'object' && 'error' in x;
const laermStufe = (lden: number) => (lden >= 70 ? 'sehr hoch' : lden >= 65 ? 'hoch' : lden >= 55 ? 'mittel' : 'gering');

export function MyAddress({ lngLat, street, nr, label, bb, select, flyTo }: {
  lngLat: [number, number]; street?: string | null; nr?: string | null; label: string; bb: BbItem[];
  select: (s: Selection) => void; flyTo: (c: [number, number], z?: number) => void;
}) {
  const [lon, lat] = lngLat;
  const qs = `lat=${lat.toFixed(5)}&lon=${lon.toFixed(5)}${street && nr ? `&street=${encodeURIComponent(street)}&nr=${encodeURIComponent(nr)}` : ''}`;
  const p = usePolling<Profil>(`/api/adresse/profil?${qs}`, 6 * 3600_000);
  const schule = usePolling<{ school: string | null; stand?: string; facility?: Facility | null }>(`/api/nearby/schulbezirk?lat=${lat}&lon=${lon}`, 24 * 3600_000);
  const stops = useStops();
  const { parking, unfaelle } = useData();
  const near = useMemo(() => nearestStops(stops, [lon, lat], 3, 800), [stops, lon, lat]);
  const parks = useMemo(() => within(parking.data?.sites ?? [], [lon, lat], 700).slice(0, 3), [parking.data, lon, lat]);
  const bbNext = useMemo(() => bb.filter((b) => b.lat != null).map((b) => ({ b, d: distM([lon, lat], [b.lon!, b.lat!]) })).sort((a, b) => a.d - b.d)[0] ?? null, [bb, lon, lat]);
  const unfallNear = useMemo(() => (unfaelle.data?.items ?? [])
    .map((u) => ({ ...u, d: distM([lon, lat], [u.lon, u.lat]) }))
    .filter((u) => u.d <= 300)
    .sort((a, b) => a.d - b.d), [unfaelle.data, lon, lat]);
  const open = (f: Facility) => { select({ type: 'facility', item: f }); flyTo([f.lon, f.lat], 16); };
  const d = p.data;
  const plaene = usePolling<Plaene>(`/api/beteiligung/bebauungsplaene?lat=${lat.toFixed(5)}&lon=${lon.toFixed(5)}&r=150`, 24 * 3600_000);
  const bezirk = d && !hasErr(d.wahl) ? d.wahl?.stadtbezirk : null;
  const wahlErg = usePolling<Wahl>(bezirk ? `/api/beteiligung/wahlen?stadtbezirk=${encodeURIComponent(bezirk)}` : null, 24 * 3600_000);
  const maengel = usePolling<Maengel>(`/api/partner/maengel?lat=${lat.toFixed(6)}&lon=${lon.toFixed(6)}${street && nr ? `&adresse=${encodeURIComponent(`${street} ${nr}`)}` : ''}`, 24 * 3600_000);
  const [copied, setCopied] = useState(false);
  const wahl = d && !hasErr(d.wahl) ? d.wahl : null;

  const row = (f: Facility & { dist?: number }, sub?: string) => (
    <li key={f.id}>
      <button type="button" onClick={() => open(f)}>
        <span className="walk"><Icon name="walk" size={16} /><strong>{walkMin(f.dist ?? distM([lon, lat], [f.lon, f.lat]))}</strong><small>min</small></span>
        <span className="near-main">
          <span className="near-name">{f.name}</span>
          <span className="near-sub">{sub ?? [fmtDist(f.dist ?? 0), f.address].filter(Boolean).join(' · ')}</span>
        </span>
        <Icon name="chevron" size={16} className="muted" />
      </button>
    </li>
  );

  return (
    <div className="my-address" aria-label={`Angaben für ${label}`}>
      {p.error && !d && <ErrorNote text="Angaben der Stadt für diesen Ort derzeit nicht abrufbar." onRetry={p.reload} />}
      {!d && !p.error && <span className="skeleton block" style={{ height: 220 }} />}

      <Section title="Zuständig für diesen Ort">
        <dl className="facts addr-facts">
          {wahl && <div><dt>Stadtbezirk</dt><dd>{wahl.stadtbezirk}</dd></div>}
          {schule.data?.school && (
            <div><dt>Grundschule <Explain id="schulbezirk" /></dt><dd>
              {schule.data.facility
                ? <button type="button" className="link-quiet" onClick={() => open(schule.data!.facility!)}>{schule.data.school}</button>
                : schule.data.school}
              {schule.data.facility && <span className="muted"> · {fmtDist(distM([lon, lat], [schule.data.facility.lon, schule.data.facility.lat]))}</span>}
              {d?.schulwege && (d.schulwege.radschulwegDistM != null || d.schulwege.achtungsstellen.length > 0 || d.schulwege.gehschulweg?.beschreibung) && (
                <span className="block muted small">
                  {d.schulwege.radschulwegDistM != null ? `Radschulweg in ${d.schulwege.radschulwegDistM} m. ` : ''}
                  {d.schulwege.achtungsstellen.length > 0 ? `Achtungsstelle (${d.schulwege.achtungsstellen[0].dist} m): ${d.schulwege.achtungsstellen[0].hinweis}. ` : ''}
                  {d.schulwege.gehschulweg?.beschreibung ? `Gehschulweg: ${d.schulwege.gehschulweg.beschreibung}` : ''}
                </span>
              )}
            </dd></div>
          )}
          {wahl && (
            <div><dt>Wahllokal <Explain id="wahl" /></dt><dd>
              {wahl.lokal ? (
                <>
                  {wahl.lokal.lat != null
                    ? <button type="button" className="link-quiet" onClick={() => open({ id: `wl-${wahl.bezirk}`, cat: 'wahllokal', name: wahl.lokal!.name, lat: wahl.lokal!.lat!, lon: wahl.lokal!.lon!, address: wahl.lokal!.address, info: [`Wahlbezirk ${wahl.bezirk}`, wahl.lokal!.lage, wahl.lokal!.zugang, wahl.lokal!.lift, wahl.lokal!.barrierefrei].filter(Boolean) })}>{wahl.lokal.name}</button>
                    : wahl.lokal.name}
                  <span className="muted">, {wahl.lokal.address}</span>
                  <span className={`a11y-tag ${/^rollstuhlgeeignet/.test(wahl.lokal.barrierefrei) ? 'ok' : 'no'}`}>{wahl.lokal.barrierefrei}</span>
                </>
              ) : 'nicht angegeben'}
              <span className="block muted small">Wahlbezirk {wahl.bezirk}, Briefwahlbezirk {wahl.briefwahlbezirk}. Maßgeblich ist die Wahlbenachrichtigung.</span>
            </dd></div>
          )}
          {wahl?.landtagswahlkreis && <div><dt>Wahlkreise</dt><dd>Landtag {wahl.landtagswahlkreis}; Bundestag {wahl.bundestagswahlkreis}</dd></div>}
          {bbNext && (
            <div><dt>Bürgerbüro <Explain id="buergerbuero" /></dt><dd>
              <button type="button" className="link-quiet" onClick={() => open({ id: `bb-${bbNext.b.id}`, cat: 'buergerbuero', name: bbNext.b.name ?? `Bürgerbüro ${bbNext.b.label}`, lat: bbNext.b.lat!, lon: bbNext.b.lon!, address: bbNext.b.address, booking: bbNext.b.booking, web: bbNext.b.url, info: bbNext.b.notes, live: bbNext.b.text })}>
                {bbNext.b.name ?? `Bürgerbüro ${bbNext.b.label}`}</button>
              <span className="muted"> · {fmtDist(bbNext.d)}</span>
              <span className="block small">{bbNext.b.text}. <a href="https://stuttgart.konsentas.de/" target="_blank" rel="noreferrer">Termin vereinbaren</a></span>
            </dd></div>
          )}
          {(d?.wohnlage?.lage || d?.milieuschutz?.aktiv || d?.satzungen) && (
            <div><dt>Wohnlage & Satzung</dt><dd>
              {d.wohnlage?.lage ? `Mietspiegel-Wohnlage: ${d.wohnlage.lage}${d.wohnlage.stand ? ` (Stand ${d.wohnlage.stand})` : ''}` : ''}
              {d.milieuschutz?.aktiv && <span className="block small">Soziale Erhaltungssatzung (Milieuschutz): {d.milieuschutz.name}</span>}
              {d.satzungen?.baumschutz?.aktiv && <span className="block small">Baumschutzsatzung: {d.satzungen.baumschutz.zone ?? 'Baumschutzgebiet'} – Fällungen sind anzeigepflichtig.</span>}
              {d.satzungen?.denkmalschutz?.aktiv && <span className="block small">Denkmalschutz (Erhaltungssatzung Gesamtanlage): {d.satzungen.denkmalschutz.name}</span>}
              {d.satzungen?.sanierungsgebiet?.aktiv && <span className="block small">Sanierungsgebiet: {d.satzungen.sanierungsgebiet.name} – Anzeige- und Genehmigungspflichten beachten.</span>}
            </dd></div>
          )}
          {(d?.bewohnerparken || d?.escooter) && (
            <div><dt>Parken & Abstellen</dt><dd>
              {d.bewohnerparken ? `Bewohnerparkgebiet ${d.bewohnerparken}. ` : ''}
              {d.escooter?.abstellverbotszone ? 'E-Scooter-Abstellverbotszone (Abstellen nur auf ausgewiesenen Flächen). ' : ''}
              {d.escooter?.naechsteAbstellflaeche && <span className="muted small">Nächste E-Scooter-Abstellfläche: {d.escooter.naechsteAbstellflaeche.name} ({d.escooter.naechsteAbstellflaeche.dist} m).</span>}
            </dd></div>
          )}
        </dl>
        {d?.verwaltung && d.verwaltung.length > 0 && (
          <>
            <h4 className="sub-head">Ämter und Dienststellen in der Nähe</h4>
            <ul className="near-list">
              {d.verwaltung.slice(0, 4).map((v) => row(
                { id: `verw-${v.id ?? v.name}`, cat: 'verwaltung', name: v.name, lat: v.lat, lon: v.lon, address: v.address, web: v.web, booking: v.booking, hours: v.hours,
                  info: (v.services ?? []).slice(0, 6).map((s) => `${s.name}${s.online ? ' (online)' : ''}`), dist: v.dist } as Facility & { dist: number },
                [fmtDist(v.dist), v.address, v.services?.length ? `${v.services.length} Leistungen` : null].filter(Boolean).join(' · '),
              ))}
            </ul>
          </>
        )}
      </Section>

      {d && (
        <Section title="Vorsorge">
          <dl className="facts addr-facts">
            {!hasErr(d.starkregen) && (
              <div><dt>Starkregen & Hochwasser <Explain id="starkregen" /></dt><dd>
                {(() => {
                  const hit = d.starkregen.flaechen.find((f) => f.betroffen);
                  return hit
                    ? <>Liegt in der berechneten Überflutungsfläche bei {hit.szenario}{d.starkregen.flaechen.filter((f) => f.betroffen).length > 1 ? ' und stärkeren Ereignissen' : ''}.</>
                    : <>Liegt in keiner berechneten Starkregen-Überflutungsfläche.</>;
                })()}
                {d.starkregen.fliessweg != null && <span className="block small muted">Nächster Fließweg mit erhöhter Gefahr: etwa {d.starkregen.fliessweg} m.</span>}
                {d.starkregen.hq100 && (
                  <span className="block small muted">
                    Hochwassergefahrenkarte (HQ100): {d.starkregen.hq100.betroffen ? 'innerhalb des hundertjährlichen Überschwemmungsgebiets' : d.starkregen.hq100.imUmkreis100m ? 'Überschwemmungsgebiet im Umkreis von 100 m' : 'nicht im HQ100-Überschwemmungsgebiet'}.
                  </span>
                )}
              </dd></div>
            )}
            {!hasErr(d.laerm) && (d.laerm.strasse || d.laerm.schiene) && (
              <div><dt>Lärm <Explain id="laerm" /></dt><dd>
                {d.laerm.strasse && <span className="block">Straße: {d.laerm.strasse.lden.toLocaleString('de-DE')} dB(A) ganztags, {d.laerm.strasse.ln?.toLocaleString('de-DE')} dB(A) nachts ({laermStufe(d.laerm.strasse.lden)})</span>}
                {d.laerm.schiene && <span className="block">Schiene: {d.laerm.schiene.lden.toLocaleString('de-DE')} dB(A) ganztags, {d.laerm.schiene.ln?.toLocaleString('de-DE')} dB(A) nachts ({laermStufe(d.laerm.schiene.lden)})</span>}
                <span className="block small muted">{(d.laerm.strasse ?? d.laerm.schiene)!.gebaeude}, Lärmkartierung 2022.</span>
              </dd></div>
            )}
            {d.notfall && (
              <div><dt>Notfall-Treffpunkt <Explain id="notfall" /></dt><dd>
                <button type="button" className="link-quiet" onClick={() => open(d.notfall!)}>{d.notfall.name}</button>
                <span className="muted"> · {fmtDist(d.notfall.dist)}</span>
                {d.leuchtturm && <span className="block small muted">Nächster Leuchtturm mit Notstrom: {d.leuchtturm.name}, {fmtDist(d.leuchtturm.dist)}</span>}
              </dd></div>
            )}
            {unfallNear.length > 0 && (
              <div><dt>Verkehrsunfälle <Explain id="unfall" /></dt><dd>
                <strong>{unfallNear.length}</strong> {unfallNear.length === 1 ? 'Unfall' : 'Unfälle'} mit Personenschaden im Umkreis von 300 m
                {unfallNear.filter((u) => u.rad).length ? `, davon ${unfallNear.filter((u) => u.rad).length} mit Rad` : ''}
                {unfallNear.filter((u) => u.fuss).length ? ` und ${unfallNear.filter((u) => u.fuss).length} mit Fuß` : ''}.
                {unfallNear[0] && (
                  <span className="block small muted">
                    Nächster: {unfallNear[0].kategorie === 1 ? 'tödlicher' : unfallNear[0].kategorie === 2 ? 'schwerer' : 'leichter'} Unfall
                    {' '}{fmtDist(unfallNear[0].d)} entfernt
                    {unfallNear[0].jahr ? ` (${unfallNear[0].jahr})` : ''}.
                    {' '}<button type="button" className="link-quiet small" onClick={() => flyTo([unfallNear[0].lon, unfallNear[0].lat], 17)}>Auf der Karte zeigen</button>
                  </span>
                )}
              </dd></div>
            )}
            {d.jod && (
              <div><dt>Jodprophylaxe <Explain id="jod" /></dt><dd>
                {d.jod.imBezirk ? 'Der Ort liegt in einem Jodausgabebezirk.' : 'Der Ort liegt außerhalb der erfassten Jodausgabebezirke.'}
                {d.jod.ausgabestelle && (
                  <span className="block small muted">
                    Nächste Ausgabestelle: {d.jod.ausgabestelle.name}{d.jod.ausgabestelle.address ? `, ${d.jod.ausgabestelle.address}` : ''} ({fmtDist(d.jod.ausgabestelle.dist)})
                  </span>
                )}
              </dd></div>
            )}
          </dl>
        </Section>
      )}

      {d && (d.waermeplanung || d.gruendach || d.geothermie || d.klima || d.baeume) && (
        <Section title="Wärmeplanung, Dach, Stadtklima und Bäume" explain="waermeplanung">
          <dl className="facts addr-facts">
            {d.waermeplanung && (d.waermeplanung.gebietsbezeichnung || d.waermeplanung.quartier || d.waermeplanung.hauptenergietraeger) && (
              <div><dt>Wärmeplanung</dt><dd>
                {[d.waermeplanung.gebietsbezeichnung, d.waermeplanung.quartier ? `Quartier ${d.waermeplanung.quartier}` : null].filter(Boolean).join(', ')}
                {d.waermeplanung.beginnLeitungsbau && d.waermeplanung.beginnLeitungsbau !== '-' && <span className="block small">Angestrebter Leitungsbau: {d.waermeplanung.beginnLeitungsbau}</span>}
                {d.waermeplanung.potenziale && <span className="block small muted">Potenziale: {d.waermeplanung.potenziale}</span>}
                {d.waermeplanung.verbrauchsdichte != null && <span className="block small muted">Wärmeverbrauchsdichte im Baublock: rund {d.waermeplanung.verbrauchsdichte.toLocaleString('de-DE')} kWh/(m²·a)</span>}
                {d.waermeplanung.hauptenergietraeger && <span className="block small muted">Hauptenergieträger im Bestand: {d.waermeplanung.hauptenergietraeger}</span>}
                {d.waermeplanung.steckbriefUrl && <span className="block small"><a href={d.waermeplanung.steckbriefUrl} target="_blank" rel="noreferrer">Quartiers-Steckbrief{d.waermeplanung.steckbrief ? ` (${d.waermeplanung.steckbrief})` : ''} (PDF)</a></span>}
              </dd></div>
            )}
            {d.solar && (d.solar.pvKwp != null || d.solar.flaecheM2 != null) && (
              <div><dt>Solarkataster <Explain id="solar" /></dt><dd>
                {d.solar.flaecheM2 != null ? `Geeignete Dachfläche: rund ${d.solar.flaecheM2.toLocaleString('de-DE')} m²` : 'Solarpotenzial erfasst'}
                {d.solar.pvKwp != null ? ` · bis zu ${d.solar.pvKwp.toLocaleString('de-DE')} kWp` : ''}
                {d.solar.stromKwhA != null && <span className="block small">Möglicher Stromertrag: rund {fmtNum(d.solar.stromKwhA)} kWh im Jahr</span>}
                {d.solar.solarthermieKwhA != null && <span className="block small muted">Solarthermie: rund {fmtNum(d.solar.solarthermieKwhA)} kWh im Jahr</span>}
                {d.solar.co2Tonnen != null && <span className="block small muted">CO₂-Ersparnis bei Nutzung: rund {d.solar.co2Tonnen.toLocaleString('de-DE')} Tonnen im Jahr</span>}
                <span className="block small muted">Berechnung des Städtischen Solarkatasters für {d.solar.adresse ?? 'dieses Gebäude'}, ohne Berücksichtigung von Verschattung und Statik.</span>
              </dd></div>
            )}
            {d.gruendach && (d.gruendach.eignung || d.gruendach.dachtyp) && (
              <div><dt>Gründachkataster</dt><dd>
                {[d.gruendach.eignung, d.gruendach.dachtyp, d.gruendach.flaecheM2 ? `${d.gruendach.flaecheM2} m² Dachfläche` : null].filter(Boolean).join(' · ')}
                {d.gruendach.bestandGruendachM2 ? <span className="block small muted">Bereits begrünt: ca. {d.gruendach.bestandGruendachM2} m²</span> : null}
                {d.gruendach.url && <span className="block small"><a href={d.gruendach.url} target="_blank" rel="noreferrer">Berechnung im Gründachkataster öffnen</a></span>}
              </dd></div>
            )}
            {d.geothermie && (d.geothermie.tiefeText || d.geothermie.randbedingung) && (
              <div><dt>Geothermie</dt><dd>
                {d.geothermie.tiefeText ? `Zulässige Bohrtiefe: ${d.geothermie.tiefeText}` : ''}
                {d.geothermie.randbedingung && <span className="block small muted">{d.geothermie.randbedingung}</span>}
              </dd></div>
            )}
            {d.abwasserwaerme && (
              <div><dt>Abwasserwärme <Explain id="abwasserwaerme" /></dt><dd>
                {d.abwasserwaerme.geeignetesGebiet ? 'Das Grundstück liegt in einem für Wärmeentzug aus Abwasser geeigneten Gebiet.' : 'Kein geeignetes Gebiet für Wärmeentzug aus Abwasser erfasst.'}
                {d.abwasserwaerme.naechsteHaltungM != null && <span className="block small muted">Nächste geeignete Kanalhaltung: etwa {d.abwasserwaerme.naechsteHaltungM} m entfernt{d.abwasserwaerme.eignung ? `, Eignung: ${d.abwasserwaerme.eignung}` : ''}{d.abwasserwaerme.waermeentzugsleistungKw ? `, Wärmeentzugsleistung: ${d.abwasserwaerme.waermeentzugsleistungKw} kW` : ''}.</span>}
              </dd></div>
            )}
            {d.klima && (d.klima.klimatop || d.klima.luftleitbahn || d.klima.kaltluftwind) && (
              <div><dt>Klimaatlas</dt><dd>
                {[d.klima.klimatop, d.klima.luftleitbahn, d.klima.kaltluftwind ? 'Kaltluftströmung nachgewiesen' : null].filter(Boolean).join(' · ')}
                {d.klima.beschreibung && <span className="block small muted">{d.klima.beschreibung}</span>}
              </dd></div>
            )}
            {d.baeume && d.baeume.anzahl150m > 0 && (
              <div><dt>Baumkataster (150 m)</dt><dd>
                <strong>{d.baeume.anzahl150m}</strong> städtische Bäume im Umkreis ({d.baeume.topArten.map((a) => `${a.anzahl}× ${a.art}`).join(', ')}).
                {d.baeume.aeltesterBaum && <span className="block small muted">Ältester erfasster Baum: {d.baeume.aeltesterBaum.art}, gepflanzt {d.baeume.aeltesterBaum.pflanzjahr}.</span>}
                {!!d.baeume.jungeBaeume150m && <span className="block small muted">Junge Bäume (seit 2020 gepflanzt): {d.baeume.jungeBaeume150m} – in Trockenperioden gießen hilft.</span>}
                {!!d.baeume.naturdenkmaeler && <span className="block small muted">Naturdenkmäler im Umkreis: {d.baeume.naturdenkmaeler}</span>}
                {(() => {
                  const pol = Object.entries(d.baeume.pollenBaeume).filter(([, n]) => n > 0);
                  return pol.length > 0 ? <span className="block small muted">Allergene Gattungen im Umkreis: {pol.map(([k, n]) => `${n}× ${k}`).join(', ')}.</span> : null;
                })()}
              </dd></div>
            )}
          </dl>
        </Section>
      )}

      {d && <GiessRadar lat={lat} lon={lon} />}

      <Section title="Planung und Beteiligung" explain="beteiligung">
        {plaene.data && (() => {
          const am = plaene.data.plaene.filter((x) => x.amOrt).sort((a, b) => (b.jahr ?? 0) - (a.jahr ?? 0));
          return (
            <>
              <p className="small">{am.length ? `${am.length} rechtskräftige Bebauungspläne gelten an diesem Ort, der neueste von ${am[0].jahr ?? 'unbekanntem Jahr'}.` : 'An diesem Ort gilt kein Bebauungsplan aus dem städtischen Verzeichnis.'}</p>
              <ul className="plan-list">
                {am.slice(0, 4).map((x) => (
                  <li key={x.id}>
                    <span><strong>{x.name}</strong> <span className="muted">({x.nummer}{x.jahr ? `, ${x.jahr}` : ''})</span></span>
                    <span className="plan-links">
                      {x.dokumente.plan && <a href={x.dokumente.plan} target="_blank" rel="noreferrer">Plan</a>}
                      {x.dokumente.textteil && <a href={x.dokumente.textteil} target="_blank" rel="noreferrer">Textteil</a>}
                      {x.karte && <a href={x.karte} target="_blank" rel="noreferrer">Karte</a>}
                    </span>
                  </li>
                ))}
              </ul>
              {plaene.data.auslegung && (
                <p className="small">
                  {plaene.data.auslegung.derzeitKeine
                    ? 'Öffentliche Auslegung: derzeit liegt kein Bebauungsplanentwurf der Stadt aus.'
                    : `Öffentliche Auslegung: ${plaene.data.auslegung.verfahren.length} Verfahren, ${plaene.data.auslegung.verfahren.slice(0, 3).map((v) => v.titel).join('; ')}.`}{' '}
                  <a href={plaene.data.auslegung.seite} target="_blank" rel="noreferrer">Planauslage</a>
                </p>
              )}
            </>
          );
        })()}
        {wahlErg.data?.available && wahlErg.data.ergebnis && (
          <p className="small">
            {wahlErg.data.wahl?.titel} im Stadtbezirk {bezirk} ({wahlErg.data.wahl?.stimme}): Wahlbeteiligung {wahlErg.data.ergebnis.wahlbeteiligung.toLocaleString('de-DE')} %
            {wahlErg.data.stadt ? ` (Stadt ${wahlErg.data.stadt.wahlbeteiligung.toLocaleString('de-DE')} %)` : ''}.{' '}
            {wahlErg.data.ergebnis.parteien.slice(0, 5).map((x) => `${x.partei} ${x.anteil.toLocaleString('de-DE')} %`).join(', ')}.
          </p>
        )}
        <p className="small">
          Beteiligungsverfahren: <a href="https://stuttgart-meine-stadt.de/participation" target="_blank" rel="noreferrer">Beteiligungsportal der Stadt</a>
          {' · '}<a href="https://www.stuttgart.de/rathaus/amtliche-bekanntmachungen/" target="_blank" rel="noreferrer">Amtliche Bekanntmachungen</a>
        </p>
        {maengel.data && (
          <div className="row-actions">
            <a className="chip" href={maengel.data.url} target="_blank" rel="noreferrer"><Icon name="warn" size={16} /> Mangel melden (Gelbe Karte)</a>
            <button type="button" className="link-quiet small" onClick={() => { navigator.clipboard?.writeText(maengel.data!.angaben.text).then(() => setCopied(true), () => {}); }}>
              {copied ? 'Ortsangabe kopiert' : 'Ortsangabe kopieren'}
            </button>
          </div>
        )}
        {maengel.data && <p className="muted small">{maengel.data.hinweis}</p>}
      </Section>

      <Section title="In Gehweite">
        <ul className="near-list">
          {near.map(({ stop, walk }) => {
            const c = stop.geometry.coordinates as [number, number];
            return (
              <li key={stop.properties.id}>
                <button type="button" onClick={() => { select({ type: 'stop', id: stop.properties.id, name: stop.properties.name, lngLat: c, lines: stop.properties.lines }); flyTo(c, 15.5); }}>
                  <span className="walk"><Icon name="walk" size={16} /><strong>{walk}</strong><small>min</small></span>
                  <span className="near-main">
                    <span className="near-name">{stop.properties.name}</span>
                    <span className="near-lines">{stop.properties.lines.slice(0, 7).map((l) => <LineBadge key={l} line={l} size="sm" />)}</span>
                  </span>
                  <Icon name="chevron" size={16} className="muted" />
                </button>
              </li>
            );
          })}
          {parks.map(({ item: pk, dist }) => (
            <li key={pk.id}>
              <button type="button" onClick={() => { select({ type: 'parking', id: pk.id }); flyTo([pk.lon, pk.lat], 15.5); }}>
                <span className="walk"><Icon name="walk" size={16} /><strong>{walkMin(dist)}</strong><small>min</small></span>
                <span className="near-main">
                  <span className="near-name">{pk.name}</span>
                  <span className="near-sub">{pk.free != null ? `${pk.free} Plätze frei` : 'Belegung nicht gemeldet'} · {fmtDist(dist)}</span>
                </span>
                <Icon name="chevron" size={16} className="muted" />
              </button>
            </li>
          ))}
          {d?.kuehl.slice(0, 2).map((k) => row(k, [fmtDist(k.dist), 'kühler Ort', ...(k.info ?? []).slice(0, 2)].join(' · ')))}
          {d?.trinkbrunnen && row(d.trinkbrunnen, `${fmtDist(d.trinkbrunnen.dist)} · Trinkbrunnen`)}
          {d?.toilette && row(d.toilette, [fmtDist(d.toilette.dist), 'Toilette', d.toilette.hours].filter(Boolean).join(' · '))}
        </ul>
      </Section>
    </div>
  );
}

type Giess = {
  jungeBaeume: { anzahl: number; anzahl200m: number; topArten: { art: string; anzahl: number }[]; items: { art: string; bot: string | null; pflanzjahr: number; dist: number }[] };
  regen: { summe7tage: number; tage: { date: string; mm: number }[]; trockeneTage: number; letzterRegen: string | null; trockenheitTage: number | null } | null;
  brunnen: { name: string; standort: string | null; anlagenart: string | null; dist: number; lat: number; lon: number } | null;
  hinweis: string;
};

/** Gieß-Radar: junge Bäume, Niederschlagsbilanz der letzten sieben Tage und nächster Wasserbrunnen */
function GiessRadar({ lat, lon }: { lat: number; lon: number }) {
  const g = usePolling<Giess>(`/api/giess?lat=${lat.toFixed(5)}&lon=${lon.toFixed(5)}`, 6 * 3600_000);
  const d = g.data;
  if (!d || (!d.jungeBaeume.anzahl && !d.regen)) return null;
  const datum = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'numeric' });
  return (
    <Section title="Gieß-Radar für junge Bäume" explain="giess">
      <dl className="facts addr-facts">
        {d.jungeBaeume.anzahl > 0 && (
          <div><dt>Junge Bäume (400 m) <Explain id="giess" /></dt><dd>
            <strong>{d.jungeBaeume.anzahl}</strong> {d.jungeBaeume.anzahl === 1 ? 'Baum' : 'Bäume'}, gepflanzt seit 2020
            {d.jungeBaeume.topArten.length ? ` (${d.jungeBaeume.topArten.map((a) => `${a.anzahl}× ${a.art}`).join(', ')})` : ''}
            <span className="block small muted">Flache Wurzeln, hoher Wasserbedarf: bei Trockenheit zusätzlich gießen.</span>
          </dd></div>
        )}
        {d.regen && (
          <div><dt>Niederschlag (7 Tage)</dt><dd>
            {d.regen.summe7tage.toLocaleString('de-DE')} mm, {d.regen.trockeneTage} {d.regen.trockeneTage === 1 ? 'Tag' : 'Tage'} ohne nennenswerten Regen
            {d.regen.letzterRegen && <span className="block small muted">Zuletzt geregnet: {datum(d.regen.letzterRegen)}{d.regen.trockenheitTage != null ? ` – seit ${d.regen.trockenheitTage} Tagen trocken` : ''}</span>}
          </dd></div>
        )}
        {d.brunnen && (
          <div><dt>Wasserbrunnen <Explain id="brunnen" /></dt><dd>
            {d.brunnen.name}{d.brunnen.standort ? `, ${d.brunnen.standort}` : ''} ({fmtDist(d.brunnen.dist)})
            <span className="block small muted">{d.brunnen.anlagenart ?? 'Brunnen'} – Wasser zum Gießen entnehmen, sofern der Brunnen nicht als Trinkbrunnen ausgewiesen ist.</span>
          </dd></div>
        )}
      </dl>
      {d.hinweis && <p className="small">{d.hinweis}</p>}
    </Section>
  );
}
