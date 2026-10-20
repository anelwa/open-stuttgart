// Seiten über die Anwendung: Grundsätze, Erklärung jedes Werts, Barrierefreiheit, Leichte Sprache,
// offene Daten und Schnittstellen, die Daten der Stadt oder von Partnern brauchen.
import { useEffect, useRef } from 'react';
import { usePolling } from '../lib/api';
import { ERKLAERUNGEN, type Erklaerung } from '../lib/erklaerungen';
import type { InfoPage } from '../lib/info';
import { Icon } from './Icon';
import { tr, useLang } from '../lib/i18n';

const REPO = 'https://github.com/anelwa/open-stuttgart';

const TABS: { id: InfoPage; label: string }[] = [
  { id: 'grundsaetze', label: 'Grundsätze' },
  { id: 'werte', label: 'Wie entstehen die Werte?' },
  { id: 'daten', label: 'Offene Daten' },
  { id: 'stadt', label: 'Daten der Stadt' },
  { id: 'barrierefreiheit', label: 'Barrierefreiheit' },
  { id: 'leicht', label: 'Leichte Sprache' },
];

export function InfoPages({ page, anchor, onPage, onClose }: { page: InfoPage; anchor?: string; onPage: (p: InfoPage) => void; onClose: () => void }) {
  const lang = useLang();
  const ref = useRef<HTMLDivElement>(null);
  const prev = useRef<Element | null>(null);
  useEffect(() => {
    prev.current = document.activeElement;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    window.addEventListener('keydown', onKey, true);
    return () => { window.removeEventListener('keydown', onKey, true); (prev.current as HTMLElement | null)?.focus?.(); };
  }, [onClose]);
  useEffect(() => {
    if (!anchor) { ref.current?.querySelector('.info-body')?.scrollTo(0, 0); return; }
    const el = document.getElementById(`wert-${anchor}`);
    if (el) { el.scrollIntoView({ block: 'start' }); el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 1600); }
  }, [page, anchor]);

  return (
    <div className="info-backdrop" onClick={onClose}>
      <div className="info-dialog" role="dialog" aria-modal="true" aria-labelledby="info-title" tabIndex={-1} ref={ref} onClick={(e) => e.stopPropagation()}>
        <header className="info-head">
          <div>
            <span className="eyebrow">{tr('Über Open Stuttgart')}</span>
            <h2 id="info-title">{tr(TABS.find((t) => t.id === page)?.label ?? '')}</h2>
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Schließen"><Icon name="close" /></button>
        </header>
        <nav className="info-tabs" aria-label="Seiten">
          {TABS.map((t) => (
            <button key={t.id} type="button" aria-current={t.id === page ? 'page' : undefined} className={t.id === page ? 'active' : ''} onClick={() => onPage(t.id)}>{tr(t.label)}</button>
          ))}
        </nav>
        <div className="info-body">
          {page === 'grundsaetze' && (lang === 'en' ? <PrinciplesEn /> : <Grundsaetze />)}
          {page === 'werte' && <Werte />}
          {page === 'daten' && <OffeneDaten />}
          {page === 'stadt' && <DatenDerStadt />}
          {page === 'barrierefreiheit' && <Barrierefreiheit />}
          {page === 'leicht' && <LeichteSprache />}
        </div>
      </div>
    </div>
  );
}

