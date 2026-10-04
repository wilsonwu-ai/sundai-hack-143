#!/usr/bin/env python3
"""Replace search-API citations with the article they actually quote.

Some research lanes cite a Europe PMC REST search URL (a JSON result list) rather
than an article page. For each such finding, fetch the result list, find the one
article whose title or abstract contains the finding's quote, and cite its PubMed
page instead. The search URL is kept as retrievedVia. Unmatched findings keep
their URL and are flagged, so the quote check decides their fate.

Usage: python3 scripts/resolve-sources.py research/findings.json
"""
import html
import json
import re
import sys
import urllib.request

UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36'
API = 'ebi.ac.uk/europepmc/webservices/rest/search'


def norm(s):
    s = html.unescape(re.sub(r'</?[A-Za-z][^>]*>', ' ', s or ''))
    s = re.sub(r'[^\w\s]', ' ', s.lower())
    return re.sub(r'\s+', ' ', s).strip()


def fetch_json(url):
    req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': 'application/json'})
    return json.loads(urllib.request.urlopen(req, timeout=25).read())


def main(path):
    doc = json.load(open(path))
    cache, resolved, unresolved = {}, 0, 0
    for f in doc['findings']:
        url = html.unescape(f['sourceUrl'])
        if API not in url:
            continue
        if url not in cache:
            try:
                cache[url] = fetch_json(url).get('resultList', {}).get('result', [])
            except Exception as e:
                print('FETCH FAIL', f['id'], str(e)[:80], file=sys.stderr)
                cache[url] = []
        quote = norm(f['quote'])
        probe = quote[:160]
        match = next((r for r in cache[url]
                      if probe and probe in norm(r.get('title', '') + ' ' + r.get('abstractText', ''))), None)
        f['retrievedVia'] = url
        if match and match.get('pmid'):
            f['sourceUrl'] = f"https://pubmed.ncbi.nlm.nih.gov/{match['pmid']}/"
            journal = match.get('journalInfo', {}).get('journal', {}).get('title', '')
            f['citation'] = f"{match.get('authorString', '')} {match.get('title', '')} {journal} {match.get('pubYear', '')}".strip()
            resolved += 1
        else:
            f['unresolvedSearchUrl'] = True
            unresolved += 1
    json.dump(doc, open(path, 'w'), indent=1)
    print(f'resolve-sources: {resolved} search-API citations resolved to PubMed, {unresolved} unresolved')


if __name__ == '__main__':
    main(sys.argv[1])
