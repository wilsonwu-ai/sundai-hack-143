#!/usr/bin/env python3
"""Parse the F61 single-leg stance reference table (Table 2) into src/data/sls-norms.json.

Numbers are read from the article's open-access full text in code, never typed
by hand. The article is CC BY-NC-ND 4.0: we ship the reference values with full
attribution for non-commercial use and do not redistribute the article itself.

Usage:
  curl -s https://www.ebi.ac.uk/europepmc/webservices/rest/PMC9422043/fullTextXML -o research/norms/f61-fulltext.xml
  python3 scripts/extract-sls.py research/norms/f61-fulltext.xml src/data/sls-norms.json
"""
import html
import json
import re
import sys

BANDS = ['18-29', '30-39', '40-49', '50-59', '60-69', '70+']


def text(s):
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'</?[A-Za-z][^>]*>', ' ', s))).strip()


def leg_row(cells):
    # Each band contributes three cells: mean, SD, 95% CI ("53.5-59.2" with an en dash).
    values = cells[1:1 + 3 * len(BANDS)]
    out = {'mean': [], 'sd': [], 'ciLow': [], 'ciHigh': []}
    for i in range(len(BANDS)):
        mean, sd, ci = values[3 * i: 3 * i + 3]
        low, high = re.split(r'\s*[–-]\s*', ci)
        out['mean'].append(float(mean))
        out['sd'].append(float(sd))
        out['ciLow'].append(float(low))
        out['ciHigh'].append(float(high))
    return out


def main(src, out):
    xml = open(src, encoding='utf-8').read()
    table = next(tw for tw in re.findall(r'<table-wrap\b.*?</table-wrap>', xml, re.S)
                 if text((re.search(r'<label>(.*?)</label>', tw, re.S) or [None, ''])[1]) == 'Table 2')
    rows = [[text(c) for c in re.findall(r'<t[hd]\b.*?</t[hd]>', r, re.S)]
            for r in re.findall(r'<tr\b.*?</tr>', table, re.S)]
    header = rows[0]
    assert [re.sub(r'\D+', '-', h.split(' years')[0]).strip('-') for h in header[:6]] == \
        ['18-29', '30-39', '40-49', '50-59', '60-69', '70'], header
    n = [int(re.search(r'n = (\d+)', h).group(1)) for h in header[:6]]
    legs = {}
    for row in rows:
        m = re.match(r'SLS\s*b?\s*-\s*(right|left) leg', row[0])
        if m:
            legs[m.group(1)] = leg_row(row)
    assert set(legs) == {'right', 'left'}, legs.keys()

    doc = {
        'source': {
            'id': 'F61',
            'citation': 'Nakhostin-Ansari A, Naghshtabrizi N, Naghdi S, et al. Normative values of functional reach test, '
                        'single-leg stance test, and timed UP and GO with and without dual-task in healthy Iranian adults: '
                        'a cross-sectional study. Ann Med Surg (Lond) 2022;80:104053. doi:10.1016/j.amsu.2022.104053',
            'url': 'https://pubmed.ncbi.nlm.nih.gov/36045774/',
            'fullText': 'https://pmc.ncbi.nlm.nih.gov/articles/PMC9422043/',
            'table': 'Table 2',
            'license': 'CC BY-NC-ND 4.0',
            'population': '240 healthy Iranian adults, 40 per age band, supervised testing',
            'protocol': 'Barefoot, hands on hips, standing on the test leg unassisted, maximum 60 seconds',
        },
        'maxSeconds': 60,
        'bands': BANDS,
        'n': n,
        'legs': legs,
    }
    json.dump(doc, open(out, 'w'), indent=1)
    print(f'{out}: 2 legs x {len(BANDS)} age bands (mean, sd, 95% CI)')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
