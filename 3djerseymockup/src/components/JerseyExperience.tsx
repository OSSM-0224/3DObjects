import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent,
} from "react";
import { useGLTF, useProgress } from "@react-three/drei";
import JerseyScene from "./JerseyScene";
import { DEFAULT_KIT, KITS, type Kit, type KitId } from "../lib/kits";
import { clamp, createSpinState } from "../lib/spin";

type SpinDirection = "left" | "right" | "up" | "down";

const KIT_COUNT = KITS.length.toString().padStart(2, "0");
export const SHARE_KIT_ID: KitId = "slhs";

function getInitialKit(): Kit {
  const requested = new URLSearchParams(window.location.search).get("kit");
  return KITS.find((item) => item.id === requested) ?? DEFAULT_KIT;
}

function getCaptureKit(): Kit | null {
  const requested = new URLSearchParams(window.location.search).get("capture");
  return KITS.find((item) => item.id === requested) ?? null;
}

async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value);
    return;
  } catch {
    const input = document.createElement("textarea");
    input.value = value;
    input.style.position = "fixed";
    input.style.opacity = "0";
    document.body.appendChild(input);
    input.select();
    document.execCommand("copy");
    input.remove();
  }
}

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

export const ShareIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path
      d="M8 10.2V2.6m0 0L5.4 5.2M8 2.6l2.6 2.6M3 8.4v4.1c0 .5.4.9.9.9h8.2c.5 0 .9-.4.9-.9V8.4"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
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

export function ShareModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    setCopied(false);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleEscape);
    const focusTimer = window.setTimeout(() => closeRef.current?.focus(), 40);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleEscape);
      window.clearTimeout(focusTimer);
    };
  }, [open, onClose]);

  if (!open) return null;

  const origin = window.location.origin;
  const shareUrl = `${origin}/share/slhs/`;
  const posterUrl = `${origin}/status/slhs.jpg`;
  const previewUrl = `${origin}/og/slhs.jpg`;

  const handleCopy = async () => {
    await copyText(shareUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2200);
  };

  return (
    <div
      className="share-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="share-modal" role="dialog" aria-modal="true" aria-labelledby="share-title">
        <button
          ref={closeRef}
          type="button"
          className="share-close"
          onClick={onClose}
          aria-label="Close share panel"
        >
          <span aria-hidden="true">×</span>
        </button>

        <div className="share-copy">
          <p className="share-eyebrow">WHATSAPP STATUS KIT / 03</p>
          <h2 id="share-title">
            SHARE <em>SLHS 24</em>
          </h2>
          <p className="share-lede">
            Send the live 3D kit, or download a ready-to-post status image. The link opens a preview
            page first, then the full interactive jersey.
          </p>

          <div className="share-link">
            <span>SHARE LINK</span>
            <div className="share-link-row">
              <input
                type="text"
                readOnly
                value={shareUrl}
                aria-label="SLHS 24 share link"
                onFocus={(event) => event.currentTarget.select()}
              />
              <button type="button" className="btn btn-primary share-copy-btn" onClick={handleCopy}>
                {copied ? "COPIED ✓" : "COPY LINK"}
              </button>
            </div>
          </div>

          <div className="share-actions">
            <a className="btn btn-ghost" href={posterUrl} download="SLHS-24-WhatsApp-Status.jpg">
              DOWNLOAD POSTER <span aria-hidden="true">↓</span>
            </a>
            <a className="share-open" href="/share/slhs/" target="_blank" rel="noreferrer">
              OPEN SHARE PAGE <span aria-hidden="true">↗</span>
            </a>
          </div>

          <p className="share-note">
            Status link previews depend on your WhatsApp version. The 1080 × 1920 poster always works
            — post it directly from your gallery.
          </p>
        </div>

        <div className="share-preview">
          <span className="share-preview-label">WHATSAPP LINK PREVIEW</span>
          <div className="wa-card">
            <img src={previewUrl} alt="SLHS 24 link preview" width="1080" height="1080" />
            <div className="wa-card-body">
              <strong>SLHS 24 — St. Xavier&apos;s Edition</strong>
              <p>
                The St. Xavier&apos;s school kit in live 3D. Maroon marbled cloth, 50-year crest,
                MHATRE 24.
              </p>
              <span>{window.location.host}</span>
            </div>
          </div>
          <div className="share-preview-meta">
            <span>OG IMAGE 1080 × 1080</span>
            <span>POSTER 1080 × 1920</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function CaptureExperience({ kit }: { kit: Kit }) {
  const spin = useRef(createSpinState(kit.initialYaw));

  useEffect(() => {
    document.documentElement.classList.add("capture-mode");
    document.title = `${kit.name} — capture`;

    return () => {
      document.documentElement.classList.remove("capture-mode");
      delete document.documentElement.dataset.captureReady;
    };
  }, [kit.name]);

  const handleLoaded = useCallback(() => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        document.documentElement.dataset.captureReady = "1";
      });
    });
  }, []);

  return (
    <div className="capture" aria-hidden="true">
      <JerseyScene
        kit={kit}
        start
        autoRotate={false}
        spin={spin}
        onLoaded={handleLoaded}
        reducedMotion
        capture
      />
    </div>
  );
}

export default function JerseyExperience() {
  const captureKit = getCaptureKit();
  if (captureKit) return <CaptureExperience kit={captureKit} />;

  return <Experience />;
}

function Experience() {
  const [initialKit] = useState(getInitialKit);
  const spin = useRef(createSpinState(initialKit.initialYaw));
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

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
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
