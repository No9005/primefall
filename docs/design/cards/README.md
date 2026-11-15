# Card look: pictures, frame and back

The look of the cards, worked out with the product owner in a chat session for issue #415. It follows the build of Slay the Spire (cost orb at the top left, name ribbon, picture window, type tag, text box) in the colours and the pixel style of Primefall.

**Status: assets and reference only. The app does not use them yet.** The Hand still shows the cards as before. Wiring the frame and the pictures into `apps/web` needs a ticket.

## What is here

| Path | Content |
|---|---|
| `apps/web/public/assets/cards/<card>.png` | The picture of each card, 136 x 104 px, drawn with the Bruiser and Controller sprites of `docs/design/pixel-heroes/`. `back.png` is the whole card back with its text (300 x 420 CSS px at 2 x) |
| `overview/<card>.png` | The finished card (frame, picture and text) at 2 x, to look at |
| `reference/card-faces.html` | The live page: the frames, the backs and all cards. It draws the pictures pixel by pixel; its texts are German where they are notes to the product owner |
| `tools/export.mjs` | Renders the pictures and the overview images from the reference page: `node docs/design/cards/tools/export.mjs` |

## The cards

| Card in the rules | Name on the card | Picture |
|---|---|---|
| Double Shot | Buy One, Get Two | Max fires twice; a "2x" sale sticker |
| Close Attack | Handle With Care | the target is a crate with a Fragile sign |
| Concussion Round | Time for Coffee | the target is dizzy with a snail above its head, a coffee mug next to it |
| Rush | Express Delivery | Max sprints in a Shield bubble; a parcel label |
| Shield | Hard Hat | Max in the Shield bubble wearing a hard hat |
| Grappling Hook | Cargo Hook | the target hangs on the chain |
| Move | Walk It Off | Max walks; an arrow with a 3 on the floor |
| Pitch | Overtime | Max puts a card into a time clock; "+1" |
| Wait | Smoke Break | Max leans against a wall and smokes a cigar under a no-smoking sign |
| Attack | Price Tag | Tilly tags the target with a +1 price label |
| Utility | Site Survey | Tilly's drone scans an area; survey flags on the floor |
| Attack | Urban Renewal | the bomb lands, the 3 x 3 area blows up; "-2" |
| Utility | Heavy Metal | scrap rains on a 3 x 3 field; the target is slowed and takes "-1" |
| Utility | Temporary Solution | Tilly rams a striped barrier into the floor; a "TEMP" sign on it |
| Move / Pitch / Wait (Tilly) | Walk It Off / Cannibalize / Idle Hands | Tilly walks; shreds a card in her third arm for "+1"; waits at the workshop wall |

The files of Tilly's standard cards are `walk-it-off-tilly.png`, `cannibalize.png` and `idle-hands.png`; her five cards are `price-tag.png`, `site-survey.png`, `urban-renewal.png`, `heavy-metal.png` and `temporary-solution.png`. The keyword **Scrap** is orange in the text.

## The frame

- A card is **300 x 420 CSS px**. The frame colour tells the type: **Attack** red (`#b53a3f`, highlight `#e5484d`), **Utility** teal (`#23988d`, highlight `#2ec4b6`), the standard cards (**Move**, **Pitch**, **Wait**) steel grey (`#5b6b78`, highlight `#8aa0b2`).
- **Cost orb** at the top left, outside the frame: orange, 48 px, the cost in Pixelify Sans. Pitch shows `+1`, Move and Wait show `0`.
- **Name ribbon** over the top edge of the picture: steel blue, notched ends, Pixelify Sans 21 px.
- **Picture window**: the picture cropped to 136 x 92 px and scaled by whole numbers; behind the Hero are rays in the colour of the type (dark red, dark teal, dark steel).
- **Type tag** in the bottom edge of the window: `ATTACK`, `UTILITY`, `MOVE`, `PITCH`, `WAIT`.
- **Text box**: dark, IBM Plex Sans 16 px. Keywords are coloured: damage red, Shield blue, Slow violet, Ghost light red, Energy yellow. Below it one line of flavour in italics.
- **Back A** (chosen): a steel plate with hazard stripes, rivets, the Prime Zone diamond with four drop chevrons and the word PRIMEFALL. Back B (a megacorp contract folder with a barcode and a stamp) is in the reference page as an alternative.

Fonts: Pixelify Sans (titles and numbers), IBM Plex Sans (text), IBM Plex Mono (tags).

## Open points

- The pictures are stills from the animation clips with props. For the game each scene would be drawn once by hand. The enemy in the pictures is a stand-in.
- The cards of Tilly and Kit need their own pictures; the frames are ready.
- The text on the cards should come from the card data (`describeEffects`), as it does today; the reference page writes it by hand.