function Grundsaetze() {
  return (
    <div className="prose">
      <p>
        Open Stuttgart zeigt Daten der Landeshauptstadt Stuttgart und ihrer Partner auf einer Karte. Die Anwendung ergänzt
        Navigations-Apps: Sie zeigt, was die Stadt weiß. Für den Weg dorthin kann jederzeit die gewohnte Navigations-App
        geöffnet werden.
      </p>
      <h3>Grundsätze</h3>
      <ol>
        <li><strong>Kein Konto.</strong> Alle Funktionen sind ohne Anmeldung nutzbar.</li>
        <li><strong>Keine Werbung, keine bezahlte Reihenfolge.</strong> Anbieter, Betreiber und Veranstalter werden nach sachlichen Merkmalen (Entfernung, Zeit) geordnet, nie gegen Geld oder Kooperation hervorgehoben.</li>
        <li><strong>Kein Tracking.</strong> Es gibt keine Analysewerkzeuge, keine Cookies von Dritten und kein Nutzungsprofil. Der Server speichert keine Standorte.</li>
        <li><strong>Standort und Adresse bleiben auf dem Gerät.</strong> Der eigene Standort wird nur nach Freigabe im Browser und nur für die jeweilige Abfrage verwendet. Eine eingegebene Adresse wird lokal im Browser gespeichert und kann jederzeit gelöscht werden.</li>
        <li><strong>Quelle an jeder Angabe.</strong> Jede Ansicht nennt ihre Quelle. Zu jedem Wert gibt es eine Erklärung, wie er entsteht, wie oft er abgefragt wird und wo seine Grenzen liegen.</li>
        <li><strong>Eigene Einschätzungen sind gekennzeichnet.</strong> Berechnungen der Anwendung (z. B. Luftaustausch, „üblich um diese Zeit“, Alternativen bei Ausfall) sind als Einschätzung oder Schätzung bezeichnet und ersetzen keine amtliche Auskunft.</li>
        <li><strong>Rücksicht auf die Quellen.</strong> Jede Quelle wird höchstens so oft gefragt, wie es fachlich nötig ist, für alle Nutzer gemeinsam.</li>
        <li><strong>Offen.</strong> Der Programmcode steht unter der EUPL-1.2. Eigene Aufzeichnungen (z. B. Besucherzahlen der Bäder im Zeitverlauf) stehen als offene Daten zum Herunterladen bereit.</li>
        <li><strong>Bewusst nicht enthalten:</strong> eigene Navigation mit Ansage, Verkehrslage aus Nutzerdaten, Bewertungen, Nutzerfotos und Einträge von Geschäften gegen Entgelt.</li>
      </ol>
      <h3>Datenschutz</h3>
      <p>
        Beim Aufruf der Seite verarbeitet der Server technisch notwendige Angaben (IP-Adresse, Zeitpunkt, angefragte Adresse
        der Schnittstelle) nur zur Auslieferung und speichert sie nicht in einem Protokoll. Anfragen an Datenquellen stellt
        der Server; der Browser verbindet sich nicht direkt mit den Quellen. Ausnahmen sind die Kartenkacheln (OpenFreeMap)
        und das Höhenmodell (Mapzen Terrain Tiles auf Amazon Web Services), die der Browser direkt lädt.
      </p>
      <h3>Mitwirken</h3>
      <p>Fehler und Vorschläge bitte über die <a href={`${REPO}/issues`} target="_blank" rel="noreferrer">Fehlermeldungen im Projektarchiv</a> melden. Der Programmcode ist unter <a href={REPO} target="_blank" rel="noreferrer">{REPO.replace('https://', '')}</a> einsehbar.</p>
    </div>
  );
}

function PrinciplesEn() {
  return (
    <div className="prose" lang="en">
      <p>
        Open Stuttgart shows data from the City of Stuttgart and its partners on one map. It complements navigation apps by showing
        what the city knows; for directions you can open your usual navigation app at any time. Data from the sources (event texts,
        stop names, operator notices) are shown in their original language, mostly German.
      </p>
      <h3>Principles</h3>
      <ol>
        <li><strong>No account.</strong> Everything works without signing in.</li>
        <li><strong>No advertising, no paid ranking.</strong> Providers and organisers are ordered by objective criteria such as distance and time.</li>
        <li><strong>No tracking.</strong> No analytics, no third-party cookies, no user profiles. The server does not store locations.</li>
        <li><strong>Your location and address stay on your device.</strong> Your location is only used for the current request after you allow it in the browser; an address you enter is stored locally in your browser.</li>
        <li><strong>A source for every value.</strong> Each view names its source, and each value has an explanation of how it is produced, how often it is fetched and where its limits are.</li>
        <li><strong>Own estimates are labelled.</strong> Calculations by the application (air exchange, "usual at this time", alternatives on cancellations) are marked as estimates and do not replace official information.</li>
        <li><strong>Considerate use of sources.</strong> Each source is requested only as often as necessary, shared by all users.</li>
        <li><strong>Open.</strong> The code is licensed under the EUPL-1.2; our own recordings are available as open data.</li>
      </ol>
      <p>Bug reports and suggestions: <a href={`${REPO}/issues`} target="_blank" rel="noreferrer">issue tracker</a>.</p>
    </div>
  );
}

function WertKarte({ id, e }: { id: string; e: Erklaerung }) {
  return (
    <article className="wert" id={`wert-${id}`}>
      <h4>{e.titel}</h4>
      <p>{e.was}</p>
      <dl className="facts compact">
        <div><dt>Quelle</dt><dd>{e.quelle}</dd></div>
        <div><dt>Abruf</dt><dd>{e.intervall}</dd></div>
        <div><dt>Grenzen</dt><dd>{e.grenzen}</dd></div>
        <div><dt>Lizenz</dt><dd>{e.lizenz}</dd></div>
      </dl>
    </article>
  );
}

