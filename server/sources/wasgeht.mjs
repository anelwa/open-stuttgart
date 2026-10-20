// Modul „Was geht“ (Spezifikation stuttgart-api-recherche/was-geht, Abschnitt 6, Ausbaustufe 1):
// Szene-Termine mit Abgleich gegen das Kulturmodul, Neu in der Stadt (OpenStreetMap) und Meldungen aus offenen Feeds.
// Adapter in sources/wasgeht/, Ortsliste und Shoplisten in data/venues.json.
export { wasGeht, wasGehtIcs, wasGehtPruefliste, orte, SZENEN, JUNG } from './wasgeht/termine.mjs';
export { neueroeffnungen } from './wasgeht/neueroeffnungen.mjs';
export { news } from './wasgeht/news.mjs';
