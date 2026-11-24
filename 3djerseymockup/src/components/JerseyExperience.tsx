import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { useGLTF, useProgress } from "@react-three/drei";
import JerseyScene from "./JerseyScene";
import { DEFAULT_KIT, KITS, type Kit } from "../lib/kits";
import { clamp, createSpinState } from "../lib/spin";

type SpinDirection = "left" | "right" | "up" | "down";

const KIT_COUNT = KITS.length.toString().padStart(2, "0");

const ArrowIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
    <path d="M2 7h10M8.5 3.5 12 7l-3.5 3.5" stroke="currentColor" strokeWidth="1.25" />
  </svg>
);

const SpinIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path
      d="M13.2 8A5.2 5.2 0 1 1 8 2.8c1.7 0 3.2.8 4.2 2"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
    />
    <path d="M12.6 2.2v3.2H9.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

function Loader({ done }: { done: boolean }) {
  const { progress } = useProgress();
  const value = done ? 100 : Math.max(0, Math.min(100, progress));

  return (
    <div className={`loader ${done ? "is-done" : ""}`} aria-hidden={done}>
      <div className="loader-top">
        <span className="loader-brand">
          YASH<span>SPORTS</span>
        </span>
        <span className="loader-top-meta">COLLECTION 024 / {KIT_COUNT} KITS</span>
      </div>

      <div className="loader-main">
        <div className="loader-title">
          YASH <span>24</span>
        </div>
        <div className="loader-percent">
          {Math.round(value).toString().padStart(2, "0")}
          <span>%</span>
        </div>
      </div>

      <div className="loader-bottom">
        <div className="loader-status">
          <span>BUILDING THE 3D KIT</span>
          <span>COLLECTION 024 / {KIT_COUNT} KITS</span>
        </div>
        <div className="loader-track">
          <i style={{ transform: `scaleX(${value / 100})` }} />
        </div>
      </div>
    </div>
  );
}

function StageProgress({ name }: { name: string }) {
  const { progress } = useProgress();
  const value = Math.max(0, Math.min(100, progress));

  return (
    <div className="stage-status" role="status">
      <div className="stage-status-head">
        <span>LOADING {name}</span>
        <span aria-hidden="true">{Math.round(value).toString().padStart(2, "0")}%</span>
      </div>
      <div className="stage-status-track">
        <i style={{ transform: `scaleX(${value / 100})` }} />
      </div>
    </div>
  );
}

