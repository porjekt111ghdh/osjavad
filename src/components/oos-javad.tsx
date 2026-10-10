import { useEffect, useRef, useState } from "react";
import { Check, ChevronRight, Eraser, Home, Lightbulb, Lock, Settings, Shuffle } from "lucide-react";
import { playBad, playCinematic, playDup, playOk, playTap, playWin, setSoundEnabled, unlockAudio } from "@/game/audio";
import { fa, normWord, type Cell, type Level } from "@/game/engine";
import { CHAPTERS, LEVELS, chapterOf } from "@/game/levels";
import { CLEAR_PAY, HINT_COST, WORD_PAY, loadSave, writeSave, type Save } from "@/game/save";

type Screen = "boot" | "intro" | "menu" | "map" | "settings" | "play";
type Tone = "ok" | "bad" | "info";

declare global {
  interface Window {
    __oos?: {
      submitWord: (word: string) => void;
      get: () => { screen: Screen; frontier: number; coins: number; level: number; found: string[] };
    };
  }
}

function starPoints(cx: number, cy: number, outer: number, inner: number) {
  const pts: string[] = [];
  for (let i = 0; i < 16; i++) {
    const ang = -Math.PI / 2 + (i * Math.PI) / 8;
    const r = i % 2 === 0 ? outer : inner;
    pts.push(`${(cx + Math.cos(ang) * r).toFixed(1)},${(cy + Math.sin(ang) * r).toFixed(1)}`);
  }
  return pts.join(" ");
}

function Seal({ id, className }: { id: string; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 120 120" aria-hidden>
      <defs>
        <radialGradient id={id} cx="38%" cy="32%" r="70%">
          <stop offset="0%" stopColor="var(--color-gold-soft)" />
          <stop offset="48%" stopColor="var(--color-gold)" />
          <stop offset="100%" stopColor="var(--color-gold-deep)" />
        </radialGradient>
      </defs>
      <circle cx="60" cy="60" r="56" fill="var(--color-navy)" stroke={`url(#${id})`} strokeWidth="3" />
      <polygon points={starPoints(60, 60, 40, 18)} fill={`url(#${id})`} />
      <circle cx="60" cy="60" r="18" fill="var(--color-ink)" stroke="var(--color-gold-soft)" strokeWidth="1.4" />
      <text x="60" y="68" textAnchor="middle" fill="var(--color-cream)" fontFamily="Lalezar, Vazirmatn, sans-serif" fontSize="26">
        ج
      </text>
    </svg>
  );
}

function GoldDust() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    const dots = Array.from({ length: 64 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: Math.random() * 1.8 + 0.4,
      s: Math.random() * 0.08 + 0.02,
      p: Math.random() * Math.PI * 2,
    }));
    const draw = (time: number) => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
        canvas.width = Math.floor(w * dpr);
        canvas.height = Math.floor(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      for (const dot of dots) {
        if (!reduce) dot.y -= dot.s * 0.016;
        if (dot.y < -0.02) dot.y = 1.02;
        const alpha = 0.25 + Math.sin(time / 500 + dot.p) * 0.2;
        ctx.beginPath();
        ctx.fillStyle = `rgba(224, 180, 90, ${alpha})`;
        ctx.arc(dot.x * w + Math.sin(time / 800 + dot.p) * 8, dot.y * h, dot.r, 0, Math.PI * 2);
        ctx.fill();
      }
      if (!reduce) frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, []);
  return <canvas ref={ref} className="dust" />;
}

function foundOf(save: Save, level: Level) {
  return (save.solved[String(level.id)] ?? []).filter((word) => level.words.includes(word));
}

