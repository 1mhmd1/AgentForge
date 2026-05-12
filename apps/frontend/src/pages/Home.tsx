import React, { useEffect, useState, useRef, Suspense, lazy } from "react";
import {
  ArrowRightIcon,
  ChevronDownIcon,
  SpinnerIcon,
  SparkleIcon,
} from "../components/Icons";
import { AGENT_CATALOG, AgentCatalogEntry } from "../api/agents";
import { createRun, listRuns, RunSummary } from "../api/runs";
import { uploadAttachmentTyped, UploadedAttachment } from "../api/files";
import { toApiError } from "../api/client";
import { useViewport } from "../hooks/useViewport";

const OperationsCenter = lazy(() => import("../components/OperationsCenter"));

interface HomeProps {
  onNavigate: (page: string, id?: string) => void;
}

export default function Home({ onNavigate }: HomeProps) {
  const [prompt, setPrompt] = useState("");
  const [agent, setAgent] = useState<AgentCatalogEntry>(AGENT_CATALOG[0]);
  const [agentOpen, setAgentOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<RunSummary[]>([]);
  const [showHero3D, setShowHero3D] = useState(false);
  const [hero3DReady, setHero3DReady] = useState(false);
  const [attachment, setAttachment] = useState<UploadedAttachment | null>(null);
  const [uploading, setUploading] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { isMobile, isTablet } = useViewport();
  const isNarrow = isMobile || isTablet;

  // Hero scales down on small viewports. Headline + min-height shrink so the
  // CTAs stay above the fold without forcing the user to scroll past the 3D.
  const heroMinHeight = isMobile ? 520 : isTablet ? 620 : 720;
  const headingSize = isMobile ? 32 : isTablet ? 40 : 46;
  const subtitleSize = isMobile ? 12 : 13;
  const eyebrowSize = isMobile ? 10 : 11;
  const promptCardPadding = isMobile ? 18 : isTablet ? 24 : 32;
  const ctaPaddingV = isMobile ? 12 : 14;
  const ctaPaddingH = isMobile ? 20 : 32;

  useEffect(() => {
    let cancelled = false;
    listRuns({ page: 1, perPage: 3 })
      .then((res) => {
        if (!cancelled) setRecent(res.items ?? []);
      })
      .catch(() => {
        /* recent runs are optional, ignore */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Defer the heavy three.js scene until the browser is idle so the headline,
  // prompt card, and CTAs paint instantly. Falls back to a short timeout for
  // browsers without requestIdleCallback (Safari).
  useEffect(() => {
    const w = window as any;
    let idleHandle: number | null = null;
    let timeoutHandle: number | null = null;
    const start = () => setShowHero3D(true);
    if (typeof w.requestIdleCallback === "function") {
      idleHandle = w.requestIdleCallback(start, { timeout: 800 });
    } else {
      timeoutHandle = window.setTimeout(start, 200);
    }
    return () => {
      if (idleHandle !== null && typeof w.cancelIdleCallback === "function")
        w.cancelIdleCallback(idleHandle);
      if (timeoutHandle !== null) window.clearTimeout(timeoutHandle);
    };
  }, []);

  // Fade the Canvas in on the frame AFTER mount so the first heavy paint is
  // hidden behind opacity:0 -> 1, smoothing the visual handoff from stand-in.
  useEffect(() => {
    if (!showHero3D) return;
    const id = requestAnimationFrame(() => setHero3DReady(true));
    return () => cancelAnimationFrame(id);
  }, [showHero3D]);

  const autoResize = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(300, Math.max(120, el.scrollHeight)) + "px";
  };

  const handleRun = async () => {
    if (running) return;
    const text = prompt.trim();
    if (!text) {
      setError("Enter a prompt first.");
      return;
    }
    if (agent.domain === "data_transform" && !attachment) {
      setError(
        "Upload a data file (CSV, JSON, XML, or XLSX) before running a transform.",
      );
      return;
    }
    setError(null);
    setRunning(true);
    try {
      const created = await createRun({
        prompt: text,
        domain: agent.domain,
        attachmentIds: attachment ? [attachment.id] : undefined,
      });
      onNavigate("run-exec", created.runId);
    } catch (err) {
      const api = toApiError(err);
      setError(api.message || "Could not start run");
      setRunning(false);
    }
  };

  const handleFile = async (file: File | null | undefined) => {
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const att = await uploadAttachmentTyped(file);
      setAttachment(att);
    } catch (err) {
      const api = toApiError(err);
      setError(api.message || "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Clear the attachment when the user switches AWAY from data_transform.
  // Keeps the UI honest: an upload only makes sense for that domain.
  useEffect(() => {
    if (agent.domain !== "data_transform" && attachment) {
      setAttachment(null);
    }
  }, [agent.domain, attachment]);

  return (
    <>
      {/* Full-width hero — escapes the centered max-width container so the office reads edge-to-edge */}
      <section style={{ ...s.hero, minHeight: heroMinHeight }}>
        {/* Static stand-in: a cheap radial gradient that resembles the office
            floor glow. Always painted, so the hero never looks empty while the
            3D scene is being deferred / downloaded. */}
        <div aria-hidden="true" style={s.heroStandIn} />
        {showHero3D && (
          <div style={{ ...s.heroCanvasFade, opacity: hero3DReady ? 1 : 0 }}>
            <Suspense fallback={<HeroLoader />}>
              <OperationsCenter height={heroMinHeight} />
            </Suspense>
          </div>
        )}
        {/* Headline + CTAs as a single block inside the violet wall screen */}
        <div
          style={{
            ...s.heroTextScreen,
            top: isMobile ? 16 : 30,
            padding: isMobile ? "0 16px" : "0 24px",
          }}
        >
          <div
            style={{
              ...s.eyebrow,
              fontSize: eyebrowSize,
              opacity: 0,
              animation: "fadeIn 600ms var(--ease-spring) both",
            }}
          >
            <SparkleIcon style={{ width: 12, height: 12 }} /> AUTONOMOUS AGENT
            OPERATIONS CENTER
          </div>
          <h1 style={{ ...s.heading, fontSize: headingSize }}>
            <span
              style={{
                display: "inline-block",
                opacity: 0,
                animation: "fadeIn 750ms var(--ease-spring) 0ms both",
              }}
            >
              Build{" "}
            </span>
            <span
              style={{
                display: "inline-block",
                opacity: 0,
                animation: "fadeIn 750ms var(--ease-spring) 120ms both",
              }}
            >
              AI{" "}
            </span>
            <span
              style={{
                display: "inline-block",
                opacity: 0,
                animation: "fadeIn 750ms var(--ease-spring) 240ms both",
              }}
            >
              Agents
            </span>
            <br />
            <span
              style={{
                display: "inline-block",
                opacity: 0,
                animation: "fadeIn 750ms var(--ease-spring) 480ms both",
                background:
                  "linear-gradient(135deg, #7C3AED 0%, #3B82F6 50%, #06B6D4 100%)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Instantly.
            </span>
          </h1>
          <p
            style={{
              ...s.subtitle,
              fontSize: subtitleSize,
              opacity: 0,
              animation: "fadeIn 600ms var(--ease-spring) 400ms both",
            }}
          >
            A live ecosystem of autonomous agents thinking, building, and
            coordinating in real time. Describe what you want — your fleet ships
            it.
          </p>
        </div>

        {/* CTAs sit INSIDE the hero, in the floor area below the office row.
            Anchoring to the hero's bottom rather than the document flow keeps
            them visually grouped with the scene instead of drifting down the
            page. */}
        <div style={{ ...s.heroCTABand, bottom: isMobile ? 32 : 96 }}>
          <div
            style={{
              ...s.ctaRow,
              flexDirection: isMobile ? "column" : "row",
              opacity: 0,
              animation: "fadeIn 600ms var(--ease-spring) 600ms both",
            }}
          >
            <PrimaryCTA
              padV={ctaPaddingV}
              padH={ctaPaddingH}
              onClick={() => taRef.current?.focus()}
            >
              Start Building{" "}
              <ArrowRightIcon style={{ width: 14, height: 14 }} />
            </PrimaryCTA>
            <GhostCTA
              padV={ctaPaddingV}
              padH={ctaPaddingH}
              onClick={() => {
                const sample =
                  "Build a landing page for an AI-powered note-taking app, with a hero, three feature cards, and a pricing CTA.";
                setPrompt(sample);
                setAgent(
                  AGENT_CATALOG.find((a) => a.domain === "website_builder") ??
                    AGENT_CATALOG[0],
                );
                requestAnimationFrame(() => {
                  const ta = taRef.current;
                  if (ta) {
                    ta.focus();
                    autoResize(ta);
                    ta.scrollIntoView({ behavior: "smooth", block: "center" });
                  }
                });
              }}
            >
              View Demo
            </GhostCTA>
          </div>
        </div>
      </section>

      {/* Centered content below the hero */}
      <div data-responsive-root style={s.root}>
        <section
          id="prompt-section"
          style={{
            ...s.promptWrap,
            animation: "cardEntry 800ms var(--ease-spring) 700ms both",
          }}
        >
          <div
            style={{
              ...s.promptCard,
              padding: promptCardPadding,
              ...(focused
                ? {
                    borderColor: "rgba(124,58,237,0.5)",
                    boxShadow:
                      "0 0 0 1px rgba(124,58,237,0.25), 0 20px 60px rgba(0,0,0,0.5), 0 0 40px rgba(124,58,237,0.18), inset 0 1px 0 rgba(255,255,255,0.05)",
                  }
                : {}),
            }}
          >
            <textarea
              ref={taRef}
              value={prompt}
              onChange={(e) => {
                setPrompt(e.target.value);
                autoResize(e.target);
              }}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder={
                agent.domain === "data_transform"
                  ? 'Describe the desired output (e.g., "convert to JSON", "to CSV with columns name,email,phone", "extract addresses as JSONL")…'
                  : "Describe what you want the agent to do…"
              }
              style={s.textarea}
            />
            {agent.domain === "data_transform" && (
              <FileUploadBlock
                attachment={attachment}
                uploading={uploading}
                onPick={() => fileInputRef.current?.click()}
                onClear={() => setAttachment(null)}
              />
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.tsv,.tab,.json,.jsonl,.ndjson,.xml,.xlsx,.txt,.md"
              onChange={(e) => handleFile(e.target.files?.[0])}
              aria-label="Upload data file"
              title="Upload data file"
              style={{ display: "none" }}
            />
            {error && <div style={s.error}>{error}</div>}
            <div
              style={{
                ...s.promptBottom,
                flexDirection: isNarrow ? "column" : "row",
                alignItems: isNarrow ? "stretch" : "center",
                gap: isNarrow ? 12 : 0,
              }}
            >
              <AgentSelector
                value={agent}
                onChange={setAgent}
                open={agentOpen}
                setOpen={setAgentOpen}
                fullWidth={isNarrow}
              />
              <RunButton
                running={running}
                onClick={handleRun}
                fullWidth={isNarrow}
              />
            </div>
          </div>
        </section>

        {recent.length > 0 && (
          <section style={s.recentWrap}>
            <div style={s.recentLabel}>Recent Runs</div>
            <div style={s.recentList}>
              {recent.map((r, i) => (
                <RunRowCard
                  key={r.id}
                  run={r}
                  index={i}
                  onClick={() => onNavigate("run-exec", r.id)}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}

function HeroLoader() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        display: "grid",
        placeItems: "center",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 14,
          opacity: 0.85,
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            border: "2px solid rgba(124,58,237,0.18)",
            borderTopColor: "#7C3AED",
            borderRightColor: "#3B82F6",
            animation: "spin-conic 1.1s linear infinite",
            boxShadow: "0 0 24px rgba(124,58,237,0.45)",
          }}
        />
        <div
          style={{
            fontFamily: "JetBrains Mono, monospace",
            fontSize: 10,
            letterSpacing: "0.22em",
            color: "#67E8F9",
            textShadow: "0 0 12px rgba(6,182,212,0.55)",
          }}
        >
          INITIALIZING OPERATIONS CENTER
        </div>
      </div>
    </div>
  );
}

function PrimaryCTA({
  children,
  onClick,
  padV = 14,
  padH = 32,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  padV?: number;
  padH?: number;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        padding: `${padV}px ${padH}px`,
        borderRadius: 10,
        background: "linear-gradient(135deg, #7C3AED, #3B82F6)",
        color: "white",
        fontFamily: "Inter, sans-serif",
        fontWeight: 600,
        fontSize: 15,
        border: "none",
        cursor: "pointer",
        boxShadow: hover
          ? "0 0 50px rgba(124,58,237,0.6), 0 4px 15px rgba(0,0,0,0.3)"
          : "0 0 30px rgba(124,58,237,0.4), 0 4px 15px rgba(0,0,0,0.3)",
        transform: hover ? "scale(1.04)" : "scale(1)",
        transition: "all 200ms cubic-bezier(0.34, 1.56, 0.64, 1)",
      }}
    >
      {children}
    </button>
  );
}

function GhostCTA({
  children,
  onClick,
  padV = 14,
  padH = 32,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  padV?: number;
  padH?: number;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: `${padV}px ${padH}px`,
        borderRadius: 10,
        background: hover ? "rgba(124,58,237,0.08)" : "transparent",
        border: `1px solid ${hover ? "rgba(124,58,237,0.5)" : "rgba(148,163,184,0.3)"}`,
        color: hover ? "#E2E8F0" : "#94A3B8",
        fontFamily: "Inter, sans-serif",
        fontWeight: 500,
        fontSize: 15,
        cursor: "pointer",
        transition: "all 200ms ease",
      }}
    >
      {children}
    </button>
  );
}

function AgentSelector({
  value,
  onChange,
  open,
  setOpen,
  fullWidth,
}: {
  value: AgentCatalogEntry;
  onChange: (a: AgentCatalogEntry) => void;
  open: boolean;
  setOpen: (v: boolean) => void;
  fullWidth?: boolean;
}) {
  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: fullWidth ? "space-between" : "center",
          gap: 10,
          width: fullWidth ? "100%" : "auto",
          background: "rgba(9,14,26,0.9)",
          border: "1px solid rgba(26,39,64,0.8)",
          borderRadius: 10,
          padding: "10px 16px",
          color: "#94A3B8",
          fontSize: 14,
          fontFamily: "Inter, sans-serif",
          cursor: "pointer",
        }}
      >
        <span>{value.emoji}</span>
        <span>{value.name}</span>
        <ChevronDownIcon
          style={{
            width: 14,
            height: 14,
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 200ms ease",
          }}
        />
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            right: fullWidth ? 0 : "auto",
            minWidth: fullWidth ? "unset" : 240,
            width: fullWidth ? "100%" : "auto",
            background: "rgba(9,14,26,0.98)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(124,58,237,0.3)",
            borderRadius: 12,
            boxShadow:
              "0 20px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(124,58,237,0.15)",
            padding: 6,
            zIndex: 50,
            transformOrigin: "top left",
            animation: "dropIn 150ms ease",
          }}
        >
          {AGENT_CATALOG.map((a) => (
            <DropdownOption
              key={a.id}
              agent={a}
              active={a.id === value.id}
              onClick={() => {
                onChange(a);
                setOpen(false);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DropdownOption({
  agent,
  active,
  onClick,
}: {
  agent: AgentCatalogEntry;
  active: boolean;
  onClick: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        width: "100%",
        padding: "10px 12px",
        background: hover ? "rgba(124,58,237,0.12)" : "transparent",
        border: "none",
        borderLeft: `2px solid ${hover ? "#7C3AED" : "transparent"}`,
        color: hover || active ? "#E2E8F0" : "#94A3B8",
        fontSize: 14,
        fontFamily: "Inter, sans-serif",
        cursor: "pointer",
        textAlign: "left",
        borderRadius: 6,
        transition: "all 150ms ease",
      }}
    >
      <span>{agent.emoji}</span>
      <span>{agent.name}</span>
    </button>
  );
}

function RunButton({
  running,
  onClick,
  fullWidth,
}: {
  running: boolean;
  onClick: () => void;
  fullWidth?: boolean;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      disabled={running}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        width: fullWidth ? "100%" : "auto",
        padding: fullWidth ? "12px 18px" : "12px 28px",
        borderRadius: 10,
        background: running
          ? "linear-gradient(90deg, #7C3AED, #3B82F6, #06B6D4, #7C3AED)"
          : "linear-gradient(135deg, #7C3AED, #3B82F6)",
        backgroundSize: running ? "300% 100%" : "100% 100%",
        animation: running ? "shimmer 1.5s linear infinite" : "none",
        color: "white",
        fontFamily: "Inter, sans-serif",
        fontWeight: 600,
        fontSize: 15,
        border: "none",
        cursor: running ? "not-allowed" : "pointer",
        boxShadow:
          hover && !running
            ? "0 0 45px rgba(124,58,237,0.55), 0 0 80px rgba(59,130,246,0.2)"
            : "0 0 25px rgba(124,58,237,0.35)",
        transform: hover && !running ? "scale(1.04)" : "scale(1)",
        transition:
          "transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 200ms ease",
      }}
    >
      {running ? (
        <>
          <SpinnerIcon size={14} /> Starting…
        </>
      ) : (
        "Run Agent"
      )}
    </button>
  );
}

function FileUploadBlock({
  attachment,
  uploading,
  onPick,
  onClear,
}: {
  attachment: UploadedAttachment | null;
  uploading: boolean;
  onPick: () => void;
  onClear: () => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  if (attachment) {
    return (
      <div
        style={{
          marginTop: 14,
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "12px 14px",
          background: "rgba(34,197,94,0.06)",
          border: "1px solid rgba(34,197,94,0.35)",
          borderRadius: 10,
          fontFamily: "Inter, sans-serif",
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: "#22C55E",
            boxShadow: "0 0 8px rgba(34,197,94,0.7)",
          }}
        />
        <span
          style={{
            flex: 1,
            color: "#E2E8F0",
            fontSize: 13,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {attachment.filename}
        </span>
        <span
          style={{
            fontSize: 11,
            color: "#64748B",
            fontFamily: "JetBrains Mono, monospace",
          }}
        >
          {formatBytes(attachment.sizeBytes)}
        </span>
        <button
          type="button"
          onClick={onClear}
          style={{
            background: "transparent",
            border: "1px solid rgba(148,163,184,0.25)",
            borderRadius: 6,
            padding: "4px 10px",
            cursor: "pointer",
            color: "#94A3B8",
            fontSize: 12,
            fontFamily: "Inter, sans-serif",
          }}
        >
          Remove
        </button>
      </div>
    );
  }
  return (
    <div
      onClick={onPick}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const f = e.dataTransfer.files?.[0];
        if (f) {
          const input = e.currentTarget.parentElement?.querySelector(
            'input[type="file"]',
          ) as HTMLInputElement | null;
          if (input) {
            const dt = new DataTransfer();
            dt.items.add(f);
            input.files = dt.files;
            input.dispatchEvent(new Event("change", { bubbles: true }));
          }
        }
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onPick();
        }
      }}
      style={{
        marginTop: 14,
        padding: "14px 16px",
        borderRadius: 10,
        border: `1px dashed ${dragOver ? "rgba(124,58,237,0.6)" : "rgba(148,163,184,0.35)"}`,
        background: dragOver ? "rgba(124,58,237,0.06)" : "rgba(13,20,36,0.4)",
        cursor: uploading ? "wait" : "pointer",
        display: "flex",
        alignItems: "center",
        gap: 12,
        fontFamily: "Inter, sans-serif",
        transition: "all 150ms ease",
      }}
    >
      {uploading ? (
        <>
          <SpinnerIcon size={14} />
          <span style={{ color: "#94A3B8", fontSize: 13 }}>Uploading…</span>
        </>
      ) : (
        <>
          <span style={{ fontSize: 18 }}>📎</span>
          <div style={{ flex: 1, lineHeight: 1.4 }}>
            <div style={{ color: "#E2E8F0", fontSize: 13, fontWeight: 500 }}>
              Drop a data file here, or click to browse
            </div>
            <div style={{ color: "#64748B", fontSize: 11, marginTop: 2 }}>
              CSV / TSV / JSON / JSONL / XML / XLSX · max 5MB
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function RunRowCard({
  run,
  index,
  onClick,
}: {
  run: RunSummary;
  index: number;
  onClick: () => void;
}) {
  const [hover, setHover] = useState(false);
  const statusColors: Record<string, string> = {
    COMPLETED: "#22C55E",
    FAILED: "#EF4444",
    INTERRUPTED: "#EF4444",
    CANCELLED: "#94A3B8",
  };
  const c = statusColors[run.status] ?? "#3B82F6";
  const isRunning = !statusColors[run.status];
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        width: "100%",
        background: "rgba(13,20,36,0.6)",
        border: `1px solid ${hover ? "rgba(124,58,237,0.4)" : "rgba(26,39,64,0.6)"}`,
        borderRadius: 14,
        padding: "16px 20px",
        cursor: "pointer",
        textAlign: "left",
        transform: hover ? "translateY(-3px)" : "translateY(0)",
        boxShadow: hover
          ? "0 0 20px rgba(124,58,237,0.15), 0 8px 30px rgba(0,0,0,0.4)"
          : "none",
        transition: "all 200ms ease",
        animation: `fadeUp 300ms ease ${index * 60}ms both`,
        fontFamily: "Inter, sans-serif",
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: c,
          flex: "0 0 8px",
          boxShadow: `0 0 8px ${c}99`,
          animation: isRunning
            ? "pulse-status 1.2s ease-in-out infinite"
            : "none",
        }}
      />
      <span
        style={{
          fontSize: 14,
          color: "#94A3B8",
          flex: 1,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {run.prompt}
      </span>
      <span
        style={{
          fontSize: 11,
          color: "#475569",
          fontFamily: "JetBrains Mono, monospace",
        }}
      >
        {formatWhen(run.createdAt)}
      </span>
      <span
        style={{
          color: "#475569",
          transform: hover ? "translateX(4px)" : "translateX(0)",
          transition: "transform 200ms ease",
        }}
      >
        →
      </span>
    </button>
  );
}

function formatWhen(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return iso;
  const diff = Date.now() - t;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

const s: Record<string, React.CSSProperties> = {
  root: {
    maxWidth: 1180,
    margin: "0 auto",
    padding: "0 32px 80px",
    position: "relative",
    zIndex: 1,
  },
  hero: {
    position: "relative",
    width: "100%",
    minHeight: 720,
    overflow: "hidden",
  },
  heroStandIn: {
    position: "absolute",
    inset: 0,
    zIndex: 0,
    pointerEvents: "none",
    background:
      "radial-gradient(ellipse 60% 40% at 50% 78%, rgba(124,58,237,0.28) 0%, rgba(124,58,237,0.08) 35%, transparent 65%)," +
      "radial-gradient(ellipse 90% 50% at 50% 100%, rgba(6,182,212,0.18) 0%, transparent 60%)," +
      "linear-gradient(180deg, rgba(5,10,20,0) 0%, rgba(5,10,20,0.55) 70%, rgba(5,10,20,0.9) 100%)",
  },
  heroCanvasFade: {
    position: "absolute",
    inset: 0,
    zIndex: 1,
    transition: "opacity 600ms ease",
  },
  heroContent: { position: "relative", zIndex: 2, pointerEvents: "auto" },
  heroTextScreen: {
    position: "absolute",
    top: 30,
    left: 0,
    right: 0,
    margin: "0 auto",
    zIndex: 3,
    width: "min(620px, 90vw)",
    padding: "0 24px",
    textAlign: "center",
    pointerEvents: "auto",
    animation: "fadeIn 700ms var(--ease-spring) both",
  },
  eyebrow: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: "0.18em",
    color: "#06B6D4",
    border: "1px solid rgba(6,182,212,0.4)",
    background: "rgba(6,182,212,0.12)",
    backdropFilter: "blur(8px)",
    borderRadius: 100,
    padding: "6px 16px",
    marginBottom: 12,
    textShadow: "0 0 12px rgba(6,182,212,0.5)",
  },
  heading: {
    fontSize: 46,
    fontWeight: 800,
    letterSpacing: "-0.035em",
    lineHeight: 1.05,
    color: "#E2E8F0",
    margin: "0 0 12px",
    textShadow:
      "0 0 24px rgba(124,58,237,0.6), 0 0 60px rgba(124,58,237,0.4), 0 0 100px rgba(5,10,20,0.85)",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 13,
    fontWeight: 400,
    color: "#C4CCE0",
    margin: "0 auto",
    maxWidth: 480,
    lineHeight: 1.55,
    textShadow: "0 0 18px rgba(124,58,237,0.4), 0 0 30px rgba(5,10,20,0.9)",
    textAlign: "center",
  },
  ctaRow: { display: "flex", gap: 7, justifyContent: "center" },
  heroCTABand: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 96,
    display: "flex",
    justifyContent: "center",
    padding: "0 24px",
    zIndex: 4,
    pointerEvents: "auto",
  },
  promptWrap: {
    maxWidth: 720,
    margin: "40px auto 0",
    position: "relative",
    zIndex: 10,
  },
  promptCard: {
    position: "relative",
    background: "rgba(13, 20, 36, 0.8)",
    backdropFilter: "blur(24px)",
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: "rgba(26, 39, 64, 0.9)",
    borderRadius: 20,
    padding: 32,
    boxShadow:
      "0 0 0 1px rgba(124,58,237,0.1), 0 20px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)",
    transition: "border-color 300ms ease",
  },
  conicBorder: {
    position: "absolute",
    inset: -1,
    borderRadius: 21,
    background: "conic-gradient(from 0deg, #7C3AED, #3B82F6, #06B6D4, #7C3AED)",
    animation: "spin-conic 3s linear infinite",
    opacity: 0.4,
    zIndex: -1,
    filter: "blur(2px)",
  },
  textarea: {
    width: "100%",
    minHeight: 120,
    maxHeight: 300,
    background: "transparent",
    border: "none",
    outline: "none",
    resize: "none",
    fontFamily: "Inter, sans-serif",
    fontSize: 15,
    color: "#E2E8F0",
    lineHeight: 1.65,
    caretColor: "#7C3AED",
    padding: 0,
    boxSizing: "border-box",
  },
  error: {
    marginTop: 12,
    fontSize: 13,
    color: "#FCA5A5",
    background: "rgba(239,68,68,0.08)",
    border: "1px solid rgba(239,68,68,0.3)",
    padding: "8px 12px",
    borderRadius: 8,
  },
  promptBottom: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 20,
    paddingTop: 20,
    borderTop: "1px solid rgba(26,39,64,0.6)",
  },
  recentWrap: { maxWidth: 720, margin: "60px auto 0" },
  recentLabel: {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: "0.1em",
    color: "#475569",
    textTransform: "uppercase",
    marginBottom: 16,
  },
  recentList: { display: "flex", flexDirection: "column", gap: 10 },
};
