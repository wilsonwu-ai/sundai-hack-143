#!/usr/bin/env python3
"""Check that each finding's quote appears verbatim on the page it cites.

Code, not a model: fetch the raw HTML, strip tags, normalise punctuation and
whitespace, then match each excerpt. A model checking quotes through a fetch
tool sees a summary of the page, not its text, so it cannot do this reliably.

Usage: python3 scripts/quotecheck.py research/findings.json research/quotecheck.json
"""
import html
import json
import re
import sys
import time
import urllib.request

UA = ('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/126 Safari/537.36')
cache = {}


def norm(s):
    for a, b in ((' ', ' '), ('’', "'"), ('‘', "'"), ('“', '"'),
                 ('”', '"'), ('–', '-'), ('—', '-'), ('‑', '-')):
        s = s.replace(a, b)
    s = re.sub(r'[^\w\s]', ' ', s.lower())
    return re.sub(r'\s+', ' ', s).strip()


def get(url):
    if url in cache:
        return cache[url]
    try:
        req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml'})
        raw = urllib.request.urlopen(req, timeout=25).read().decode('utf-8', 'ignore')
        text = re.sub(r'(?is)<(script|style)[^>]*>.*?</\1>', ' ', raw)
        cache[url] = norm(html.unescape(re.sub(r'<[^>]+>', ' ', text)))
    except Exception as e:  # blocked, timed out, not HTML: the finding stays unverified
        cache[url] = None
        print('FETCH FAIL', url, str(e)[:80], file=sys.stderr)
    time.sleep(0.4)
    return cache[url]


def check(url, quote):
    page = get(url)
    if page is None:
        return 'fetch_fail', None
    parts = [norm(p) for p in re.split(r'\.\.\.|…', quote)]
    parts = [p for p in parts if len(p) >= 12]
    if not parts:
        return 'too_short', None
    hit = sum(1 for p in parts if p in page)
    status = 'verified' if hit == len(parts) else ('partial' if hit else 'not_found')
    return status, f'{hit}/{len(parts)}'


def main(src, out):
    findings = json.load(open(src))['findings']
    rows = []
    for f in findings:
        status, score = check(f['sourceUrl'], f['quote'])
        rows.append({'id': f['id'], 'status': status, 'score': score, 'url': f['sourceUrl']})
    json.dump(rows, open(out, 'w'), indent=1)
    counts = {}
    for r in rows:
        counts[r['status']] = counts.get(r['status'], 0) + 1
    print(f'quotecheck: {len(rows)} findings, ' + ', '.join(f'{k} {v}' for k, v in sorted(counts.items())))


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
