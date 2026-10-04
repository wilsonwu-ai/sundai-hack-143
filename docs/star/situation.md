## S: Situation

### Sundai Club and Hack 143

Sundai Club describes itself as the largest MIT / Harvard AI hacker group, one that meets every Sunday to build a new AI app from scratch by the end of the day [F51]. Hack 143 is the Biomarkers of Aging hack. It ran on Sunday 4 October 2026, from 10:00 to 22:00 at Harvard [F51]. It is part of Boston Longevity Week (1 to 7 October 2026), organized by Sundai Club, and the 2026 Biomarkers of Aging Conference follows on 5 and 6 October at Harvard Medical School [F52]. The Boston Longevity Hub describes the hack as "a one-day AI hackathon to build and test aging biomarkers from imaging, wearables, and physiological signals" [F52].

The question, as the organizers' brief we worked from puts it: how can we measure how fast someone is aging, using data we can collect today, such as a face photo, a phone camera, a wearable, voice or a simple movement test? The exact wording comes from our notes of the brief. The event pages [F51] [F52] confirm the theme and the kinds of data.

The schedule has three fixed points: a 10:30 Biomarkers of Aging overview, 11:00 team formation, and 20:00 final presentations. No co-host or named speaker is listed for the overview [F51].

### How the vote and the rules work

This part is thinner than we would like. The pages we could read did not confirm Sundai's judging and voting rules, team-size rule or open-source requirement. Our only source is the organizers' brief as recorded in our notes, so treat these as unconfirmed by any finding:

- Presentations happen at 20:00 and the audience votes on what it saw.
- Teams are of at least two people.
- The app must be on a public URL.
- The code must be open source.

We designed for all four anyway, because they cost us little: two people, a public GitHub Pages site and an open repo.

### What decides the vote

Our read of what wins, drawn from the research (see `research/synthesis.json`):

- Voters can try it on themselves in the room, straight after the presentations. A demo they run on their own phone is remembered. A slide is not.
- Scientific honesty. The audience includes researchers and clinicians who know the literature. The Biomarkers of Aging Consortium says the field lacks standards and consensus on what makes a reliable aging biomarker [F46], and its conference starts the next day [F52].
- A link to aging outcomes, not only to guessing age in years. For example, the open voice age model we looked at has an error between 7.1 and 10.8 years and predicts chronological age only [F34].
- A working app on a public URL. A broken demo is out of the running.
- Visible AI that is not a copy. FaceAge is the headline example in the organizers' brief and its code is public [F14], so several teams are likely to build selfie age.

### What a biomarker of aging is

Precisely: a biomarker of aging is a measurable signal that changes with the biology of aging and says something about a person's aging beyond the number of birthdays. This is our working definition. The Consortium's own stated goal is "standardized, clinically validated ways to measure aging" [F53], and its Cell paper proposes a framework for terminology and characterization of these markers [F46]. The abstract does not itself list the criteria, and we did not read the full text, so we do not claim to list them.

Biomarkers come in many forms. Some are blood based. DNAm PhenoAge is an epigenetic clock, a DNA-methylation measure trained on a clinical phenotypic age, and it predicts all-cause mortality, cancers, healthspan, physical functioning and Alzheimer's disease [F43]. Organ-specific plasma-proteomic ages were built for 11 organs in 5,676 adults across five cohorts [F44]. Some are image based. FaceAge reads a face photo with a deep-learning system, and cancer patients looked about 4.79 years older than a non-cancerous reference cohort [F11].

An analogy: think of a car again. The odometer is age in years. A biomarker is the mechanic's reading of the engine: compression, oil quality, wear. Two cars with the same mileage can read very differently.

### Biological age versus pace of aging

Chronological age is the count of years since birth. Biological age is a measure of where a person's body stands on a scale of wear. Many models only predict chronological age. The voice model above is one of them, so it is a weak aging proxy [F34].

Pace of aging is different again. It is a rate, not a level. DunedinPACE was modelled by tracking within-individual decline in 19 indicators of organ-system integrity across four time points spanning two decades, then distilled into a one-time DNA-methylation blood test [F41]. In the car analogy, biological age is the engine's condition today, and pace is how quickly that condition is changing. A single one-day measurement can hint at a level. A rate needs repeats.

The idea of one number is also under pressure. In the proteomic work, nearly 20% of the population show strongly accelerated age in one organ and 1.7% are multi-organ agers, which supports a per-organ profile rather than a single age number [F45].

### What scientists require of a valid biomarker

The validation template we kept coming back to is DunedinPACE: high test-retest reliability (you get about the same answer when you measure again), plus association with morbidity, disability and mortality [F42]. Accelerated organ aging in the proteomic study carries 20 to 50% higher mortality risk [F44]. The Consortium says the lack of standards and consensus on the properties of a reliable aging biomarker hinders further development and validation for clinical applications [F46].

The Consortium also runs the Biomarkers of Aging Challenge. Phase I used DNA methylation data from 500 individuals aged 18 to 99, which is blood based and not camera based. Its phases are chronological age, mortality and multi-morbidity [F54].

What this means for a camera app is simple, and it shaped every choice later: report error honestly, show the source of every number, and never present a result as proof of health. This app estimates an age band from published reference data. It is not a medical device and it does not diagnose anything.
