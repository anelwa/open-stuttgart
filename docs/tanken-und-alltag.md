# Tankpreise und Alltagskategorien

## Tankpreise

Die Tankpreise stammen aus der **Markttransparenzstelle für Kraftstoffe (MTS-K)** beim Bundeskartellamt. Die App fragt sie über die freie **Tankerkönig-API** ab (CC BY 4.0). Ohne eigenen Key nutzt sie den keylosen Dienst **InfraNode**, der dieselben MTS-K-Daten für den 5-km-Radius um die Stuttgarter Stadtmitte bereitstellt.

### Betrieb

```bash
# Optional: echter Tankerkönig-Key (empfohlen, stadtweiter Abruf)
OS_TANKERKOENIG_KEY=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

# Optional: Anbieter erzwingen (auto | tankerkoenig | infranode)
OS_TANKEN_PROVIDER=auto

# Optional: Radius in km (1–25, Standard 15)
OS_TANKEN_RADIUS=15
```

- **Ohne Key:** `OS_TANKEN_PROVIDER=auto` fällt automatisch auf InfraNode zurück. Der Abruf ist auf den 5-km-Radius um die Stadtmitte beschränkt; Tankstellen in den Außenbezirken und auf Routen dorthin fehlen dann.
- **Mit Key:** Tankerkönig liefert die Tankstellen im eingestellten Radius um die Stadtmitte, standardmäßig 15 km.
- **Key nicht veröffentlichen.** Der Key gehört in `.env` oder in die Umgebung des Servers, nicht in den Code oder in ein Repository. Tankerkönig verlangt außerdem eine funktionierende Anmelde-E-Mail und namentliche Registrierung. Die Registrierung ist zeitweise wegen Wartungsarbeiten geschlossen; ohne Key läuft die App mit dem InfraNode-Fallback weiter.

### Grenzen und Höflichkeit

- Tankerkönig erlaubt **höchstens einen Request pro Minute** und nur Abrufe, die durch eine Nutzeraktion ausgelöst werden. Der Server cached das Ergebnis **60 Sekunden** und teilt es für alle Nutzer. Es gibt **kein automatisches Polling**; die Ansicht lädt beim Öffnen und über „Preise aktualisieren“.
- Die freie API liefert **keine Preisgeschichte**. Deshalb gibt es keine „beste Tankzeit“ und keine Preisprognose.
- Die API liefert **E5, E10 und Diesel**. LPG, CNG, E85 und AdBlue sind nicht enthalten.
- Preise ändern sich mehrmals täglich. Angezeigt wird der Abrufzeitpunkt; maßgeblich ist immer der Preis an der Zapfsäule.
- Keine Massendaten spiegeln und keine Ergebnisse filtern, die der Nutzer nicht ausdrücklich gewählt hat. Die App liefert alle Tankstellen und sortiert erst im Browser nach Sorte und Preis bzw. Entfernung.

### Endpunkt

`GET /api/nearby/tanken`

Antwort:

```json
{
  "provider": "tankerkoenig",
  "source": "Tankerkönig / MTS-K (CC BY 4.0)",
  "stand": "2026-10-22T19:12:07.000Z",
  "radiusKm": 15,
  "stale": false,
  "error": null,
  "fallback": null,
  "license": "CC BY 4.0",
  "licenseUrl": "https://creativecommons.tankerkoenig.de/",
  "stations": [
    {
      "id": "…",
      "name": "Shell Stuttgart …",
      "brand": "Shell",
      "address": "…",
      "lat": 48.78,
      "lon": 9.18,
      "distKm": 1.4,
      "e5": 2.049,
      "e10": 1.989,
      "diesel": 2.219,
      "isOpen": true
    }
  ]
}
```

### Oberfläche

- Abschnitt **„Tanken“** im Modul „Nähe“: Umschalter E5/E10/Diesel, Sortierung „Günstigste zuerst“ / „Nächste zuerst“, Preis pro Liter, Öffnungsstatus, Adresse, Entfernung, Preisstand.
- Klick auf eine Tankstelle öffnet das Detailblatt; „Auf der Karte“ legt alle Tankstellen auf die Kartenebene.
- Im **Routenmodul** erscheint bei „Auto“ der Abschnitt „Günstigste Tankstelle auf der Route“. Er zeigt die günstigsten Tankstellen im 1,5-km-Korridor der Route; die Preise werden nach Sorte umgeschaltet.

## OSM-Alltagskategorien

Mit `npm run data:pois` werden zusätzlich aus dem BBBike-Extrakt Stuttgart aufbereitet:

| Kategorie | OSM-Tag | Anzahl (22.10.2026) |
|---|---|---:|
| Defibrillatoren (AED) | `emergency=defibrillator` | 138 |
| Paketstationen | `amenity=parcel_locker` | 126 |
| Briefkästen | `amenity=post_box` | 382 |
| Bücherschränke | `amenity=public_bookcase` | 38 |
| Waschsalons | `shop=laundry` | 33 |
| Hundeparks | `leisure=dog_park` | 12 |
| Toiletten mit Wickeltisch | `amenity=toilets` + `changing_table=yes` | 24 |
| Tafeln und Sozialkaufhäuser | `social_facility=food_bank` / `shop=charity` | 13 |

Die Zahlen sind **untere Schranken** aus OpenStreetMap, keine amtlichen Register. Besonders bei AED und Briefkästen kann der Bestand unvollständig oder veraltet sein. Im Notfall gilt **112**; für verbindliche Angaben gilt die Seite des Betreibers.

## Blitzer

Es gibt bewusst **keine Blitzerwarnungen**. In Baden-Württemberg sind keine offenen, amtlichen Blitzerdaten verfügbar; die bekannten Listen stammen von kommerziellen Anbietern oder Community-Meldungen. Für Fahrende sind Blitzerwarnungen in Deutschland nach § 23 StVO unzulässig. Die App zeigt stattdessen im Routenmodul **Unfallschwerpunkte** aus dem Unfallatlas und weist auf dieser Basis auf Gefahrenstellen hin.

## Quellen und Lizenzen

- Tankpreise: Tankerkönig / MTS-K, CC BY 4.0, https://creativecommons.tankerkoenig.de/
- Keyloser Fallback: InfraNode, https://infranode.dev/daten/spritpreise-api/
- OSM-Kategorien: © OpenStreetMap-Mitwirkende, ODbL 1.0
- Unfallatlas: dl-de/by-2-0
