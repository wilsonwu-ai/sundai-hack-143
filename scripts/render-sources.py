#!/usr/bin/env python3
"""Render docs/star/sources.md from research/verified.json.

Deterministic, so the source list can never cite a link a model invented.
Killed findings are left out; unverified ones stay, labelled.
"""
import json
from urllib.parse import urlparse

doc = json.load(open('research/verified.json'))
rows = [
    '## Sources',
    '',
    'Every [F##] in this repo resolves here. **verified**: a script found the quoted text on the cited page. '
    '**unverified**: the page blocked the check or the quote did not match exactly, so read the source before relying on it. '
    'Findings a reviewer refuted are left out.',
    '',
    '| ID | Claim | Source | Date | Check |',
    '|---|---|---|---|---|',
]
for f in doc['findings']:
    if f['status'] == 'killed':
        continue
    domain = urlparse(f['sourceUrl']).netloc.replace('www.', '')
    claim = f['claim'].replace('|', '/').replace('—', ', ').replace('–', '-')
    rows.append(f"| {f['id']} | {claim} | [{domain}]({f['sourceUrl']}) | {f['publicationDate']} | {f['status']} |")
open('docs/star/sources.md', 'w').write('\n'.join(rows) + '\n')
print(f"sources.md: {len(rows) - 6} findings listed")