export default function JerseyExperience() {
  const spin = useRef(createSpinState(DEFAULT_KIT.initialYaw));
  const stageRef = useRef<HTMLDivElement>(null);
  const lastPointer = useRef({ x: 0, y: 0 });

  const [kitId, setKitId] = useState(DEFAULT_KIT.id);
  const [loaded, setLoaded] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [autoRotate, setAutoRotate] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);

  const kit = KITS.find((item) => item.id === kitId) ?? DEFAULT_KIT;

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      setReducedMotion(query.matches);
      if (query.matches) setAutoRotate(false);
    };

    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const timer = window.setTimeout(() => setRevealed(true), 380);
    return () => window.clearTimeout(timer);
  }, [loaded]);

  useEffect(() => {
    document.title = `${kit.name} — Yash Sports | Interactive 3D Jersey`;
  }, [kit.name]);

  const handleLoaded = useCallback(() => {
    setLoaded(true);
    setSwitching(false);
  }, []);

  const selectKit = useCallback(
    (next: Kit) => {
      if (next.id === kitId) return;

      spin.current = createSpinState(next.initialYaw);
      setKitId(next.id);
      setSwitching(true);
    },
    [kitId],
  );

  const resetView = useCallback(() => {
    spin.current.yaw = kit.initialYaw;
    spin.current.pitch = 0;
    spin.current.velocity = 0;
    setAutoRotate(!reducedMotion);
  }, [kit.initialYaw, reducedMotion]);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    spin.current.dragging = true;
    spin.current.velocity = 0;
    lastPointer.current = { x: event.clientX, y: event.clientY };
    setDragging(true);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const stage = stageRef.current;
    if (!stage) return;

    const rect = stage.getBoundingClientRect();
    spin.current.pointerX = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
    spin.current.pointerY = ((event.clientY - rect.top) / rect.height - 0.5) * 2;

    if (!spin.current.dragging) return;

    const dx = event.clientX - lastPointer.current.x;
    const dy = event.clientY - lastPointer.current.y;

    spin.current.yaw += dx * 0.0072;
    spin.current.pitch = clamp(spin.current.pitch + dy * 0.0035, -0.28, 0.28);
    spin.current.velocity = dx * 0.28;
    lastPointer.current = { x: event.clientX, y: event.clientY };
  };

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (!spin.current.dragging) return;

    spin.current.dragging = false;
    setDragging(false);

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handlePointerLeave = () => {
    if (spin.current.dragging) return;
    spin.current.pointerX = 0;
    spin.current.pointerY = 0;
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = 0.16;
    const directions: Partial<Record<string, SpinDirection>> = {
      ArrowLeft: "left",
      ArrowRight: "right",
      ArrowUp: "up",
      ArrowDown: "down",
    };
    const direction = directions[event.key];
    if (!direction) return;

    event.preventDefault();
    if (direction === "left") spin.current.yaw -= step;
    if (direction === "right") spin.current.yaw += step;
    if (direction === "up") spin.current.pitch = clamp(spin.current.pitch - step * 0.5, -0.28, 0.28);
    if (direction === "down") spin.current.pitch = clamp(spin.current.pitch + step * 0.5, -0.28, 0.28);
  };

  return (
    <div className={`site kit-${kit.id} ${revealed ? "is-ready" : ""}`}>
      <div className="ambient" aria-hidden="true" />
      <div className="grain" aria-hidden="true" />
      <Loader done={loaded} />

      <header className="nav">
        <a className="brand" href="/" aria-label="Yash Sports home">
          <span className="brand-mark">YS</span>
          <span className="brand-text">
            <strong>YASH</strong>
            <small>SPORTS / 024</small>
          </span>
        </a>

        <span className="nav-center">COLLECTION 024 — {KIT_COUNT} KITS</span>

        <div className="nav-right">
          <span className="live">
            <i aria-hidden="true" /> LIVE 3D
          </span>
          <a className="nav-link" href="#kit">
            THE KITS <span aria-hidden="true">↗</span>
          </a>
        </div>
      </header>

      <main className="hero">
        <div className="stage-bg" aria-hidden="true">
          <div className="stage-glow" />
          <div key={kit.id} className={`stage-number ${kit.stageScript ? "is-script" : ""}`}>
            {kit.stageNumber}
          </div>
          <div className="stage-rule" />
        </div>

        <div
          ref={stageRef}
          className={`stage-hit ${dragging ? "is-dragging" : ""}`}
          role="group"
          tabIndex={0}
          aria-busy={switching}
          aria-label="Interactive 3D jersey. Drag, or use the arrow keys, to rotate the jersey."
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onPointerLeave={handlePointerLeave}
          onDoubleClick={resetView}
          onKeyDown={handleKeyDown}
        >
          <JerseyScene
            kit={kit}
            start={loaded}
            autoRotate={autoRotate}
            spin={spin}
            onLoaded={handleLoaded}
            reducedMotion={reducedMotion}
          />
          {switching && <StageProgress name={kit.name} />}
        </div>

        <section className="copy">
          <h1>
            <span className="line">
              <span>{kit.headline.first}</span>
            </span>
            <span className="line">
              <span>
                {kit.headline.lastLead}
                <em>{kit.headline.lastAccent}</em>
              </span>
            </span>
          </h1>

          <p className="lede">{kit.lede}</p>

          <div className="actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setAutoRotate((value) => !value)}
              aria-pressed={autoRotate}
              disabled={reducedMotion}
              title={reducedMotion ? "Disabled by your reduced motion preference" : undefined}
            >
              <SpinIcon />
              {reducedMotion ? "MOTION REDUCED" : autoRotate ? "AUTO SPIN ON" : "AUTO SPIN OFF"}
            </button>
            <button type="button" className="btn btn-ghost" onClick={resetView}>
              RESET VIEW
              <ArrowIcon />
            </button>
          </div>

          <div className="kits" role="group" aria-label="Choose a jersey kit">
            <div className="kits-head">
              <span>SELECT KIT</span>
              <span>{KIT_COUNT} KITS</span>
            </div>
            <div className="kits-options">
              {KITS.map((option) => {
                const active = option.id === kit.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    className={`kit-tab ${active ? "is-active" : ""}`}
                    aria-pressed={active}
                    aria-busy={switching && active}
                    onClick={() => selectKit(option)}
                    onPointerEnter={() => useGLTF.preload(option.modelUrl)}
                    onFocus={() => useGLTF.preload(option.modelUrl)}
                  >
                    <span className={`kit-swatch kit-swatch-${option.id}`} aria-hidden="true" />
                    <span className="kit-tab-copy">
                      <strong>{option.name}</strong>
                      <small>{option.edition}</small>
                    </span>
                    <span className="kit-tab-index" aria-hidden="true">
                      {option.index}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <p className="hint">
          <span className="hint-dot" aria-hidden="true" />
          DRAG TO ROTATE — 360°
        </p>
      </main>

      <footer className="specs" id="kit">
        {kit.specs.map((spec) => (
          <article className="spec" key={spec.title}>
            <div>
              <h3>{spec.title}</h3>
              {spec.script && (
                <p className="spec-script" lang="mr">
                  {spec.script}
                </p>
              )}
              <p className={spec.script ? "spec-caption" : undefined}>{spec.body}</p>
            </div>
          </article>
        ))}

        <div className="player-badge">
          <span className={`player-number ${kit.badge.script ? "is-script" : ""}`}>
            {kit.badge.mark}
          </span>
          <span className="player-meta">
            {kit.badge.meta[0]}
            <br />
            {kit.badge.meta[1]}
          </span>
        </div>
      </footer>
    </div>
  );
}
