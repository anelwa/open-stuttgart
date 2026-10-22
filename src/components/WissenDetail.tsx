import { useState } from 'react';
import type { Selection } from '../lib/types';
import { SheetHead } from './Details';
import { Icon } from './Icon';
import { RouteButtons } from './RouteButtons';
import { SpeakButton } from './SpeakButton';
import { PrintSign } from './PrintSign';

export function objectUrl(sel: Selection): string {
  const u = new URL(window.location.href);
  u.searchParams.delete('stop');
  if (sel.type === 'wissen') {
    u.searchParams.set('o', 'wissen');
    u.searchParams.set('layer', sel.layer);
    u.searchParams.set('lt', sel.layerTitle);
    u.searchParams.set('name', sel.name);
    u.searchParams.set('id', sel.id);
    u.searchParams.set('lat', sel.lngLat[1].toFixed(6));
    u.searchParams.set('lon', sel.lngLat[0].toFixed(6));
  } else if (sel.type === 'stop') {
    u.searchParams.set('stop', sel.id);
  } else if (sel.type === 'parking') {
    u.searchParams.set('o', 'parking'); u.searchParams.set('id', String(sel.id));
  } else if (sel.type === 'roadwork') {
    u.searchParams.set('o', 'roadwork'); u.searchParams.set('id', sel.id);
  } else if (sel.type === 'place') {
    u.searchParams.set('o', 'place'); u.searchParams.set('id', sel.id);
  } else if (sel.type === 'air') {
    u.searchParams.set('o', 'air'); u.searchParams.set('id', sel.id);
  } else if (sel.type === 'sharing') {
    u.searchParams.set('o', 'sharing'); u.searchParams.set('id', sel.id);
  } else if (sel.type === 'water') {
    u.searchParams.set('o', 'water');
  } else if (sel.type === 'event') {
    u.searchParams.set('o', 'event'); u.searchParams.set('id', sel.id);
  } else if (sel.type === 'facility') {
    u.searchParams.set('o', 'facility'); u.searchParams.set('cat', sel.item.cat); u.searchParams.set('id', sel.item.id);
  } else if (sel.type === 'verwaltung_gebaeude') {
    u.searchParams.set('o', 'verwaltung_gebaeude'); u.searchParams.set('id', sel.id);
    if (sel.lngLat) { u.searchParams.set('lat', String(sel.lngLat[1])); u.searchParams.set('lon', String(sel.lngLat[0])); }
  } else if (sel.type === 'verwaltung_leistung') {
    u.searchParams.set('o', 'leistung'); u.searchParams.set('url', sel.url);
    if (sel.lat != null && sel.lon != null) { u.searchParams.set('lat', String(sel.lat)); u.searchParams.set('lon', String(sel.lon)); }
  } else {
    u.searchParams.delete('o'); u.searchParams.delete('layer'); u.searchParams.delete('id');
  }
  return u.toString();
}

const LABEL: Record<string, string> = {
  NAME: 'Name', STRASSE: 'Straße', HAUSNR: 'Hausnummer', PLZ: 'PLZ', ORT: 'Ort', STADTTEIL: 'Stadtteil',
  STADTBEZIRK: 'Stadtbezirk', BEMERKUNG: 'Bemerkung', BESCHREIBUNG: 'Beschreibung', TITEL: 'Titel',
  JAHR: 'Jahr', DATUM: 'Datum', URL: 'Link', WEBLINK: 'Link', TELEFON: 'Telefon', EMAIL: 'E-Mail',
};
const label = (k: string) => LABEL[k] ?? k.replace(/_/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase());

export function WissenDetail({ sel, onClose }: { sel: Extract<Selection, { type: 'wissen' }>; onClose: () => void }) {
  const [print, setPrint] = useState(false);
  const [copied, setCopied] = useState(false);
  const url = objectUrl(sel);
  const entries = Object.entries(sel.props).filter(([k, v]) => !k.startsWith('_') && v != null && String(v).trim() !== '').slice(0, 24);
  const speak = `${sel.name}. ${sel.layerTitle}. ${entries.slice(0, 8).map(([k, v]) => `${label(k)}: ${String(v)}`).join('. ')}`;

  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* egal */ }
  };

  return (
    <div className="sheet-inner">
      <SheetHead eyebrow={sel.layerTitle || 'Stadt-Layer'} title={sel.name || 'Objekt'} onClose={onClose}>
        <div className="wiss-detail-actions">
          <SpeakButton text={speak} compact />
          <button type="button" className="chip wiss-mini" onClick={() => void copy()}>{copied ? 'Kopiert' : 'Link kopieren'}</button>
          <button type="button" className="chip wiss-mini" onClick={() => setPrint(true)}>Schild</button>
        </div>
      </SheetHead>
      <div className="sheet-body">
        {entries.length > 0 ? (
          <dl className="facts wiss-facts">
            {entries.map(([k, v]) => (
              <div key={k}>
                <dt>{label(k)}</dt>
                <dd>{typeof v === 'object' ? <code>{JSON.stringify(v)}</code> : String(v)}</dd>
              </div>
            ))}
          </dl>
        ) : <p className="muted">Dieser Datensatz enthält keine weiteren Angaben.</p>}

        <RouteButtons to={{ lat: sel.lngLat[1], lon: sel.lngLat[0], label: sel.name }} />

        <div className="row-actions">
          <a className="link-btn secondary" href={`https://www.openstreetmap.org/note/new#map=18/${sel.lngLat[1].toFixed(5)}/${sel.lngLat[0].toFixed(5)}`} target="_blank" rel="noreferrer">
            <Icon name="pin" size={15} /> Problem auf OSM melden
          </a>
          <a className="link-btn secondary" href={`https://geoserver.stuttgart.de/geoserver/ows?service=WFS&version=2.0.0&request=GetFeature&typeNames=${encodeURIComponent(sel.layer)}&count=1&outputFormat=application/json&srsName=EPSG:4326`} target="_blank" rel="noreferrer">
            <Icon name="external" size={15} /> Rohdaten
          </a>
        </div>

        <p className="source"><Icon name="info" size={14} /> {sel.layer} · Datenquelle: Landeshauptstadt Stuttgart, Stadtmessungsamt (Geoserver). Bitte Lizenz des Layers beachten.</p>
      </div>
      {print && <PrintSign title={sel.name} subtitle={sel.layerTitle} url={url} onClose={() => setPrint(false)} />}
    </div>
  );
}
