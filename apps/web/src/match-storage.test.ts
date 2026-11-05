import { HeroClass, SquadId } from "game-core";
import { createLocalHost } from "game-core/local-host";
import { describe, expect, it } from "vitest";
import { clearSavedMatch, loadSavedMatch, loadSavedPlayerHero, parsePlayerHero, PLAYER_HERO_STORAGE_KEY, saveMatch } from "./match-storage";

function fakeStorage() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  };
}

const broken = {
  getItem: () => {
    throw new Error("denied");
  },
  setItem: () => {
    throw new Error("quota");
  },
  removeItem: () => {
    throw new Error("denied");
  },
};

describe("match storage", () => {
  it("resumes the saved match", async () => {
    const storage = fakeStorage();
    const host = createLocalHost(5);
    saveMatch(host, storage);
    const resumed = loadSavedMatch(storage)!;
    expect(await resumed.getSquadView(SquadId.Left)).toEqual(await host.getSquadView(SquadId.Left));
  });

  it("resumes the saved Player Hero; an old save without one is a Bruiser save", () => {
    const storage = fakeStorage();
    saveMatch(createLocalHost(5), storage, HeroClass.Assassin);
    expect(loadSavedPlayerHero(storage)).toBe(HeroClass.Assassin);
    storage.data.delete(PLAYER_HERO_STORAGE_KEY);
    expect(loadSavedPlayerHero(storage)).toBe(HeroClass.Bruiser);
    expect(loadSavedMatch(storage)).toBeDefined();
  });

  it("forgets the Player Hero with the saved match", () => {
    const storage = fakeStorage();
    saveMatch(createLocalHost(5), storage, HeroClass.Controller);
    clearSavedMatch(storage);
    expect(storage.data.size).toBe(0);
  });

  it("reads the start parameter; anything invalid is the Bruiser", () => {
    expect(parsePlayerHero("controller")).toBe(HeroClass.Controller);
    expect(parsePlayerHero("assassin")).toBe(HeroClass.Assassin);
    for (const bad of [null, undefined, "", "wizard", "Controller"]) expect(parsePlayerHero(bad)).toBe(HeroClass.Bruiser);
  });

  it("discards a snapshot with another schema version", () => {
    const storage = fakeStorage();
    saveMatch(createLocalHost(5), storage);
    const [key, value] = [...storage.data][0]!;
    storage.data.set(key, JSON.stringify({ ...JSON.parse(value), version: -1 }));
    expect(loadSavedMatch(storage)).toBeUndefined();
    expect(storage.data.size).toBe(0);
  });

  it("clears the saved match", () => {
    const storage = fakeStorage();
    saveMatch(createLocalHost(5), storage);
    clearSavedMatch(storage);
    expect(loadSavedMatch(storage)).toBeUndefined();
  });

  it("works when storage is unavailable or throws", () => {
    expect(() => saveMatch(createLocalHost(5), undefined)).not.toThrow();
    expect(() => saveMatch(createLocalHost(5), broken)).not.toThrow();
    expect(() => clearSavedMatch(broken)).not.toThrow();
    expect(loadSavedMatch(broken)).toBeUndefined();
    expect(loadSavedMatch(undefined)).toBeUndefined();
  });
});
