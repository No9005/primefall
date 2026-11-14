# Reactor Deck Map

> **Terminology:** `GLOSSARY.md` now calls the Spawn strips Drop Points (this record: Spawn). This record keeps its original words.

**Status:** Rewritten in #361 as the "Crossroads" map for the three zones of ADR 0024. It replaces the 31 by 17 layout (issue 131) and the 21 by 11 layout before it. It has two Overwatch Nests again.

The first Primefall map is the Reactor Deck: a damaged cargo ship whose central reactor is the Prime Zone. The map is horizontally oriented and mirror-symmetric: one squad spawns on the left edge and the other on the right edge.

The map uses a 45 by 25 tile grid. It has no interactive doors and no vertical levels in the first prototype. It holds three zones (ADR 0024): the Prime Zone in the centre and an Outpost north and south of it on the centre column.

## Layout

Legend:

- `S` — Spawn tile
- `#` — Wall / Bulkhead
- `H` — Half Cover
- `F` — Full Cover (a slab; blocks Line of Sight)
- `P` — Prime Zone tile
- `X` — Outpost tile
- `O` — Overwatch Nest (Full Cover)
- `.` — Open floor

```text
   0         1         2         3         4
   012345678901234567890123456789012345678901234
 0 #############################################
 1 #.........##.........###.........##.........#
 2 #......HH.##..F......XXX......F..##.HH......#
 3 #................F...XXX...F................#
 4 #................F...XXX...F................#
 5 #.........#####....#######....#####.........#
 6 #.........##.....................##.........#
 7 #.........##.O.................O.##.........#
 8 #...#.....##......H.......H......##.....#...#
 9 #...#.....##.....................##.....#...#
10 #SS.#...........##..PPPPP...............#.SS#
11 #SS.....H.......##..PPPPP...........H.....SS#
12 #SS.............##..PPPPP..##.............SS#
13 #SS.....H...........PPPPP..##.......H.....SS#
14 #SS.#...............PPPPP..##...........#.SS#
15 #...#.....##.....................##.....#...#
16 #...#.....##......H.......H......##.....#...#
17 #.........##.F.................F.##.........#
18 #.........##.....................##.........#
19 #.........#####....#######....#####.........#
20 #................F...XXX...F................#
21 #................F...XXX...F................#
22 #......HH.##..F......XXX......F..##.HH......#
23 #.........##.........###.........##.........#
24 #############################################
```

## Grid and symmetry

The grid is 45 columns by 25 rows (columns 0–44, rows 0–24, border walls included). The odd width and height place the Prime Zone exactly on the central column (22) and the central row (12). The layout is mirror-symmetric top-bottom around row 12. Left-right it is symmetric around column 22 except for the Full Cover slabs and the Overwatch Nest row, which are shifted on purpose so that no tile sees all three zone centres. Each Squad spawns on a 2 by 5 strip: columns 1–2, rows 10–14 on the left and columns 42–43 on the right. Its Heroes start on rows 11–13 of column 2 or 42 (Defenders on rows 11–13 of column 20 or 24, the inner column of the Prime Zone).

Rules, AI, Spawn positions, camera fit and tile picking all read the grid; none of them hard-codes the size, the zone positions or the Spawn columns. Start tiles come from one shared rule in `reactor-deck.ts`.

## Prime Zone

The Prime Zone is the 5 by 5 reactor area at columns 20–24 and rows 10–14. It is one open area and contains no permanent Cover.

This makes Controller effects especially valuable:

- Deploy Cover can protect an ally holding the open Zone.
- Scout Drone can reveal the flanks without exposing the Controller.
- Aegis Protocol helps a Bruiser survive while holding the open center.
- Marked effects create squad-wide information when the Assassin is not scouting.

## Outposts

Two 3 by 3 Outposts sit on the centre column: columns 21–23, rows 2–4 in the north and rows 20–22 in the south. They are open ground, each flanked by Full Cover slabs and a Wall piece in the row above (or below) it, and each is separated from the Prime Zone by a Wall line with a gap (rows 5 and 19).

## Overwatch Nest

There are two Overwatch Nests (Full Cover, `O`), both in the top half: column 13, row 7 and column 31, row 7. They are not mirrored left-right (the bottom half has a Full Cover slab at columns 13 and 31, row 17 instead). Each gives a limited sightline towards the Prime Zone and the Outpost lanes.

They are the Assassin’s secondary objective:

- The Assassin can use a Nest to observe the Prime Zone and mark enemies.
- Attacking from a Nest reveals Hidden.
- A Nest can be contested, approached from either side, or forced open by Breach Charge.

## Routes and Cover

- **Middle:** from each Spawn a Squad crosses open floor to the Prime Zone. Half Cover pieces at columns 8 and 36 (rows 11 and 13) give a first step of Cover, and the Wall pieces at columns 16–17 and 27 break the long sight lines.
- **North and south:** the flanks lead to the Outposts through gaps in the Wall lines at rows 5 and 19, past Full Cover slabs.
- **Spawn safety:** there is no sight line from any Spawn tile to any Spawn tile of the other Squad, and no tile sees all three zone centres. Both are checked by tests (`reactor-deck.test.ts`). No run of open floor in the edge rows is longer than 16 tiles.

Other rules of the layout:

- There are no pillars: no mechanic for them exists yet.
- Half Cover does not block Line of Sight; Walls and Full Cover do.

## Prototype rules

- Allied Heroes do not block Line of Sight or firing lines.
- Doors are represented as walls or Full Cover; interactive doors are out of scope for the MVP.
- The map has one floor level only.
