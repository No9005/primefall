// The picture of a card (docs/design/cards/): the pixel-art window of the card face, drawn with the Hero that plays it.
// Pictures exist for Max Overload's and Tilly Turnover's cards; a card without one shows no picture.

const CARD_ART = `${import.meta.env.BASE_URL}assets/cards/`;

/** The file of the picture of each card, by the card's name. */
export const CARD_ART_FILES: Readonly<Record<string, string>> = {
  "Buy One, Get Two": "buy-one-get-two",
  "Handle With Care": "handle-with-care",
  "Time for Coffee": "time-for-coffee",
  "Express Delivery": "express-delivery",
  "Hard Hat": "hard-hat",
  "Cargo Hook": "cargo-hook",
  "Price Tag": "price-tag",
  "Site Survey": "site-survey",
  "Urban Renewal": "urban-renewal",
  "Temporary Solution": "temporary-solution",
  "Heavy Metal": "heavy-metal",
};

/** The address of a picture by its file name (for the cards that are not in a Deck list, like the Wait card). */
export const cardArtFile = (file: string): string => `${CARD_ART}${file}.png`;

/** The address of the picture of a card, or `undefined` for a card that has none yet. */
export function cardArtUrl(cardName: string): string | undefined {
  const file = CARD_ART_FILES[cardName];
  return file === undefined ? undefined : `${CARD_ART}${file}.png`;
}
