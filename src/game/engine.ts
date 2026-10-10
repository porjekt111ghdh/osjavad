export type Dir = "H" | "V";

export type Cell = {
  r: number;
  c: number;
  ch: string;
  words: number[];
};

export type Placement = {
  index: number;
  r: number;
  c: number;
  dir: Dir;
};

export type Layout = {
  rows: number;
  cols: number;
  cells: Cell[];
  placements: Placement[];
};

export type Level = {
  id: number;
  words: string[];
  beads: string[];
  layout: Layout;
};

const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

export function fa(n: number): string {
  return String(n).replace(/\d/g, (d) => FA_DIGITS[Number(d)] ?? d);
}

export function normWord(input: string): string {
  return input
    .replace(/\u200c/g, "")
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/ة/g, "ه")
    .replace(/[أإٱ]/g, "ا")
    .trim();
}

function counts(word: string): Map<string, number> {
  const map = new Map<string, number>();
  for (const ch of word) map.set(ch, (map.get(ch) ?? 0) + 1);
  return map;
}

export function wheelOf(words: string[]): string[] {
  const max = new Map<string, number>();
  for (const word of words) {
    for (const [ch, n] of counts(word)) max.set(ch, Math.max(max.get(ch) ?? 0, n));
  }
  const longest = [...words].sort((a, b) => b.length - a.length)[0] ?? "";
  const out: string[] = [];
  const used = new Map<string, number>();
  const push = (ch: string) => {
    const have = used.get(ch) ?? 0;
    if (have >= (max.get(ch) ?? 0)) return false;
    out.push(ch);
    used.set(ch, have + 1);
    return true;
  };
  for (const ch of longest) push(ch);
  for (const ch of max.keys()) {
    while (push(ch)) {
      /* fill duplicates the longest word didn't cover */
    }
  }
  for (const word of words) {
    const have = counts(out.join(""));
    for (const [ch, n] of counts(word)) {
      if ((have.get(ch) ?? 0) < n) {
        throw new Error(`حروف برای «${word}» کافی نیست`);
      }
    }
  }
  return out;
}

type GCell = { ch: string; dirs: Dir[]; words: number[] };