function Werte() {
  const groups = [...new Set(Object.values(ERKLAERUNGEN).map((e) => e.gruppe))];
  return (
    <div className="prose">
      <p>Für jeden Wert in der Anwendung: was er aussagt, woher er stammt, wie oft er abgefragt wird, wo seine Grenzen liegen und unter welcher Lizenz er steht. Das Zeichen <Icon name="info" size={14} /> neben einem Wert führt direkt zum passenden Abschnitt.</p>
      {groups.map((g) => (
        <section key={g}>
          <h3>{g}</h3>
          {Object.entries(ERKLAERUNGEN).filter(([, e]) => e.gruppe === g).map(([id, e]) => <WertKarte key={id} id={id} e={e} />)}
        </section>
      ))}
    </div>
  );
}

const API = [
  ['/api/departures?stop=de:08111:6118', 'Abfahrten einer Haltestelle'],
  ['/api/parking', 'Parkhäuser mit freien Plätzen'],
  ['/api/nearby/baeder', 'Besucherzahlen der Bäder mit „üblich um diese Zeit“'],
  ['/api/nearby/buergerbueros', 'Wartezeiten der Bürgerbüros mit „üblich um diese Zeit“'],
  ['/api/nearby/facilities?cat=spielplatz', 'Einrichtungen einer Kategorie'],
  ['/api/adresse/profil?lat=48.7744&lon=9.1773', 'Angaben für einen Ort (Wahlbezirk, Starkregen, Lärm …)'],
  ['/api/events', 'Termine des Tages'],
  ['/api/archiv', 'Liste der Tagesdateien des Archivs'],
];

function OffeneDaten() {
  const a = usePolling<{ days: string[]; format: string; lizenz: string }>('/api/archiv', 10 * 60_000);
  return (
    <div className="prose">
      <h3>Archiv „Stadt im Zeitverlauf“</h3>
      <p>
        Die Anwendung zeichnet Live-Werte städtischer Einrichtungen alle 5 Minuten auf und legt sie als Tagesdatei ab.
        Daraus entstehen „üblich um diese Zeit“ und die Angabe der besten Zeit. Die Dateien stehen frei zum Herunterladen
        und können in das Open-Data-Portal der Stadt übernommen werden.
      </p>
      {a.data && (
        <>
          <p className="small muted">{a.data.format}. {a.data.lizenz}.</p>
          <ul className="archiv-list">
            {a.data.days.slice().reverse().map((d) => (
              <li key={d}><a href={`/api/archiv/${d}.csv`} download>{new Date(`${d}T12:00:00`).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })}</a></li>
            ))}
          </ul>
          {!a.data.days.length && <p className="small muted">Noch keine Aufzeichnung vorhanden.</p>}
        </>
      )}
      <h3>Schnittstellen dieser Anwendung</h3>
      <p>Alle Ansichten beruhen auf einfachen JSON-Schnittstellen des eigenen Servers. Sie können für eigene Auswertungen genutzt werden; es gelten die Lizenzen der jeweiligen Quellen.</p>
      <ul className="api-list">
        {API.map(([p, t]) => <li key={p}><a href={p} target="_blank" rel="noreferrer"><code>{p}</code></a><span>{t}</span></li>)}
      </ul>
    </div>
  );
}

type Partner = { id: string; titel: string; beschreibung: string; benoetigt: string; status: 'vorbereitet' | 'aktiv' };
function DatenDerStadt() {
  const p = usePolling<{ eintraege: Partner[] }>('/api/partner', 3600_000);
  return (
    <div className="prose">
      <p>
        Einige Angaben würden den Nutzen deutlich erhöhen, liegen aber nicht offen vor. Die Anwendung hat dafür
        Schnittstellen vorbereitet. Sobald die Stadt oder ein Partner die Daten bereitstellt, genügt ein Eintrag in der
        Konfiguration des Servers.
      </p>
      {p.error && !p.data && <p className="small muted">Übersicht derzeit nicht abrufbar.</p>}
      {(p.data?.eintraege ?? []).map((x) => (
        <article className="wert" key={x.id}>
          <h4>{x.titel} <span className={`badge ${x.status === 'aktiv' ? 'ok' : ''}`}>{x.status === 'aktiv' ? 'angebunden' : 'vorbereitet'}</span></h4>
          <p>{x.beschreibung}</p>
          <dl className="facts compact"><div><dt>Benötigt</dt><dd>{x.benoetigt}</dd></div></dl>
        </article>
      ))}
    </div>
  );
}

