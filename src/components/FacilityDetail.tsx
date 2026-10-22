import type { Facility, Selection } from '../lib/types';
import { CAT_LABEL } from '../modules/nearby/cats';
import { GettingThere } from './CultureDetails';
import { SheetHead } from './Details';
import { GebaeudeDetail } from './VerwaltungDetail';
import { Icon } from './Icon';
import { Source } from './ui';
import { NaturHinweis } from './Natur';
import { ohLines, openState } from '../lib/openingHours';

const OSM_TYPE: Record<string, string> = { n: 'node', w: 'way', r: 'relation' };

type Nav = { select: (s: Selection) => void; flyTo: (c: [number, number], z?: number) => void };

export function FacilityDetail({ f, onClose, select, flyTo }: Nav & { f: Facility; onClose: () => void }) {
  if (f.id.startsWith('verw-') || f.cat.startsWith('verwaltung')) {
    return <GebaeudeDetail id={f.id.replace(/^verw-/, '')} onClose={onClose} select={select} flyTo={flyTo} />;
  }
  return (
    <div className="sheet-inner">
      <SheetHead eyebrow={CAT_LABEL[f.cat] ?? 'Einrichtung'} title={f.name} onClose={onClose}>
        {f.live && <p className="head-sub"><strong>{f.live}</strong></p>}
      </SheetHead>
      <div className="sheet-body">
        {f.address && (
          <div className="where">
            <Icon name="pin" size={20} />
            <div><strong>{f.address}</strong>{f.closed && <span className="small warn-text">Derzeit gesperrt</span>}</div>
          </div>
        )}
        {f.info && f.info.length > 0 && <ul className="fac-info">{f.info.map((i) => <li key={i}>{i}</li>)}</ul>}
        {f.hours && f.osm && (() => {
          const st = openState(f.hours);
          return (
            <>
              {st && <p className={`open-state ${st.open ? 'is-open' : ''}`}>{st.text}</p>}
              <dl className="facts">{ohLines(f.hours).map(([d, t], i) => <div key={i}><dt>{d}</dt><dd>{t}</dd></div>)}</dl>
            </>
          );
        })()}
        {f.hours && !f.osm && (
          <dl className="facts">
            {f.hours.split('\n').map((l) => { const [d, ...t] = l.split(':'); return <div key={l}><dt>{d}</dt><dd>{t.join(':').trim()}</dd></div>; })}
          </dl>
        )}
        {(f.phone || f.email) && (
          <dl className="facts">
            {f.phone && <div><dt>Telefon</dt><dd><a href={`tel:${f.phone.replace(/[^\d+]/g, '')}`}>{f.phone}</a></dd></div>}
            {f.email && <div><dt>E-Mail</dt><dd><a href={`mailto:${f.email}`}>{f.email}</a></dd></div>}
          </dl>
        )}
        {f.booking && <a className="link-btn" href={f.booking} target="_blank" rel="noreferrer">Termin vereinbaren <Icon name="external" size={16} /></a>}
        {f.web && <a className="link-btn secondary" href={f.web} target="_blank" rel="noreferrer">Seite der Einrichtung <Icon name="external" size={16} /></a>}
        <NaturHinweis f={f} />
        <GettingThere lngLat={[f.lon, f.lat]} select={select} flyTo={flyTo} label={f.name} />
        {f.osm && (
          <p className="small muted">
            Angaben aus OpenStreetMap, nicht amtlich. Öffnungszeiten bitte beim Betrieb prüfen.{' '}
            <a href={`https://www.openstreetmap.org/${OSM_TYPE[f.osm[0]] ?? 'node'}/${f.osm.slice(1)}`} target="_blank" rel="noreferrer">Eintrag ansehen</a>{' · '}
            <a href={`https://www.openstreetmap.org/note/new#map=19/${f.lat}/${f.lon}`} target="_blank" rel="noreferrer">Fehler melden</a>
          </p>
        )}
        <Source>{f.cat === 'laden' ? 'MobiData BW, OCPDB.' : f.osm ? '© OpenStreetMap-Mitwirkende (ODbL).' : 'Landeshauptstadt Stuttgart, Geodaten (CC BY 4.0).'} Fahrplan EFA-BW.</Source>
      </div>
    </div>
  );
}
