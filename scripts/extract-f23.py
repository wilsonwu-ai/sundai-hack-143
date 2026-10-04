#!/usr/bin/env python3
"""Parse the F23 sit-to-stand reference table (Table 2) into src/data/sts-norms.json.

Numbers are read from the article's open-access full text in code, never typed by
hand. The article is CC BY-NC-ND 4.0: we ship the reference values with full
attribution for non-commercial use and do not redistribute the article itself.

Usage:
  curl -s https://www.ebi.ac.uk/europepmc/webservices/rest/PMC13193711/fullTextXML -o research/norms/f23-fulltext.xml
  python3 scripts/extract-f23.py research/norms/f23-fulltext.xml src/data/sts-norms.json
"""
import html
import json
import re
import sys

TESTS = {'1 min': '1min', '30 sec': '30s', '5 rep': '5rep'}
UNITS = {'1min': ('reps', 'higher'), '30s': ('reps', 'higher'), '5rep': ('seconds', 'lower')}


def text(s):
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', s))).strip()


def main(src, out):
    xml = open(src, encoding='utf-8').read()
    table = next(tw for tw in re.findall(r'<table-wrap\b.*?</table-wrap>', xml, re.S)
                 if text((re.search(r'<label>(.*?)</label>', tw, re.S) or [None, ''])[1]) == 'Table 2')
    rows = [[text(c) for c in re.findall(r'<t[hd]\b.*?</t[hd]>', r, re.S)]
            for r in re.findall(r'<tr\b.*?</tr>', table, re.S)]

    bands = rows[0][2:]
    assert bands == ['18-29', '30-39', '40-49', '50-59', '60-69', '70-80'], bands
    tests, test, sex = {}, None, None
    for row in rows[1:]:
        cells = list(row)
        if cells[0] in TESTS:
            test = TESTS[cells.pop(0)]
            unit, better = UNITS[test]
            tests[test] = {'unit': unit, 'better': better}
        if cells[0].startswith(('Women', 'Men')):
            sex = 'female' if cells.pop(0).startswith('Women') else 'male'
            tests[test][sex] = {}
        label = cells[0].replace(' ', '')
        values = [float(v) for v in cells[1:]]
        assert len(values) == 6, (test, sex, row)
        tests[test][sex][label] = values

    for t in tests.values():
        for sex in ('female', 'male'):
            assert list(t[sex]) == ['n', 'p2.5', 'p25', 'p50', 'p75', 'p97.5'], t[sex].keys()
            t[sex]['n'] = [int(v) for v in t[sex]['n']]

    doc = {
        'source': {
            'id': 'F23',
            'citation': 'Rodriguez-Castro J, Benavides-Cordoba V, Torres-Castro R, Otto-Yanez M, Betancourt-Pena J, '
                        'Avila-Valencia JC. Reference values for sit-to-stand tests in Colombian adults: a multicenter '
                        'cross-sectional study. Colombia Medica 2025;56(4). doi:10.25100/cm.v56i4.6874',
            'url': 'https://pubmed.ncbi.nlm.nih.gov/42183074/',
            'fullText': 'https://europepmc.org/article/PMC/PMC13193711',
            'table': 'Table 2',
            'license': 'CC BY-NC-ND 4.0',
            'population': '393 healthy community-dwelling Colombian adults, supervised testing',
            'protocol': 'Standard chair, 43 to 46 cm high, with thoracolumbar support',
        },
        'bands': bands,
        'percentiles': ['p2.5', 'p25', 'p50', 'p75', 'p97.5'],
        'tests': tests,
    }
    json.dump(doc, open(out, 'w'), indent=1)
    print(f'{out}: {len(tests)} tests x 2 sexes x {len(bands)} age bands')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