export function OosJavad() {
  const [save, setSave] = useState<Save | null>(null);
  const [screen, setScreen] = useState<Screen>("boot");
  const [stage, setStage] = useState(1);
  const [settingsBack, setSettingsBack] = useState<Screen>("menu");
  const [playing, setPlaying] = useState(1);
  const [confirmReset, setConfirmReset] = useState(false);
  const saveRef = useRef<Save | null>(null);
  saveRef.current = save;

  function commit(next: Save) {
    saveRef.current = next;
    setSave(next);
    writeSave(next);
    setSoundEnabled(next.sound);
  }

  useEffect(() => {
    const loaded = loadSave();
    setSoundEnabled(loaded.sound);
    saveRef.current = loaded;
    setSave(loaded);
    setScreen(loaded.skipIntro ? "menu" : "intro");
  }, []);

  useEffect(() => {
    if (screen !== "intro") return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const marks = reduce ? [80, 180, 320, 460] : [550, 2500, 4900, 7600];
    const timers = marks.map((ms, index) => window.setTimeout(() => setStage(index + 1), ms));
    const end = window.setTimeout(() => setScreen("menu"), marks[3]! + (reduce ? 500 : 2300));
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      window.clearTimeout(end);
    };
  }, [screen]);

  const level = LEVELS[playing - 1] ?? LEVELS[0]!;

  return (
    <main className="stage">
      <div className="shell">
        {screen === "boot" || !save ? <Boot /> : null}
        {screen === "intro" && save ? (
          <Intro
            stage={stage}
            onSkip={() => setScreen("menu")}
            onEnter={() => setScreen("menu")}
            sound={save.sound}
          />
        ) : null}
        {screen === "menu" && save ? (
          <Menu
            save={save}
            onPlay={() => {
              setPlaying(Math.min(save.frontier, 200));
              setScreen("play");
            }}
            onMap={() => setScreen("map")}
            onSettings={() => {
              setSettingsBack("menu");
              setConfirmReset(false);
              setScreen("settings");
            }}
          />
        ) : null}
        {screen === "map" && save ? (
          <LevelMap
            save={save}
            onBack={() => setScreen("menu")}
            onPick={(id) => {
              setPlaying(id);
              setScreen("play");
            }}
          />
        ) : null}
        {screen === "settings" && save ? (
          <SettingsScreen
            save={save}
            confirmReset={confirmReset}
            onBack={() => setScreen(settingsBack)}
            onToggleSound={() => commit({ ...save, sound: !save.sound })}
            onToggleIntro={() => commit({ ...save, skipIntro: !save.skipIntro })}
            onAskReset={() => setConfirmReset(true)}
            onCancelReset={() => setConfirmReset(false)}
            onReset={() => {
              const next = { ...defaultKeep(save), ...freshProgress() };
              commit(next);
              setConfirmReset(false);
              setScreen("menu");
            }}
          />
        ) : null}
        {screen === "play" && save ? (
          <Play
            key={level.id}
            level={level}
            save={save}
            commit={commit}
            onHome={() => setScreen("menu")}
            onSettings={() => {
              setSettingsBack("play");
              setConfirmReset(false);
              setScreen("settings");
            }}
            onPlay={(id) => setPlaying(id)}
          />
        ) : null}
      </div>
    </main>
  );
}

function freshProgress() {
  return {
    coins: 80,
    frontier: 1,
    solved: {},
    hints: {},
    paidWords: {},
    paidBonus: [] as number[],
  };
}

function defaultKeep(save: Save): Save {
  return { ...save };
}

function Boot() {
  return (
    <section className="boot">
      <Seal id="boot-seal" className="seal" />
      <h1 className="title">اوس جواد</h1>
    </section>
  );
}

function Intro({
  stage,
  onSkip,
  onEnter,
  sound,
}: {
  stage: number;
  onSkip: () => void;
  onEnter: () => void;
  sound: boolean;
}) {
  return (
    <section
      className="intro"
      data-stage={stage}
      onPointerDown={() => {
        if (!sound) return;
        unlockAudio();
        playCinematic();
      }}
    >
      <GoldDust />
      <button type="button" className="skip" onClick={onSkip}>
        رد کردن مقدمه
      </button>
      <p className="studio-en" dir="ltr">
        BIG STUDIO
      </p>
      <p className="studio-fa">بیگ استودیو تقدیم می‌کند</p>
      <div className="logo-block">
        <Seal id="intro-seal" className="seal" />
        <h1 className="title">اوس جواد</h1>
        <p className="tag">بازی واژه‌ها</p>
        <button type="button" className="btn-gold enter" onClick={onEnter}>
          ورود به بازی
        </button>
      </div>
    </section>
  );
}

