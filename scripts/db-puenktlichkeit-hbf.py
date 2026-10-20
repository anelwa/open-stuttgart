"""Erzeugt server/data/db-puenktlichkeit-hbf.json: Monatswerte Pünktlichkeit am Stuttgarter Hauptbahnhof
(oben und tief) je Gattung S-Bahn, RE/RB und Fernverkehr.

Quelle: piebro/deutsche-bahn-data (Hugging Face), Monatsdateien monthly_processed_data/data-JJJJ-MM.parquet,
Lizenz CC BY 4.0, Daten der Deutschen Bahn. Eine Zeile je Halt.

Nur für die einmalige bzw. monatliche Erzeugung; der Server liest ausschließlich die JSON-Datei.
Benötigt duckdb (z. B. in einer eigenen Umgebung: python3 -m venv /tmp/v && /tmp/v/bin/pip install duckdb).
Die Monatsdateien (60 bis 380 MB) werden einzeln geladen und danach gelöscht.

Aufruf:  python -I scripts/db-puenktlichkeit-hbf.py DOWNLOADORDNER [JJJJ-MM ...]
Ohne Monatsangabe werden alle verfügbaren Monate ab 2024 ausgewertet, die in der Ausgabe noch fehlen.

Definitionen (wie DB): pünktlich = weniger als 6 Minuten Verspätung (delay_in_min < 6), gezählt über alle Halte
mit Verspätungswert ohne Ausfälle. Ankunftspünktlichkeit = Ankunft (arrival_change_time − arrival_planned_time)
höchstens 5 volle Minuten zu spät. Ausfall = Ankunft oder Abfahrt storniert.
"""
import datetime, json, os, subprocess, sys, urllib.request

import duckdb

BASE = 'https://huggingface.co/datasets/piebro/deutsche-bahn-data/resolve/main/monthly_processed_data/'
LISTE = 'https://huggingface.co/api/datasets/piebro/deutsche-bahn-data/tree/main/monthly_processed_data'
AUSGABE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'server', 'data', 'db-puenktlichkeit-hbf.json')
FERN = ('ICE', 'IC', 'EC', 'ECE', 'TGV', 'RJ', 'RJX', 'NJ', 'EN', 'FLX', 'WB', 'EST')
RERB = ('RE', 'RB', 'MEX', 'IRE', 'IR', 'ARV')  # ARV = Arverio (vormals Go-Ahead), ab 12/2025
GATTUNGEN = ('S', 'RE-RB', 'Fern')


def monat_auswerten(c, datei):
    q = f"""
    with t as (
      select case when train_type = 'S' then 'S'
                  when train_type in {RERB} or train_type like 'RE %' or train_type like 'RB %' then 'RE-RB'
                  when train_type in {FERN} then 'Fern' else 'sonstige' end as g,
             coalesce(arrival_is_canceled, false) or coalesce(departure_is_canceled, false) as ausfall,
             delay_in_min as d,
             arrival_planned_time as ap, arrival_change_time as ac
      from read_parquet('{datei}') where station_name = 'Stuttgart Hbf')
    select g, count(*) halte, count(*) filter (where ausfall) ausfaelle,
           count(*) filter (where not ausfall and d is not null) mit_wert,
           count(*) filter (where not ausfall and d is not null and d < 6) puenktlich,
           count(*) filter (where not ausfall and ap is not null and ac is not null) an_n,
           count(*) filter (where not ausfall and ap is not null and ac is not null
                            and floor(date_diff('second', ap, ac) / 60.0) <= 5) an_puenktlich,
           avg(d) filter (where not ausfall and d is not null) mittel
    from t group by g"""
    erg = {}
    for g, halte, ausf, mw, pk, an_n, an_pk, mittel in c.sql(q).fetchall():
        if g not in GATTUNGEN:
            continue
        erg[g] = {
            'halte': halte,
            'puenktlich': round(pk / mw, 4) if mw else None,
            'ankunftPuenktlich': round(an_pk / an_n, 4) if an_n else None,
            'ausfaelle': ausf,
            'ausfallAnteil': round(ausf / halte, 4) if halte else None,
            'mittelMin': round(mittel, 2) if mittel is not None else None,
        }
    return erg


def verfuegbare_monate():
    with urllib.request.urlopen(LISTE, timeout=60) as r:
        dateien = json.load(r)
    return sorted(os.path.basename(x['path'])[5:12] for x in dateien if x['path'].endswith('.parquet'))


def main():
    dl = sys.argv[1]
    os.makedirs(dl, exist_ok=True)
    alt = json.load(open(AUSGABE, encoding='utf-8')) if os.path.exists(AUSGABE) else {'monate': []}
    monate = {m['monat']: m for m in alt.get('monate', [])}
    wunsch = sys.argv[2:] or [m for m in verfuegbare_monate() if m >= '2024-01']
    c = duckdb.connect()
    for m in wunsch:
        if m in monate:
            continue
        datei = os.path.join(dl, f'data-{m}.parquet')
        if not os.path.exists(datei):
            subprocess.run(['curl', '-sSLf', '--retry', '3', '-o', datei + '.part', f'{BASE}data-{m}.parquet'], check=True)
            os.rename(datei + '.part', datei)
        monate[m] = {'monat': m, **monat_auswerten(c, datei)}
        os.remove(datei)
        print(m, 'fertig', file=sys.stderr, flush=True)
    aus = {
        'station': 'Stuttgart Hbf (EVA 8000096 und 8098096)',
        'quelle': 'piebro/deutsche-bahn-data (Hugging Face), Monatsdateien monthly_processed_data',
        'quelleUrl': 'https://huggingface.co/datasets/piebro/deutsche-bahn-data',
        'lizenz': 'Verspätungsdaten DB: Deutsche Bahn (CC BY 4.0)',
        'erzeugt': datetime.date.today().isoformat(),
        'erzeugtMit': 'scripts/db-puenktlichkeit-hbf.py',
        'definitionen': {
            'halte': 'Anzahl Halte (Ankunft und/oder Abfahrt eines Zuges) am Hbf oben und tief',
            'puenktlich': 'Anteil der Halte mit weniger als 6 Minuten Verspätung (ohne Ausfälle)',
            'ankunftPuenktlich': 'Anteil der Ankünfte mit höchstens 5 vollen Minuten Verspätung (ohne Ausfälle)',
            'ausfaelle': 'Halte mit stornierter Ankunft oder Abfahrt',
            'mittelMin': 'mittlere Verspätung in Minuten (ohne Ausfälle)',
            'gattungen': 'S = S-Bahn; RE-RB = RE, RB, MEX, IRE, IR, ARV; Fern = ICE, IC, EC, ECE, TGV, RJ, RJX, NJ, EN, FLX, WB',
        },
        'grenzen': [
            'Die Monatsdateien beginnen im Juli 2024.',
            'Gezählt wird nur Stuttgart Hbf, nicht das ganze S-Bahn-Netz. Die amtlichen Werte der S-Bahn Stuttgart beziehen alle Stationen ein und weichen deshalb ab.',
            'In Monaten mit Streckensperrungen (etwa August) sind weniger Halte enthalten.',
            'Der Datensatz beruht auf regelmäßigen Abrufen der DB-Schnittstelle; Lücken in der Erfassung sind möglich.',
        ],
        'monate': [monate[k] for k in sorted(monate)],
    }
    with open(AUSGABE, 'w', encoding='utf-8') as f:
        json.dump(aus, f, ensure_ascii=False, indent=1)
        f.write('\n')


if __name__ == '__main__':
    main()
