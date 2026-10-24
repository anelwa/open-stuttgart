// Öffentliche Fassade des Erweiterungsprogramms für server/index.mjs und MCP.
import { sourceCatalog, runSource } from './run-source.mjs';
import { featureCatalog, runFeature } from './features/index.mjs';
import { improvementCatalog } from './improvements.mjs';

export function laborOverview() {
  const sources = sourceCatalog();
  const features = featureCatalog();
  const improvements = improvementCatalog();
  return {
    program: 'Open Stuttgart – mindestens 100 Schnittstellen, 100 Werkzeuge',
    sources: { count: sources.count, live: sources.live, planned: sources.planned, key: sources.key, groups: sources.groups },
    features: { count: features.count, live: features.live, planned: features.planned, categories: features.categories },
    improvements: { count: improvements.count, done: improvements.done, open: improvements.open, categories: improvements.categories },
    leitsatz: 'Über 100 neue öffentliche Quellen und 100 Werkzeuge, die daraus konkrete Antworten machen.',
    stand: new Date().toISOString(),
  };
}

export { sourceCatalog, runSource, featureCatalog, runFeature, improvementCatalog };
