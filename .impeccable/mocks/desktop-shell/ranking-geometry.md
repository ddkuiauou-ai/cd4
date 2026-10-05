# Ranking desktop comp geometry

The generated light v2 and dark comps are conceptual images. Their pixel coordinates are approximate and do not exactly match the intended CSS shell. Production implementation must preserve the fixed **300px CSS right rail**, 32px main-to-rail gap, 80px global header, and 56px metric bar. The generated rail width is not a replacement for those rules.

Both final images are **1491×1055**. The dark pass changed colors only; no material layout or coordinate changes are visible relative to light v2. All seven tabs, six ranking rows, three recent-viewed rows, query criteria, CSV action, pagination, and explanatory line remain.

| Region | Approximate image geometry in both final comps |
| --- | --- |
| Main content | x42–1004, about 962px |
| Rail surface | x1039–1491, y151 onward, about 452px; reaches canvas edge |
| Rail inner content | x1068–1452 |
| Global header | estimated y0–92, about 92px |
| Metric bar | estimated y92–151; bottom rule near y150; top boundary inferred from spacing |
| Search bounds | x455–1165, y19–73 |
| Search center | (810, 46) |
| Blank logo overlay area | x40–365, y18–66; center (202.5, 42); no placeholder remains |
| Table header | y320–376 |
| Ranking rows | approximately 95px each |

The requested 300px rail and 70px row density were not achieved by the bounded native correction. The logo placeholder was removed and recent-viewed items were compacted. No further structural generation was performed. The dark comp retains faint surface lighting despite the flat-color instruction.

Sources and exact prompts are preserved in each adjacent PNG provenance JSON and prompt TXT, and embedded in each PNG. Both remain `approved:false` pending review. Production source files were not changed.
