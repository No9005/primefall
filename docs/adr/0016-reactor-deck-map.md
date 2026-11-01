# Reactor Deck Map

The first Primefall map is the Reactor Deck: a damaged cargo ship whose central reactor is the Prime Zone. The map is horizontally oriented and mirror-symmetric: one squad spawns on the left edge and the other on the right edge.

The map uses a 21 by 11 tile grid. It has no interactive doors and no vertical levels in the first prototype.

## Layout

Legend:

- `S` — Spawn tile
- `#` — Wall / Bulkhead
- `F` — Full Cover
- `H` — Half Cover
- `P` — Prime Zone tile
- `O` — Overwatch Nest (Full Cover)
- `.` — Open floor

```text
  012345678901234567890
 0 #####################
 1 #.........O.........#
 2 #...##.........##...#
 3 #...#...........#...#
 4 #S..#....PPP....#..S#
 5 #S...H...PPP...H...S#
 6 #S..#....PPP....#..S#
 7 #...#...........#...#
 8 #...##.........##...#
 9 #...................#
10 #####################
```

## Grid and symmetry

The grid is 21 columns by 11 rows (columns 0–20, rows 0–10, border walls included). The odd width and height place the Prime Zone and the Overwatch Nest exactly on the central column (10) and the Zone on the central row (5), which makes the layout mirror-symmetric around column 10. Each Squad spawns on three tiles: column 1, rows 4–6 on the left and column 19, rows 4–6 on the right. An earlier 20 by 12 grid could not be mirror-symmetric with a 3 by 3 Zone.

## Prime Zone

The Prime Zone is the 3 by 3 reactor area at columns 9–11 and rows 4–6. It contains no permanent Cover.

This makes Controller effects especially valuable:

- Deploy Cover can protect an ally holding the open Zone.
- Scout Drone can reveal the side corridors without exposing the Controller.
- Aegis Protocol helps a Bruiser survive while holding the open center.
- Marked effects create squad-wide information when the Assassin is not scouting.

## Overwatch Nest

The Overwatch Nest is the single Full Cover tile at column 10, row 1. It has a direct, limited sightline south through the central corridor into the Prime Zone.

It is the Assassin’s secondary objective:

- The Assassin can use it to observe the Prime Zone and mark enemies.
- Attacking from the Nest reveals Hidden.
- The Nest can be contested, approached from either side, or forced open by Breach Charge.
- It is the only permanent Full Cover position with a sightline into the Prime Zone.

There is intentionally only one Nest. This creates a secondary fight for information control rather than giving either squad a permanent safe scouting position.

## Routes and Cover

- The main route is the horizontal corridor on rows 5–6, connecting the left and right Spawn areas to the Prime Zone.
- The Half Cover tiles at columns 5 and 15 on row 5 provide brief protection while crossing the main corridor; they do not create permanent safe sightlines into the Zone.
- The upper and lower side corridors provide Half Cover, flanking routes, retreat paths, and Hidden movement options.
- No permanent Full Cover overlooks the Prime Zone except the Overwatch Nest.
- Both squads spawn on opposite horizontal edges without direct Line of Sight into the Prime Zone, encouraging early scouting.

## Prototype rules

- Allied Heroes do not block Line of Sight or firing lines.
- Doors are represented as walls or Full Cover; interactive doors are out of scope for the MVP.
- The map has one floor level only.
