#!/usr/bin/env python3
"""Merge lane findings, the code quote check and the skeptic review into research/verified.json.

status: killed if the review killed it (the correct or current lens refuted it with a
quote from a source), else verified if its own quote was found verbatim on its cited
page, else unverified. Without research/review.json the statuses are provisional.
The review file is written from the workflow's own kill list, never recomputed here.
"""
import json
import os

findings = json.load(open('research/findings.json'))
qc = {r['id']: r for r in json.load(open('research/quotecheck.json'))}
reviewed = os.path.exists('research/review.json')
review = json.load(open('research/review.json')) if reviewed else {'killed': [], 'appliesWarnings': {}, 'lenses': {}}

out = []
for f in findings['findings']:
    q = qc.get(f['id'], {})
    if f['id'] in review['killed']:
        status = 'killed'
    elif q.get('status') == 'verified':
        status = 'verified'
    else:
        status = 'unverified'
    out.append({**f,
                'quotecheck': {'status': q.get('status'), 'score': q.get('score')},
                'review': review['lenses'].get(f['id'], {}),
                'appliesWarning': review['appliesWarnings'].get(f['id']),
                'status': status})

counts = {}
for f in out:
    counts[f['status']] = counts.get(f['status'], 0) + 1
json.dump({'reviewed': reviewed, 'counts': counts, 'lanesSent': findings['lanesSent'],
           'lanesReturned': findings['lanesReturned'], 'findings': out},
          open('research/verified.json', 'w'), indent=1)
json.dump({'ideas': findings['ideas'], 'gaps': findings['gaps']}, open('research/ideas.json', 'w'), indent=1)
print('verified.json:', ', '.join(f'{k} {v}' for k, v in sorted(counts.items())),
      '(reviewed)' if reviewed else '(provisional)')
