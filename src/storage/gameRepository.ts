import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from './storageKeys';
import type { SavedGame } from '../chess/types';

/**
 * Local persistence for games. All writes are automatic (after every move,
 * on background, on leaving the game screen). Games are stored as a single
 * JSON array ordered by updatedAt desc.
 */

let writeQueue: Promise<void> = Promise.resolve();

async function readAll(): Promise<SavedGame[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.games);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isSavedGame);
  } catch {
    return [];
  }
}

function isSavedGame(value: unknown): value is SavedGame {
  if (!value || typeof value !== 'object') return false;
  const g = value as Partial<SavedGame>;
  return (
    typeof g.id === 'string' &&
    typeof g.fen === 'string' &&
    Array.isArray(g.moveHistory) &&
    typeof g.status === 'string' &&
    typeof g.opponentElo === 'number' &&
    (g.playerColor === 'white' || g.playerColor === 'black')
  );
}

async function writeAll(games: SavedGame[]): Promise<void> {
  const sorted = [...games].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  await AsyncStorage.setItem(STORAGE_KEYS.games, JSON.stringify(sorted));
}

/** Serialize writes so rapid consecutive saves never clobber each other. */
function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = writeQueue.then(task, task);
  writeQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export const gameRepository = {
  async list(): Promise<SavedGame[]> {
    const games = await readAll();
    return games.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },

  async get(id: string): Promise<SavedGame | null> {
    const games = await readAll();
    return games.find((g) => g.id === id) ?? null;
  },

  /** Most recently updated game still in progress, if any. */
  async getMostRecentActive(): Promise<SavedGame | null> {
    const games = await this.list();
    return games.find((g) => g.status === 'active') ?? null;
  },

  async save(game: SavedGame): Promise<void> {
    return enqueue(async () => {
      const games = await readAll();
      const idx = games.findIndex((g) => g.id === game.id);
      if (idx >= 0) games[idx] = game;
      else games.push(game);
      await writeAll(games);
    });
  },

  async remove(id: string): Promise<void> {
    return enqueue(async () => {
      const games = await readAll();
      await writeAll(games.filter((g) => g.id !== id));
    });
  },
};

export function createGameId(): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${Date.now().toString(36)}-${rand}`;
}
