import { GAME_NAME } from "game-core";
import { Board } from "./Board";
import { bannerText } from "./banner";

export function App() {
  return (
    <main className="app">
      <header className="app-bar">
        <h1>{GAME_NAME}</h1>
        <p data-testid="banner">{bannerText()}</p>
      </header>
      <Board />
    </main>
  );
}
