# Reactor Deck Map

The first Primefall map is the Reactor Deck: a damaged cargo ship whose central reactor is the Prime Zone. The map is horizontally oriented and mirror-symmetric: one squad spawns on the left edge and the other on the right edge.

The map uses a 31 by 17 tile grid. It has no interactive doors and no vertical levels in the first prototype.

An earlier 21 by 11 layout was too small and offered too little tactical play. The 31 by 17 layout replaces it (issue 131) and gives three distinct ways to the Zone.

## Layout

Legend:

- `S` — Spawn tile
- `#` — Wall / Bulkhead
- `H` — Half Cover
- `P` — Prime Zone tile
- `O` — Overwatch Nest (Full Cover)
- `.` — Open floor

```text
   0123456789012345678901234567890
 0 ###############################
 1 #..............O..............#
 2 #...H...HH...HH.HH...HH...H...#
 3 #.............................#
 4 #.....HH..##.H...H.##..HH.....#
 5 #.............H.H.............#
 6 #....#######HH...HH#######....#
 7 #S............PPP............S#
 8 #S............PPP............S#
 9 #S............PPP............S#
10 #....#######HH...HH#######....#
11 #.............H.H.............#
12 #.....HH..##.H...H.##..HH.....#
13 #.............................#
14 #...H...HH...HH.HH...HH...H...#
15 #.............................#
16 ###############################
```

## Grid and symmetry

The grid is 31 columns by 17 rows (columns 0–30, rows 0–16, border walls included; the interior is 29 by 15). The odd width and height place the Prime Zone and the Overwatch Nest exactly on the central column (15) and the Zone on the central row (8). The layout is mirror-symmetric left-right around column 15 and top-bottom around row 8; the only exception is the Overwatch Nest in the top row. Each Squad spawns on three tiles: column 1, rows 7–9 on the left and column 29, rows 7–9 on the right. An earlier 20 by 12 grid could not be mirror-symmetric with a 3 by 3 Zone.

Rules, AI, Spawn positions, camera fit and tile picking all read the grid; none of them hard-codes the size, the Zone position or the Spawn columns.

## Prime Zone

The Prime Zone is the 3 by 3 reactor area at columns 14–16 and rows 7–9. It is one open area and contains no permanent Cover.

This makes Controller effects especially valuable:

- Deploy Cover can protect an ally holding the open Zone.
- Scout Drone can reveal the flanks without exposing the Controller.
- Aegis Protocol helps a Bruiser survive while holding the open center.
- Marked effects create squad-wide information when the Assassin is not scouting.

## Overwatch Nest

The Overwatch Nest is the single Full Cover tile at column 15, row 1, in the top row on the central column. It has a direct, limited sightline south into the Prime Zone.

It is the Assassin’s secondary objective:

- The Assassin can use it to observe the Prime Zone and mark enemies.
- Attacking from the Nest reveals Hidden.
- The Nest can be contested, approached from either side, or forced open by Breach Charge.
- It is the only permanent Full Cover position with a sightline into the Prime Zone.

There is intentionally only one Nest. This creates a secondary fight for information control rather than giving either squad a permanent safe scouting position.

## Routes and Cover

Three ways lead from each Spawn to the Zone, and each has a reason to be used:

- **Middle channel (rows 7–9):** a straight, three-tile-wide corridor from each Spawn to the Zone, bounded by continuous Walls (columns 5–11 and 19–25 on rows 6 and 10) and with no Cover. It is fast and direct, but everything in it can be seen and shot.
- **Upper and lower flank (rows 1–5 and 11–15):** open ground with staggered Half Cover in short horizontal runs, so a Squad can stalk forward from Cover to Cover and trade fire. Two short Wall pieces per flank (columns 10–11 and 19–20 on rows 4 and 12) give Hidden and ambush options.
- **Windows:** at the inner end of the channel Walls, next to the Zone, the Walls end in Half Cover (columns 12–13 and 17–18 on rows 6 and 10). Half Cover does not block Line of Sight, so a Squad on a flank can see and shoot into the channel and the Zone. The fight is about dominating the flanks to get a firing position on the enemy.

Other rules of the layout:

- There are no pillars: no mechanic for them exists yet.
- No permanent Full Cover overlooks the Prime Zone except the Overwatch Nest.
- The Spawn areas are far outside sight range of the Zone, encouraging early scouting.

## Prototype rules

- Allied Heroes do not block Line of Sight or firing lines.
- Doors are represented as walls or Full Cover; interactive doors are out of scope for the MVP.
- The map has one floor level only.
