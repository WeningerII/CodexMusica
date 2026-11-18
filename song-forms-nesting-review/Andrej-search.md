# Search ranking

Historical review at ee47d0c. See README.md for current figures and partial-entries.md and catalog-corrections.md for subsequent dispositions.

The finder now ranks a complete heading first, followed by a complete alternate name, then a complete related search term. Partial titles and diagram text still find the same forms. Names separated by commas count as separate aliases. Equal matches preserve catalog order. A family filter still applies to every tier.

## Six reported queries

These results use the review catalog that accompanied commit `4976432d624a3a8db61c6004814e19d5f8b86409`. The same catalog was supplied to both versions of the actual finder. Ranks start at 1. The matches column is the total before and after. [Andrej’s review](https://github.com/WeningerII/CodexMusica/pull/857#issuecomment-6968098933)

| Query | Exact alternate name belongs to | Previous first result | Before | After | Matches |
| --- | --- | --- | ---: | ---: | ---: |
| regular ode | Pindaric ode | Irregular ode | 2 | 1 | 2 |
| verse-refrain | Strophic with refrain | Verse-refrain with introductory verse | 2 | 1 | 10 |
| AB | Binary | ABAC 32-bar | 15 | 1 | 88 |
| ABA | Ternary | ABAC 32-bar | 6 | 1 | 14 |
| AAB | Bar form | AABA 32-bar | 3 | 1 | 12 |
| chain | Cumulative song | Hammer song / chain-gang song | 2 | 1 | 4 |

The six exact aliases had been treated as substrings after partial title matches. All six now open their owners first through the finder’s existing first-result behavior. Short schemes retain the alternative matches shown above.

## Verification

- Exercised the original and revised `showResults()` in Node with text-only result elements. Across 364 headings, 138 distinct normalized aliases and 33 distinct normalized discovery terms, 534 unique queries occur. Six queries previously ranked another record ahead of the exact owner. All 534 now put their exact owners first. Each query returned precisely the same set of forms before and after. The family-filter check passed. Equal-ranked synthetic owners had the same priority.
- Exercised the actual note renderer with the three explicit evidence categories and the two fallback cases for older records. All five produced the expected label. The record’s explicit evidence basis now takes precedence over an attached URL. The neutral label “Contested pattern” avoids implying that two outside authorities were consulted.
- `node --check dist/app.js` and `node --check verify-browser.cjs` passed. The browser suite now checks all exact search terms, all six reported rankings and secondary results, family filtering, and Enter on the exact alias AB. Run `node verify-browser.cjs` in the review directory.
- The local two-viewport Playwright check could not launch Chromium because the workspace blocks its process socket. The cloud browser rejected the local file URL before opening a tab. The Node results above cover ranking and text, and do not certify a browser interaction or rendering pass for this revision.