function Barrierefreiheit() {
  return (
    <div className="prose">
      <h3>Erklärung zur Barrierefreiheit</h3>
      <p>
        Open Stuttgart soll nach der Barrierefreie-Informationstechnik-Verordnung (BITV 2.0) und der Norm EN 301 549
        zugänglich sein. Diese Erklärung beruht auf einer Selbstbewertung; eine Prüfung durch eine unabhängige Stelle
        steht aus.
      </p>
      <p><strong>Stand der Vereinbarkeit:</strong> teilweise vereinbar.</p>
      <h4>Umgesetzt</h4>
      <ul>
        <li>Alle Inhalte der Karte stehen auch als Liste in den Themenbereichen zur Verfügung (Haltestellen, Termine, Einrichtungen, Parkhäuser).</li>
        <li>Bedienung mit der Tastatur: Tab-Taste für alle Bedienelemente, „Zum Inhalt springen“ am Seitenanfang, Escape schließt Detailansichten. Die Karte lässt sich nach Anwahl mit den Pfeiltasten verschieben und mit Plus und Minus zoomen.</li>
        <li>Bedienelemente tragen Beschriftungen für Bildschirmleser; Live-Bereiche werden angesagt.</li>
        <li>Helle und dunkle Ansicht; reduzierte Bewegung wird berücksichtigt, wenn das Betriebssystem es vorgibt.</li>
        <li>Farbige Zustände (Wartezeit, Auslastung, Luftqualität) sind zusätzlich als Text angegeben.</li>
        <li>Kurztexte in Leichter Sprache für die häufigsten Fragen.</li>
      </ul>
      <h4>Noch nicht barrierefrei</h4>
      <ul>
        <li>Die Kartenebenen selbst (Linien, Flächen, Radarbild, Schattenkarte) sind für Bildschirmleser nicht zugänglich; die Angaben stehen aber in den Listen.</li>
        <li>Einige Farbkontraste auf der Karte erreichen nicht in jeder Zoomstufe das Verhältnis 4,5:1.</li>
        <li>Inhalte der Quellen (Termintexte, Hinweise der Verkehrsunternehmen) werden unverändert übernommen und sind nicht in Leichter Sprache.</li>
        <li>Gebärdensprachvideos fehlen.</li>
      </ul>
      <h4>Barriere melden</h4>
      <p>
        Wenn Ihnen Barrieren auffallen oder Sie Inhalte in anderer Form benötigen, melden Sie das bitte über die
        <a href={`${REPO}/issues/new?labels=barrierefreiheit&title=Barriere:%20`} target="_blank" rel="noreferrer"> Fehlermeldung „Barriere“</a> im Projektarchiv.
        Eine Kontaktadresse ohne Konto wird ergänzt, sobald die Stadt die Zuständigkeit festgelegt hat.
      </p>
      <h4>Durchsetzungsverfahren</h4>
      <p>
        Für öffentliche Stellen in Baden-Württemberg gibt es ein Durchsetzungsverfahren bei der Beauftragten der
        Landesregierung für die Belange von Menschen mit Behinderungen. Ob und wie es für diese Anwendung gilt, wird mit
        der Stadt geklärt; bis dahin ist diese Angabe vorläufig.
      </p>
    </div>
  );
}

function LeichteSprache() {
  return (
    <div className="prose leicht">
      <h3>Was ist Open Stuttgart?</h3>
      <p>Open Stuttgart ist eine Karte von Stuttgart.</p>
      <p>Auf der Karte stehen Informationen von der Stadt.</p>
      <p>Zum Beispiel: Wann fährt die nächste Bahn? Wo ist das Bürger-Büro? Wann wird der Müll abgeholt?</p>
      <h3>Brauche ich ein Konto?</h3>
      <p>Nein. Sie brauchen kein Konto. Sie müssen sich nicht anmelden.</p>
      <h3>Wie finde ich Informationen zu meiner Adresse?</h3>
      <p>Wählen Sie oben den Bereich „Nähe“.</p>
      <p>Schreiben Sie Ihre Adresse in das Feld. Zum Beispiel: Eberhard-Straße 10.</p>
      <p>Dann sehen Sie:</p>
      <ul>
        <li>Wo Sie wählen gehen.</li>
        <li>Welche Grund-Schule für Ihr Kind zuständig ist.</li>
        <li>Wann der Müll abgeholt wird.</li>
        <li>Wo das nächste Bürger-Büro ist. Und wie lange man dort wartet.</li>
      </ul>
      <p>Ihre Adresse bleibt auf Ihrem Gerät. Wir speichern Ihre Adresse nicht.</p>
      <h3>Wie komme ich mit Bus und Bahn hin?</h3>
      <p>Tippen Sie auf einen Ort. Dann tippen Sie auf „Verbindung suchen“.</p>
      <p>Wenn Sie keine Treppen nehmen können: Wählen Sie „stufenlos“.</p>
      <h3>Woher kommen die Informationen?</h3>
      <p>Die Informationen kommen von der Stadt Stuttgart und von anderen Stellen.</p>
      <p>Unter jeder Information steht, woher sie kommt.</p>
    </div>
  );
}
