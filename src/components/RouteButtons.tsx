// "Verbindung suchen" und Übergabe an Navigations-Apps, für jede Detailansicht.
import { handoffLinks, usePlanRoute, type Place } from '../lib/routeCtx';
import { Icon } from './Icon';

export function RouteButtons({ to }: { to: Place }) {
  const plan = usePlanRoute();
  return (
    <div className="route-buttons">
      <button type="button" className="link-btn" onClick={() => plan(to)}><Icon name="route" size={16} /> Verbindung suchen</button>
      <details className="handoff">
        <summary>Weg in einer Navigations-App öffnen</summary>
        <ul>
          {handoffLinks(to).map((l) => <li key={l.name}><a href={l.url} target="_blank" rel="noreferrer">{l.name} <Icon name="external" size={14} /></a></li>)}
        </ul>
      </details>
    </div>
  );
}