function layoutOrdered(words: string[], order: number[]): Layout {
  const grid = new Map<string, GCell>();
  const key = (r: number, c: number) => `${r},${c}`;
  const rawPlacements: Placement[] = [];

  function bounds() {
    let minR = Infinity;
    let minC = Infinity;
    let maxR = -Infinity;
    let maxC = -Infinity;
    for (const k of grid.keys()) {
      const [r, c] = k.split(",").map(Number);
      minR = Math.min(minR, r);
      minC = Math.min(minC, c);
      maxR = Math.max(maxR, r);
      maxC = Math.max(maxC, c);
    }
    return { minR, minC, maxR, maxC };
  }

  function canPlace(word: string, r: number, c: number, dir: Dir, requireOverlap: boolean) {
    let overlaps = 0;
    for (let i = 0; i < word.length; i++) {
      const rr = r + (dir === "V" ? i : 0);
      const cc = c + (dir === "H" ? i : 0);
      const existing = grid.get(key(rr, cc));
      if (existing) {
        if (existing.ch !== word[i] || existing.dirs.includes(dir)) return null;
        overlaps += 1;
      } else {
        const neighbors: Array<[number, number]> =
          dir === "H"
            ? [
                [rr - 1, cc],
                [rr + 1, cc],
              ]
            : [
                [rr, cc - 1],
                [rr, cc + 1],
              ];
        for (const [nr, nc] of neighbors) {
          if (grid.has(key(nr, nc))) return null;
        }
      }
    }
    const beforeR = r + (dir === "V" ? -1 : 0);
    const beforeC = c + (dir === "H" ? -1 : 0);
    const afterR = r + (dir === "V" ? word.length : 0);
    const afterC = c + (dir === "H" ? word.length : 0);
    if (grid.has(key(beforeR, beforeC)) || grid.has(key(afterR, afterC))) return null;
    if (requireOverlap && overlaps === 0) return null;

    const box = grid.size ? bounds() : { minR: r, minC: c, maxR: r, maxC: c };
    const minR = Math.min(box.minR, r, dir === "V" ? r + word.length - 1 : r);
    const maxR = Math.max(box.maxR, r, dir === "V" ? r + word.length - 1 : r);
    const minC = Math.min(box.minC, c, dir === "H" ? c + word.length - 1 : c);
    const maxC = Math.max(box.maxC, c, dir === "H" ? c + word.length - 1 : c);
    const height = maxR - minR + 1;
    const width = maxC - minC + 1;
    const score = overlaps * 200 - width * 9 - height * 7 - Math.abs(width - height) * 4;
    return { overlaps, score };
  }

  function commit(word: string, r: number, c: number, dir: Dir, index: number) {
    for (let i = 0; i < word.length; i++) {
      const rr = r + (dir === "V" ? i : 0);
      const cc = c + (dir === "H" ? i : 0);
      const slot = key(rr, cc);
      const existing = grid.get(slot);
      if (existing) {
        existing.dirs.push(dir);
        existing.words.push(index);
      } else {
        grid.set(slot, { ch: word[i], dirs: [dir], words: [index] });
      }
    }
    rawPlacements.push({ index, r, c, dir });
  }

  function bestSlot(word: string, requireOverlap: boolean) {
    const picked: { slot: { r: number; c: number; dir: Dir; score: number } | null } = { slot: null };
    const consider = (r: number, c: number, dir: Dir) => {
      const trial = canPlace(word, r, c, dir, requireOverlap);
      if (!trial) return;
      if (!picked.slot || trial.score > picked.slot.score) {
        picked.slot = { r, c, dir, score: trial.score };
      }
    };

    if (requireOverlap) {
      for (const [k, cell] of grid) {
        const [gr, gc] = k.split(",").map(Number);
        for (let i = 0; i < word.length; i++) {
          if (word[i] !== cell.ch) continue;
          for (const dir of ["H", "V"] as const) {
            if (cell.dirs.includes(dir)) continue;
            consider(gr - (dir === "V" ? i : 0), gc - (dir === "H" ? i : 0), dir);
          }
        }
      }
      return picked.slot;
    }

    const box = bounds();
    const pad = word.length + 1;
    for (let r = box.minR - pad; r <= box.maxR + pad; r++) {
      for (let c = box.minC - pad; c <= box.maxC + pad; c++) {
        consider(r, c, "H");
        consider(r, c, "V");
      }
    }
    return picked.slot;
  }

  const first = order[0];
  if (first === undefined) throw new Error("مرحله خالی است");
  commit(words[first] ?? "", 0, 0, "H", first);

  for (const index of order.slice(1)) {
    const word = words[index];
    if (!word) throw new Error("اندیس واژه نامعتبر است");
    const crossed = bestSlot(word, true);
    if (crossed) {
      commit(word, crossed.r, crossed.c, crossed.dir, index);
      continue;
    }
    const isolated = bestSlot(word, false);
    if (!isolated) throw new Error(`جایگذاری «${word}» ممکن نشد`);
    commit(word, isolated.r, isolated.c, isolated.dir, index);
  }

  const box = bounds();
  const cells: Cell[] = [];
  for (const [k, cell] of grid) {
    const [r, c] = k.split(",").map(Number);
    cells.push({ r: r - box.minR, c: c - box.minC, ch: cell.ch, words: cell.words });
  }
  const placements = rawPlacements.map((p) => ({
    ...p,
    r: p.r - box.minR,
    c: p.c - box.minC,
  }));

  for (const placement of placements) {
    const word = words[placement.index];
    if (!word) throw new Error("اندیس واژه نامعتبر است");
    for (let i = 0; i < word.length; i++) {
      const r = placement.r + (placement.dir === "V" ? i : 0);
      const c = placement.c + (placement.dir === "H" ? i : 0);
      const cell = cells.find((item) => item.r === r && item.c === c);
      if (!cell || cell.ch !== word[i] || !cell.words.includes(placement.index)) {
        throw new Error(`جدول با «${word}» نمی‌خواند`);
      }
    }
  }

  return {
    rows: box.maxR - box.minR + 1,
    cols: box.maxC - box.minC + 1,
    cells,
    placements,
  };
}

function layoutScore(layout: Layout): number {
  const { rows, cols } = layout;
  return rows * cols * 3 + Math.max(rows, cols) * 12 + Math.abs(rows - cols) * 6;
}

export function layoutWords(words: string[]): Layout {
  const indexes = words.map((_, index) => index);
  const longest = [...indexes].sort((a, b) => words[b]!.length - words[a]!.length || a - b);
  const shortest = [...indexes].sort((a, b) => words[a]!.length - words[b]!.length || a - b);
  const original = [...indexes];
  const rareFirst = [...indexes].sort((a, b) => {
    const rarity = (word: string) =>
      [...word].reduce((sum, ch) => sum + words.filter((item) => item.includes(ch)).length, 0);
    return rarity(words[a]!) - rarity(words[b]!) || words[b]!.length - words[a]!.length;
  });

  let best: Layout | null = null;
  let bestScore = Infinity;
  for (const order of [longest, shortest, original, rareFirst]) {
    const layout = layoutOrdered(words, order);
    const score = layoutScore(layout);
    if (score < bestScore) {
      best = layout;
      bestScore = score;
    }
  }
  if (!best) throw new Error("جدول ساخته نشد");
  return best;
}

export function buildLevel(id: number, raw: string): Level {
  const words = raw.split("|").map(normWord).filter(Boolean);
  if (words.length < 2) throw new Error("کمتر از دو واژه");
  if (new Set(words).size !== words.length) throw new Error("واژه تکراری");
  for (const word of words) {
    if ([...word].length < 2) throw new Error(`واژه کوتاه: ${word}`);
    if (![...word].every((ch) => /[\u0600-\u06FF]/.test(ch))) {
      throw new Error(`حرف نامعتبر در «${word}»`);
    }
  }
  return { id, words, beads: wheelOf(words), layout: layoutWords(words) };
}
