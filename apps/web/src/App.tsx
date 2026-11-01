import { GAME_NAME } from "game-core";
import { bannerText } from "./banner";

export function App() {
  return (
    <main>
      <h1>{GAME_NAME}</h1>
      <p data-testid="banner">{bannerText()}</p>
    </main>
  );
}
