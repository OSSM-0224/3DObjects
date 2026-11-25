import {
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent,
} from "react";
import { Canvas } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import * as THREE from "three";
import TemplateJersey from "./TemplateJersey";
import { getDesigns, type DesignCategory, type JerseyDesign } from "../lib/designs";
import { preloadDesignTextures, pruneDesignTextures } from "../lib/designTextures";
import { clamp, createSpinState } from "../lib/spin";
import "../design-showcase.css";

const PAGE_SIZE = 24;
const FILTERS: Array<"all" | DesignCategory> = ["all", "sports", "festival", "commercial"];

function SpinIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M13.2 8A5.2 5.2 0 1 1 8 2.8c1.7 0 3.2.8 4.2 2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M12.6 2.2v3.2H9.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function StudioLights() {
  return (
    <>
      <hemisphereLight intensity={0.55} color="#d8d2c6" groundColor="#050505" />
      <directionalLight position={[3.5, 4.5, 5]} intensity={3.1} color="#fff2e2" />
      <directionalLight position={[-4.5, 1.5, -3]} intensity={3.4} color="#ff5a24" />
      <directionalLight position={[4, 2, -4]} intensity={1.9} color="#c7d6ff" />
      <pointLight position={[0, 0.4, 3.2]} intensity={9} distance={9} color="#ffe9d2" />
      <Environment resolution={256} frames={1}>
        <Lightformer form="rect" intensity={2.8} position={[0, 5, -6]} scale={[12, 8, 1]} color="#fff6e8" />
        <Lightformer form="rect" intensity={3.4} position={[-5, 1, 3]} scale={[3, 7, 1]} color="#ff6a2e" />
        <Lightformer form="rect" intensity={1.5} position={[5, 1, 2]} scale={[3, 6, 1]} color="#c7d8ff" />
        <Lightformer form="rect" intensity={0.8} position={[0, -4, 2]} scale={[9, 2, 1]} color="#f0ede6" />
      </Environment>
    </>
  );
}