function Menu({
  save,
  onPlay,
  onMap,
  onSettings,
}: {
  save: Save;
  onPlay: () => void;
  onMap: () => void;
  onSettings: () => void;
}) {
  const done = save.frontier > 200;
  const current = Math.min(save.frontier, 200);
  return (
    <section className="menu">
      <Seal id="menu-seal" className="seal seal-sm" />
      <h1 className="title">اوس جواد</h1>
      <p className="tag">حرف‌ها را به واژه بدل کن</p>
      <div className="coin-pill">
        <span className="coin-dot" />
        {fa(save.coins)} سکه
      </div>
      <div className="menu-actions">
        <button type="button" className="btn-gold" onClick={onPlay}>
          {done ? "تماشای آخرین مرحله" : `ادامه — مرحله ${fa(current)}`}
        </button>
        <button type="button" className="btn-ghost" onClick={onMap}>
          انتخاب مرحله
        </button>
        <button type="button" className="btn-line" onClick={onSettings}>
          تنظیمات
        </button>
      </div>
      <p className="fine">بیگ استودیو · پیشرفت روی همین دستگاه می‌ماند</p>
    </section>
  );
}

function LevelMap({ save, onBack, onPick }: { save: Save; onBack: () => void; onPick: (id: number) => void }) {
  const cap = Math.min(save.frontier, 200);
  return (
    <section className="map">
      <div className="map-head">
        <button type="button" className="icon-btn" onClick={onBack} aria-label="بازگشت">
          <Home size={20} />
        </button>
        <h1>مراحل</h1>
      </div>
      {CHAPTERS.map((name, chapter) => (
        <section className="chapter" key={name}>
          <h2>{name}</h2>
          <div className="map-grid">
            {Array.from({ length: 20 }, (_, index) => chapter * 20 + index + 1).map((id) => {
              const locked = id > cap;
              const done = id < save.frontier;
              const now = save.frontier <= 200 && id === save.frontier;
              return (
                <button
                  key={id}
                  type="button"
                  className={`level-btn${done ? " done" : ""}${now ? " now" : ""}`}
                  disabled={locked}
                  onClick={() => onPick(id)}
                  aria-label={`مرحله ${fa(id)}`}
                >
                  {locked ? <Lock /> : done ? <Check /> : null}
                  {fa(id)}
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </section>
  );
}

function SettingsScreen({
  save,
  confirmReset,
  onBack,
  onToggleSound,
  onToggleIntro,
  onAskReset,
  onCancelReset,
  onReset,
}: {
  save: Save;
  confirmReset: boolean;
  onBack: () => void;
  onToggleSound: () => void;
  onToggleIntro: () => void;
  onAskReset: () => void;
  onCancelReset: () => void;
  onReset: () => void;
}) {
  return (
    <section className="settings">
      <div className="set-head">
        <button type="button" className="icon-btn" onClick={onBack} aria-label="بازگشت">
          <ChevronRight size={20} />
        </button>
        <h1>تنظیمات</h1>
      </div>
      <p className="help">حرف‌ها را بکشید یا یکی‌یکی لمس کنید و با دکمه ثبت، واژه را بسازید. واژه‌های درست در جدول می‌نشینند.</p>
      <div className="switch-row">
        <div>
          <strong>صدا</strong>
          <div className="fine">نوای مقدمه و تأیید واژه‌ها</div>
        </div>
        <button type="button" className="switch" aria-pressed={save.sound} onClick={onToggleSound}>
          <i />
        </button>
      </div>
      <div className="switch-row">
        <div>
          <strong>مقدمه سینمایی</strong>
          <div className="fine">هر بار که بازی را باز می‌کنید</div>
        </div>
        <button type="button" className="switch" aria-pressed={!save.skipIntro} onClick={onToggleIntro}>
          <i />
        </button>
      </div>
      {confirmReset ? (
        <div className="stack">
          <p className="help">پیشرفت، سکه‌ها و مرحله‌ها پاک می‌شوند.</p>
          <button type="button" className="btn-gold" onClick={onReset}>
            بله، از نو
          </button>
          <button type="button" className="btn-line" onClick={onCancelReset}>
            انصراف
          </button>
        </div>
      ) : (
        <div className="stack">
          <button type="button" className="btn-line" onClick={onAskReset}>
            بازنشانی پیشرفت
          </button>
        </div>
      )}
    </section>
  );
}

function Play({
  level,
  save,
  commit,
  onHome,
  onSettings,
  onPlay,
}: {
  level: Level;
  save: Save;
  commit: (next: Save) => void;
  onHome: () => void;
  onSettings: () => void;
  onPlay: (id: number) => void;
}) {
  const [path, setPathState] = useState<number[]>([]);
  const [order, setOrder] = useState(() => level.beads.map((_, index) => index));
  const [toast, setToast] = useState<{ text: string; tone: Tone } | null>(null);
  const [shake, setShake] = useState(false);
  const [fresh, setFresh] = useState<string[]>([]);
  const [won, setWon] = useState(false);
  const [reward, setReward] = useState(0);
  const [box, setBox] = useState({ w: 320, h: 280 });
  const pathRef = useRef<number[]>([]);
  const tapChain = useRef(false);
  const lock = useRef(false);
  const gesture = useRef({ active: false, moved: false, x: 0, y: 0, start: -1 });
  const beadRefs = useRef(new Map<number, HTMLButtonElement>());
  const boardRef = useRef<HTMLDivElement>(null);
  const toastTimer = useRef(0);
  const saveRef = useRef(save);
  saveRef.current = save;

  const found = foundOf(save, level);
  const hints = new Set(save.hints[String(level.id)] ?? []);
  const idKey = String(level.id);

  function setPath(next: number[]) {
    pathRef.current = next;
    setPathState(next);
  }

  function showToast(text: string, tone: Tone) {
    setToast({ text, tone });
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 1500);
  }

  function cellVisible(cell: Cell) {
    if (hints.has(`${cell.r},${cell.c}`)) return true;
    return cell.words.some((index) => found.includes(level.words[index] ?? ""));
  }

  function submit(ids: number[]) {
    if (lock.current) return;
    const word = normWord(ids.map((index) => level.beads[index] ?? "").join(""));
    setPath([]);
    tapChain.current = false;
    if ([...word].length < 2) return;
    lock.current = true;
    queueMicrotask(() => {
      lock.current = false;
    });
    const current = saveRef.current;
    const have = foundOf(current, level);
    if (!level.words.includes(word)) {
      showToast("این واژه در جدول این مرحله نیست", "bad");
      setShake(true);
      window.setTimeout(() => setShake(false), 380);
      playBad();
      navigator.vibrate?.(30);
      return;
    }
    if (have.includes(word)) {
      showToast("این واژه را قبلاً پیدا کردی", "info");
      playDup();
      return;
    }
    const nextFound = [...have, word];
    const complete = nextFound.length === level.words.length;
    const paid = current.paidWords[idKey] ?? [];
    const wordPay = paid.includes(word) ? 0 : WORD_PAY;
    const clearPay = complete && !current.paidBonus.includes(level.id) ? CLEAR_PAY : 0;
    const wordIndex = level.words.indexOf(word);
    setFresh(level.layout.cells.filter((cell) => cell.words.includes(wordIndex)).map((cell) => `${cell.r},${cell.c}`));
    const next: Save = {
      ...current,
      coins: current.coins + wordPay + clearPay,
      frontier: complete && level.id === current.frontier ? Math.min(201, current.frontier + 1) : current.frontier,
      solved: { ...current.solved, [idKey]: nextFound },
      paidWords: { ...current.paidWords, [idKey]: paid.includes(word) ? paid : [...paid, word] },
      paidBonus: clearPay ? [...current.paidBonus, level.id] : current.paidBonus,
    };
    commit(next);
    playOk();
    navigator.vibrate?.(12);
    if (complete) {
      const firstTime = !current.paidBonus.includes(level.id);
      setReward(firstTime ? level.words.length * WORD_PAY + CLEAR_PAY : 0);
      setWon(true);
      window.setTimeout(() => playWin(), 260);
    } else {
      showToast(`«${word}» نشست توی جدول`, "ok");
    }
  }

  const submitRef = useRef(submit);
  submitRef.current = submit;

  useEffect(() => {
    const move = (event: PointerEvent) => {
      const g = gesture.current;
      if (!g.active) return;
      if (!g.moved && Math.hypot(event.clientX - g.x, event.clientY - g.y) > 8) {
        g.moved = true;
        tapChain.current = false;
        setPath([g.start]);
      }
      if (!g.moved) return;
      const hit = nearest(event.clientX, event.clientY);
      if (hit === null || pathRef.current.includes(hit)) return;
      setPath([...pathRef.current, hit]);
      playTap();
    };
    const up = () => {
      const g = gesture.current;
      if (!g.active) return;
      g.active = false;
      if (g.moved) {
        const chosen = pathRef.current;
        setPath([]);
        tapChain.current = false;
        submitRef.current(chosen);
      } else {
        tapChain.current = true;
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [level.id]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (won) return;
      if (event.key === "Backspace") {
        event.preventDefault();
        setPath(pathRef.current.slice(0, -1));
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        submitRef.current(pathRef.current);
        return;
      }
      if (event.key === "Escape") {
        setPath([]);
        return;
      }
      const ch = normWord(event.key);
      if ([...ch].length !== 1) return;
      const bead = level.beads.findIndex((letter, index) => letter === ch && !pathRef.current.includes(index));
      if (bead < 0) return;
      event.preventDefault();
      setPath([...pathRef.current, bead]);
      playTap();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [level.id, won]);

  useEffect(() => {
    window.__oos = {
      submitWord(word: string) {
        const ids: number[] = [];
        for (const ch of normWord(word)) {
          const bead = level.beads.findIndex((letter, index) => letter === ch && !ids.includes(index));
          if (bead < 0) return;
          ids.push(bead);
        }
        submitRef.current(ids);
      },
      get: () => ({
        screen: "play",
        frontier: saveRef.current.frontier,
        coins: saveRef.current.coins,
        level: level.id,
        found: foundOf(saveRef.current, level),
      }),
    };
  });

  useEffect(() => {
    const node = boardRef.current;
    if (!node) return;
    const measure = () => setBox({ w: node.clientWidth, h: node.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [level.id]);

  function nearest(x: number, y: number) {
    let best: number | null = null;
    let bestD = 42;
    for (const [id, el] of beadRefs.current) {
      const rect = el.getBoundingClientRect();
      const d = Math.hypot(x - (rect.left + rect.width / 2), y - (rect.top + rect.height / 2));
      if (d < rect.width / 2 + 18 && d < bestD) {
        bestD = d;
        best = id;
      }
    }
    return best;
  }

  function onBeadDown(event: React.PointerEvent, id: number) {
    if (won) return;
    event.preventDefault();
    gesture.current = { active: true, moved: false, x: event.clientX, y: event.clientY, start: id };
    if (tapChain.current && pathRef.current.includes(id)) {
      const at = pathRef.current.indexOf(id);
      setPath(pathRef.current.slice(0, at + 1));
    } else if (tapChain.current) {
      setPath([...pathRef.current, id]);
    } else {
      setPath([id]);
    }
    playTap();
  }

  function hint() {
    const current = saveRef.current;
    if (current.coins < HINT_COST) {
      showToast("سکه کافی نداری", "bad");
      playBad();
      return;
    }
    const have = foundOf(current, level);
    const known = new Set(current.hints[idKey] ?? []);
    const hidden = level.layout.cells.filter((cell) => {
      if (known.has(`${cell.r},${cell.c}`)) return false;
      return !cell.words.some((index) => have.includes(level.words[index] ?? ""));
    });
    if (!hidden.length) {
      showToast("حرف پنهانی نمانده؛ واژه‌ها را بساز", "info");
      return;
    }
    const pick = hidden[Math.floor(Math.random() * hidden.length)]!;
    const key = `${pick.r},${pick.c}`;
    commit({
      ...current,
      coins: current.coins - HINT_COST,
      hints: { ...current.hints, [idKey]: [...(current.hints[idKey] ?? []), key] },
    });
    setFresh([key]);
    playOk();
  }

  function shuffle() {
    const next = [...order];
    for (let i = next.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const a = next[i]!;
      const b = next[j]!;
      next[i] = b;
      next[j] = a;
    }
    setOrder(next);
    setPath([]);
    tapChain.current = false;
  }

  const gap = 3;
  const fit = Math.min(
    Math.floor((box.w - 8) / level.layout.cols) - gap,
    Math.floor((box.h - 8) / level.layout.rows) - gap,
  );
  const cell = Math.max(18, Math.min(48, fit || 28));
  const step = cell + gap;
  const bead = Math.round(Math.min(76, Math.max(50, 250 / Math.max(4, level.beads.length))));
  const built = path.map((index) => level.beads[index] ?? "").join("");
  const positions = order.map((beadId, index) => {
    const ang = (Math.PI * 2 * index) / order.length - Math.PI / 2;
    return { beadId, x: 50 + 36 * Math.cos(ang), y: 50 + 36 * Math.sin(ang) };
  });
  const pointOf = new Map(positions.map((item) => [item.beadId, item]));
  const line = path
    .map((id) => pointOf.get(id))
    .filter((item): item is { beadId: number; x: number; y: number } => Boolean(item))
    .map((item) => `${item.x},${item.y}`)
    .join(" ");

  const cap = Math.min(save.frontier, 200);

  return (
    <section className="play">
      <header className="play-head">
        <button type="button" className="icon-btn" onClick={onHome} aria-label="خانه">
          <Home size={20} />
        </button>
        <div className="grow">
          <h1>مرحله {fa(level.id)}</h1>
          <p className="sub">
            {chapterOf(level.id)} · {fa(found.length)} از {fa(level.words.length)}
          </p>
        </div>
        <div className="coin-pill">
          <span className="coin-dot" />
          {fa(save.coins)}
        </div>
        <button type="button" className="icon-btn" onClick={onSettings} aria-label="تنظیمات">
          <Settings size={20} />
        </button>
      </header>
      <div className="meter" aria-hidden>
        <span style={{ width: `${(found.length / level.words.length) * 100}%` }} />
      </div>
      <div className="board-wrap" ref={boardRef}>
        <div
          className="board"
          style={{
            width: level.layout.cols * step - gap,
            height: level.layout.rows * step - gap,
            ["--cell" as string]: `${cell}px`,
          }}
        >
          {level.layout.cells.map((cellItem) => {
            const key = `${cellItem.r},${cellItem.c}`;
            const show = cellVisible(cellItem);
            const hinted = hints.has(key) && !cellItem.words.some((index) => found.includes(level.words[index] ?? ""));
            return (
              <span
                key={key}
                className={`cell${show ? " show" : ""}${hinted ? " hinted" : ""}${fresh.includes(key) ? " fresh" : ""}`}
                style={{
                  width: cell,
                  height: cell,
                  left: (level.layout.cols - 1 - cellItem.c) * step,
                  top: cellItem.r * step,
                }}
              >
                {show ? cellItem.ch : ""}
              </span>
            );
          })}
        </div>
      </div>
      {level.id === 1 && found.length === 0 ? <p className="coach">حرف‌ها را بکشید یا لمس کنید، سپس «ثبت» را بزنید.</p> : null}
      <div className={`toast ${toast?.tone ?? ""}`} aria-live="polite">
        {toast?.text ?? ""}
      </div>
      <div className="tray" dir="rtl">
        {built ? built : <span className="ghost">واژه را بساز</span>}
      </div>
      <div className="wheel-wrap">
        <div className={shake ? "wheel shake" : "wheel"} style={{ ["--bead" as string]: `${bead}px` }}>
          <svg className="links" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet">
            {path.length > 1 ? <polyline points={line} /> : null}
          </svg>
          {positions.map((item) => (
            <button
              key={item.beadId}
              type="button"
              className={path.includes(item.beadId) ? "bead on" : "bead"}
              style={{ left: `${item.x}%`, top: `${item.y}%` }}
              data-bead={item.beadId}
              ref={(node) => {
                if (node) beadRefs.current.set(item.beadId, node);
                else beadRefs.current.delete(item.beadId);
              }}
              onPointerDown={(event) => onBeadDown(event, item.beadId)}
              onContextMenu={(event) => event.preventDefault()}
              aria-label={level.beads[item.beadId]}
            >
              {level.beads[item.beadId]}
            </button>
          ))}
          {path.length >= 2 ? (
            <button type="button" className="commit" onPointerUp={() => submit(pathRef.current)}>
              ثبت
            </button>
          ) : null}
        </div>
      </div>
      <div className="tools">
        <button type="button" className="tool" onClick={() => setPath([])}>
          <Eraser size={18} />
          پاک‌کردن
        </button>
        <button type="button" className="tool" onClick={hint}>
          <Lightbulb size={18} />
          راهنما
          <small>{fa(HINT_COST)} سکه</small>
        </button>
        <button type="button" className="tool" onClick={shuffle}>
          <Shuffle size={18} />
          بر زدن
        </button>
      </div>
      {found.length === level.words.length && !won ? (
        <div className="tools">
          {level.id < 200 ? (
            <button type="button" className="btn-gold" onClick={() => onPlay(Math.min(200, level.id + 1))} disabled={level.id + 1 > cap && save.frontier <= 200}>
              مرحله بعد
            </button>
          ) : null}
          <button
            type="button"
            className="btn-line"
            onClick={() =>
              commit({
                ...save,
                solved: { ...save.solved, [idKey]: [] },
                hints: { ...save.hints, [idKey]: [] },
              })
            }
          >
            دوباره
          </button>
        </div>
      ) : null}
      {won ? (
        <div className="modal" role="dialog" aria-modal="true" aria-labelledby="win-title">
          <div className="confetti" aria-hidden>
            {Array.from({ length: 16 }, (_, index) => (
              <i key={index} style={{ left: `${(index * 6.2) % 100}%`, animationDelay: `${index * 0.04}s`, opacity: 0.8 }} />
            ))}
          </div>
          <article>
            <Seal id="win-seal" className="seal seal-sm" />
            <h2 id="win-title">آفرین! مرحله را کامل کردی</h2>
            <p className="tag">{reward > 0 ? `+${fa(reward)} سکه` : "این مرحله را دوباره ساختی"}</p>
            <div className="stack">
              {level.id < 200 ? (
                <button
                  type="button"
                  className="btn-gold"
                  onClick={() => {
                    setWon(false);
                    onPlay(level.id + 1);
                  }}
                >
                  مرحله بعد
                </button>
              ) : (
                <button type="button" className="btn-gold" onClick={onHome}>
                  بازگشت به خانه
                </button>
              )}
              <button
                type="button"
                className="btn-line"
                onClick={() => {
                  setWon(false);
                  commit({
                    ...saveRef.current,
                    solved: { ...saveRef.current.solved, [idKey]: [] },
                    hints: { ...saveRef.current.hints, [idKey]: [] },
                  });
                }}
              >
                بازی دوباره
              </button>
            </div>
          </article>
        </div>
      ) : null}
    </section>
  );
}
