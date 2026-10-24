# Methoden und Näherungen

Die folgenden Angaben sind bewusst transparent. Maßgeblich sind immer die verlinkten Originalquellen.

## Kiez und Adresse

- Amtliche CKAN-Reihen haben unterschiedliche Stände; es wird je Indikator der jüngste verfügbare Jahrgang verwendet.
- Einwohner werden über Altersgruppen summiert; Einkommen ist ein ungewichteter Durchschnitt der Stadtbezirke.
- Das Adressprofil verschneidet WFS-Flächen (Wahlbezirk, Starkregen, Lärm, Solar, Bäume) mit dem Punkt. Punkt-in-Polygon ist eine Näherung an der Grenze.

## Routen und Erreichbarkeit

- Fuß-/Radrouten und Isochronen nutzen Valhalla mit OpenStreetMap und 30-m-Höhenraster. Treppen, kurze Rampen und Baustellen können fehlen.
- Die 15-Minuten-Isochrone ist ein Modellradius, keine Garantie. ÖPNV-Reisezeiten kommen aus EFA-BW.
- Baustellen- und Unfallkorridore sind Abstände zur Routenlinie (150 m bzw. 30 m), keine amtliche Sperrungsprüfung.

## Umwelt

- Wetter, Regen und Pollen sind Vorhersagen (DWD/Bright Sky, Open-Meteo), keine Messungen am Wohnort.
- Radarwerte sind Rasterpixel; lokale Starkregenzellen können zwischen Pixeln liegen. Blitzortung ist nicht integriert.
- Waldbrand ist eine Heuristik aus Regen, Trockenheit, Wind und Feuchte – keine amtliche Waldbrandstufe.
- Erdbeben stammen aus EMSC/USGS; Magnituden können nachträglich korrigiert werden.

## Sicherheit

- Die Notfallkarte zeigt OpenStreetMap-Einrichtungen und amtliche Notfall-Treffpunkte. Kein amtliches Rettungsregister; im Notfall gilt 112.
- Der Apotheken-Notdienst ist nicht live angebunden; die Liste zeigt Apotheken in der Nähe, der Dienstplan steht bei der ABDA.
- Die Unfallschwerpunkte sind ein 120-m-Raster, keine Straßen- oder Kreuzungsstatistik.

## Datenqualität

- Die Prüfung zählt, ob eine WFS-Ebene im Umkreis Daten liefert. Eine leere Ebene kann korrekt sein.
- OpenStreetMap ergänzt amtliche Daten, ist aber keine amtliche Quelle.