export default function DesignShowcase() {
  const [designs, setDesigns] = useState<JerseyDesign[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<"all" | DesignCategory>("all");
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [autoRotate, setAutoRotate] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);

  const spin = useRef(createSpinState(0.35));
  const intro = useRef(0);
  const stageRef = useRef<HTMLDivElement>(null);
  const lastPointer = useRef({ x: 0, y: 0 });

  useEffect(() => {
    let active = true;
    getDesigns()
      .then((list) => {
        if (!active) return;
        setDesigns(list);
        const requested = new URLSearchParams(window.location.search).get("design");
        setSelectedId(list.find((item) => item.id === requested)?.id ?? list[0]?.id ?? null);
      })
      .catch(() => {
        if (active) setError("Design manifest load nahi hua. Pehle `npm run build:template` chalayein.");
      });
    return () => {
      active = false;
    };
  }, []);

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
    document.title = "Design Showcase — Yash Sports | One Template, 500 Designs";
  }, []);

  const filtered = category === "all" ? designs : designs.filter((item) => item.category === category);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const visible = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  const selected = designs.find((item) => item.id === selectedId) ?? designs[0] ?? null;
  const selectedIndex = selected ? designs.findIndex((item) => item.id === selected.id) : -1;

  useEffect(() => {
    if (!selected || selectedIndex < 0) return;
    const urls = [
      selected.image,
      designs[selectedIndex - 1]?.image,
      designs[selectedIndex + 1]?.image,
    ].filter((url): url is string => Boolean(url));

    preloadDesignTextures(urls);
    pruneDesignTextures(urls);
  }, [selected, selectedIndex, designs]);

  const handleLoaded = useCallback(() => setLoaded(true), []);

  const selectDesign = useCallback((id: string) => {
    // Texture swap, not a reload: keep the viewer mounted and the intro state.
    setSelectedId(id);
  }, []);

  const stepDesign = useCallback(
    (direction: number) => {
      if (!selected || designs.length === 0) return;
      const next = (selectedIndex + direction + designs.length) % designs.length;
      selectDesign(designs[next].id);
    },
    [designs, selected, selectedIndex, selectDesign],
  );

  const resetView = useCallback(() => {
    spin.current.yaw = 0.35;
    spin.current.pitch = 0;
    spin.current.velocity = 0;
    setAutoRotate(!reducedMotion);
  }, [reducedMotion]);

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
    const directions: Record<string, "left" | "right" | "up" | "down"> = {
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
    <div className="ds-site">
      <header className="ds-nav">
        <a className="ds-brand" href="/" aria-label="Yash Sports home">
          <span className="ds-brand-mark">YS</span>
          <span>
            <strong>YASH</strong>
            <small>SPORTS / ONE TEMPLATE</small>
          </span>
        </a>
        <span className="ds-nav-meta">DESIGN SHOWCASE — {designs.length.toString().padStart(3, "0")} DESIGNS</span>
        <a className="ds-nav-link" href="/">BACK TO 3D KITS ↗</a>
      </header>

      <main className="ds-main">
        <section className="ds-hero">
          <div className="ds-intro">
            <p className="ds-eyebrow">ONE GLB / RUNTIME TEXTURE SWAP</p>
            <h1>
              One jersey.
              <br />
              <em>Every design.</em>
            </h1>
            <p className="ds-lede">
              Har nayi design sirf ek image aur manifest entry hai. 3D model baar-baar banana nahi padta —
              texture live swap hoti hai, aur cuff ka rang design ke accent se match karta hai.
            </p>
            <div className="ds-actions">
              <button
                type="button"
                className="ds-btn ds-btn-primary"
                onClick={() => setAutoRotate((value) => !value)}
                aria-pressed={autoRotate}
                disabled={reducedMotion}
              >
                <SpinIcon />
                {reducedMotion ? "MOTION REDUCED" : autoRotate ? "AUTO SPIN ON" : "AUTO SPIN OFF"}
              </button>
              <button type="button" className="ds-btn ds-btn-ghost" onClick={resetView}>
                RESET VIEW
              </button>
            </div>
            <a className="ds-guide-link" href="/templates/jersey-uv-guide.png" target="_blank" rel="noreferrer">
              UV DESIGN GUIDE ↗
            </a>
          </div>

          <div
            ref={stageRef}
            className={`ds-stage ${dragging ? "is-dragging" : ""}`}
            role="group"
            tabIndex={0}
            aria-label="Interactive 3D jersey. Drag or use arrow keys to rotate."
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onPointerLeave={handlePointerLeave}
            onDoubleClick={resetView}
            onKeyDown={handleKeyDown}
          >
            <Canvas
              dpr={[1, 1.8]}
              camera={{ fov: 30, position: [0, 0.1, 9], near: 0.1, far: 100 }}
              gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
              onCreated={({ gl }) => {
                gl.toneMapping = THREE.ACESFilmicToneMapping;
                gl.toneMappingExposure = 1.08;
              }}
            >
              <Suspense fallback={null}>
                <StudioLights />
                {selected && (
                  <TemplateJersey
                    design={selected}
                    start={loaded}
                    autoRotate={autoRotate}
                    spinRef={spin}
                    introRef={intro}
                    reducedMotion={reducedMotion}
                    baseX={0}
                    baseY={0}
                    onLoaded={handleLoaded}
                  />
                )}
              </Suspense>
            </Canvas>
            {!loaded && <div className="ds-stage-status">LOADING DESIGN TEXTURE…</div>}
            <p className="ds-hint">DRAG TO ROTATE — 360°</p>
          </div>

          <aside className="ds-detail">
            <div className="ds-detail-head">
              <span>NOW VIEWING</span>
              <span>{selected ? `${selectedIndex + 1} / ${designs.length}` : "—"}</span>
            </div>
            {selected ? (
              <>
                <h2>{selected.title}</h2>
                <p className="ds-detail-category">
                  {selected.category} / {selected.id}
                </p>
                <div className="ds-accent-row">
                  <span>ACCENT</span>
                  <i style={{ background: selected.accent }} aria-hidden="true" />
                  <code>{selected.accent}</code>
                </div>
                <div className="ds-detail-actions">
                  <button type="button" className="ds-btn ds-btn-ghost" onClick={() => stepDesign(-1)}>
                    ← PREV
                  </button>
                  <button type="button" className="ds-btn ds-btn-primary" onClick={() => stepDesign(1)}>
                    NEXT →
                  </button>
                </div>
                <div className="ds-contract">
                  <span>MAINJERSEY ← design texture</span>
                  <span>ENDSLEEVES ← accent colour</span>
                  <span>COLLARTRIM + PLACKETTRIM ← accent colour</span>
                  <span>ONE CANVAS ← all designs</span>
                </div>
              </>
            ) : (
              <p className="ds-empty">{error ?? " designs load ho rahe hain…"}</p>
            )}
          </aside>
        </section>

        <section className="ds-archive" id="designs">
          <div className="ds-archive-head">
            <div>
              <p className="ds-eyebrow">DESIGN ARCHIVE</p>
              <h2>
                Pick a <em>design.</em>
              </h2>
            </div>
            <div className="ds-filters" role="group" aria-label="Filter designs by category">
              {FILTERS.map((filter) => (
                <button
                  type="button"
                  key={filter}
                  className={`ds-filter ${category === filter ? "is-active" : ""}`}
                  aria-pressed={category === filter}
                  onClick={() => {
                    setCategory(filter);
                    setPage(0);
                  }}
                >
                  {filter.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="ds-error">{error}</p>}

          <div className="ds-grid">
            {visible.map((design) => (
              <button
                type="button"
                key={design.id}
                className={`ds-card ${selected?.id === design.id ? "is-active" : ""}`}
                onClick={() => selectDesign(design.id)}
                aria-pressed={selected?.id === design.id}
              >
                <img src={design.thumb} alt={design.title} loading="lazy" />
                <span className="ds-card-tag" style={{ background: design.accent }} aria-hidden="true" />
                <span className="ds-card-meta">
                  {design.category} / {design.id}
                </span>
                <strong>{design.title}</strong>
              </button>
            ))}
          </div>

          {filtered.length === 0 && !error && <p className="ds-empty">Is category me abhi koi design nahi hai.</p>}

          <div className="ds-pagination">
            <button
              type="button"
              className="ds-btn ds-btn-ghost"
              disabled={safePage === 0}
              onClick={() => setPage((value) => Math.max(0, value - 1))}
            >
              ← PREV
            </button>
            <span>
              PAGE {safePage + 1} / {pageCount} — {filtered.length} DESIGNS
            </span>
            <button
              type="button"
              className="ds-btn ds-btn-ghost"
              disabled={safePage >= pageCount - 1}
              onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))}
            >
              NEXT →
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
