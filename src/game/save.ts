const KEY = "oos-javad-v1";

export type Save = {
  v: 1;
  coins: number;
  frontier: number;
  sound: boolean;
  skipIntro: boolean;
  solved: Record<string, string[]>;
  hints: Record<string, string[]>;
  paidWords: Record<string, string[]>;
  paidBonus: number[];
};

export const HINT_COST = 25;
export const WORD_PAY = 4;
export const CLEAR_PAY = 20;

export function defaultSave(): Save {
  return {
    v: 1,
    coins: 80,
    frontier: 1,
    sound: true,
    skipIntro: false,
    solved: {},
    hints: {},
    paidWords: {},
    paidBonus: [],
  };
}

function clampFrontier(value: number | undefined): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(201, Math.max(1, Math.floor(value ?? 1)));
}

export function loadSave(): Save {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultSave();
    const parsed = JSON.parse(raw) as Partial<Save>;
    if (parsed.v !== 1) return defaultSave();
    const base = defaultSave();
    return {
      ...base,
      coins: Math.max(0, Math.floor(parsed.coins ?? base.coins)),
      frontier: clampFrontier(parsed.frontier),
      sound: parsed.sound !== false,
      skipIntro: parsed.skipIntro === true,
      solved: parsed.solved ?? {},
      hints: parsed.hints ?? {},
      paidWords: parsed.paidWords ?? {},
      paidBonus: Array.isArray(parsed.paidBonus) ? parsed.paidBonus : [],
    };
  } catch {
    return defaultSave();
  }
}

export function writeSave(save: Save) {
  localStorage.setItem(KEY, JSON.stringify(save));
}
