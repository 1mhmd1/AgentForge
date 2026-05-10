# AgentForge — Project Context & Working Agreement

> **Purpose of this file**: complete handoff document. Drop this into any new session to bring an AI assistant fully up to speed on the codebase, the user's working style, decisions already made, gotchas already hit, and what NOT to do.

---

## 1. The User

- **Email**: rabih@chipatech.com
- **Role**: Founder/builder on AgentForge. Hands-on with code, ships things himself.
- **OS**: Windows 11. PowerShell + Bash both available. Default shell on this machine is PowerShell.
- **Working dir**: `c:\Users\1mhmd\OneDrive\Desktop\Ai Projects\AgentForge`

## 2. Communication style

- Writes in casual English with frequent typos and abbreviations ("u" for "you", "th" for "the", "plz", etc.). **Don't correct grammar — just understand the intent.**
- Submits **numbered lists of bugs/requests** in a single message. Address ALL of them in the same response, not piecemeal.
- Uses **screenshots** to point at issues. Read them carefully — he points at specific elements with specific spatial complaints ("text on the right", "agent behind the screen", "laptop missing").
- Specifies **exact pixel values**: "30px from top", "20px gap", "100px from bottom", "pull up 40px". Use those numbers literally, don't reinterpret.
- "continue" / "ok go" / "do all of them" → **EXECUTE**. Don't ask another decision question.
- When something is wrong, he says it directly and expects a fix in the next turn.

## 3. Hard rules learned from corrections

These are things he has corrected, complained about, or where he visibly lost patience. **Never repeat these.**

1. **Don't claim success on visual features without verifying.** Type-check passing ≠ feature working. Be honest: "tsc clean, but I can't see the runtime visuals — please reload and tell me what to tune."
2. **No fabricated metrics.** Never say "30% faster", "150ms saved" unless you have a number to back it. Cite actual file:line evidence.
3. **Don't dwell on linter hints.** The project has known patterns (inline styles, missing button `type` attributes). Pre-existing warnings should be acknowledged in one line ("pre-existing pattern, ignoring") then moved on. Do **not** refactor them.
4. **Surgical patches only.** No refactoring along the way, no new abstractions, no splitting files unless asked. If a change is 3 lines, make it 3 lines.
5. **Don't ask for approval mid-task.** Once given a green light, execute the whole batch. Asking "should I proceed?" mid-execution wastes his time.
6. **When perf is bad, perf wins over polish.** He has called out slow load multiple times — measure before adding heavy 3D features. R3F bundle is the biggest weight; the project's MeshReflectorMaterial alone was a major culprit.
7. **Read screenshots properly.** When he points at something, find that thing in the DOM/scene and fix it. Don't generalize.

## 4. Project: what AgentForge is

A monorepo for an AI agent platform. Currently three apps:

```
apps/
  ai/         # Python — agent runtime, LLM providers, prompt templates
  backend/    # NestJS — API
  frontend/   # Vite + React 18 + TS — the marketing/console UI
```

There USED to be a `packages/shared/` workspace; it was deleted in commit `f0e401e` (`refactor(shared): remove unused shared package and its files`). The lockfile and package.json had stale references that blocked installs — those were cleaned up. **Do not recreate this package.**

Root `package.json` defines `npm workspaces: ["apps/*", "packages/*"]`. **Deps hoist to the root `node_modules/`**, not to `apps/frontend/node_modules/`. If you `ls apps/frontend/node_modules/three` you'll get nothing — the resolution is hoisted.

Current branch is `frontend`. Main branch is `main`.

Recent commits worth knowing:
- `f0e401e` — removed shared package
- `b381226` — deleted backend modules dir
- `2924abe` — first version of frontend
- `df1b0c8` — backend NestJS migration

## 5. Frontend: tech stack and conventions

### Dependencies (`apps/frontend/package.json`)

```jsonc
"dependencies": {
  "@react-three/drei": "^9.122.0",
  "@react-three/fiber": "^8.18.0",
  "axios": "^1.7.0",
  "react": "^18.3.0",
  "react-dom": "^18.3.0",
  "react-router-dom": "^6.26.0",
  "three": "^0.160.1"
},
"devDependencies": {
  "@types/react": "^18.3.0",
  "@types/react-dom": "^18.3.0",
  "@vitejs/plugin-react": "^4.3.0",
  "autoprefixer": "^10.4.0",
  "postcss": "^8.4.0",
  "tailwindcss": "^3.4.0",
  "typescript": "^5.5.0",
  "vite": "^5.4.0"
}
```

**Note**: there is NO `@types/three`. Modern `three` ships its own types — installing `@types/three` causes "Type X is missing properties" errors because two type trees exist for the same classes. **Do not add `@types/three`.**

### Scripts

- `npm run dev` — Vite dev server on `http://localhost:5173`
- `npm run build` — `tsc && vite build`
- `npm run lint` — eslint
- From root: `npm run dev:frontend`

### Style conventions

- **Inline styles dominate.** Tailwind is installed but mostly unused. The pattern is a `const s: Record<string, React.CSSProperties> = { ... }` at the bottom of each file, referenced as `style={s.foo}`. Linter warns about inline styles on EVERY line — these warnings are ignored and pre-existing. Don't try to "fix" them.
- **Color tokens** live in `apps/frontend/src/index.css` as CSS custom properties (`--accent-purple: #7C3AED`, etc.) but are also re-defined as JS constants inside components.
- **Brand palette (use these constants in 3D code):**
  ```ts
  const PURPLE = '#7C3AED';
  const BLUE   = '#3B82F6';
  const CYAN   = '#06B6D4';
  const VIOLET = '#A78BFA';
  const NEON   = '#67E8F9';
  const AMBER  = '#F59E0B';  // validator only
  ```
- **Easing:** `var(--ease-spring)` = `cubic-bezier(0.16, 1, 0.3, 1)`. Used everywhere for entry animations.

### File layout (frontend)

```
apps/frontend/src/
├── App.tsx                       # router-by-state; mounts Navbar + RoboticCursor + SleepingMascot
├── main.tsx
├── index.css                     # design tokens + global keyframes
├── components/
│   ├── BackgroundLayers.tsx      # ambient orbs + particles + grid (NOT touched)
│   ├── Icons.tsx
│   ├── Navbar.tsx                # sticky 64px nav
│   ├── OperationsCenter.tsx      # the entire R3F hero scene
│   ├── RoboticCursor.tsx         # custom robotic finger cursor
│   ├── SleepingMascot.tsx        # bottom-left mascot, click → chat
│   └── WorkflowTheater.tsx       # legacy, currently unused
├── pages/
│   ├── Home.tsx                  # hero + prompt card + recent runs
│   ├── Runs.tsx
│   ├── RunExecution.tsx
│   ├── Agents.tsx
│   ├── Pricing.tsx
│   ├── Account.tsx
│   ├── Admin.tsx
│   └── Settings.tsx
├── data/                         # mock data
└── lib/, hooks/, services/, styles/
```

### Routing model

`App.tsx` uses a `useState('home')` page string + a giant switch — **NOT react-router**, even though it's installed. Page transitions trigger a full-screen "warp flash" overlay. Don't introduce react-router until asked.

## 6. The hero — current state (most of the recent work)

The home page hero is a cinematic 3D "Autonomous Agent Operations Center". It went through ~10 rounds of iteration. Final state:

### Layout (top → bottom)

1. **Violet wall screen** at the back of the 3D scene — backdrop containing the headline copy.
2. **Headline DOM overlay** rendered over the wall screen position: eyebrow chip → `Build AI Agents` / `Instantly.` (gradient) → subtitle paragraph.
3. **Office row** in 3D — three sub-agent robots seated at desks with laptops, typing.
4. **Validator** robot pacing on a walkway behind the desks; pauses to "review" each worker.
5. **CTAs (`Start Building` / `View Demo`)** rendered as a separate `<div>` AFTER the hero `<section>` closes — so they appear in the page flow physically below the office row. Currently `marginTop: -40` on the band to pull them slightly up.
6. **Prompt card** + recent runs list (in the centered 1180px max-width container).

### `OperationsCenter.tsx` — exact composition

- **Camera**: `[0, 2.4, 8.8]`, FOV `40`, `dpr={[1, 1]}`, `antialias: false`, `frameloop` toggles to `'never'` when scrolled out via `IntersectionObserver`.
- **Wall screen**: `[0, 3.0, -9]`, size `14 × 6.5`, violet base + softer halo behind, double frame (violet outer + cyan inner), 4 corner brackets, top + bottom status accent bars, vertical scanline that sweeps top-to-bottom on a slow loop. Pulsing emissive `0.32 → 0.42`.
- **Floor**: dark plane + custom shader grid overlay. **Removed `MeshReflectorMaterial`** — it was the #1 perf killer (renders the scene from below every frame).
- **Office desks** at z=-1.2, **laptops** at z=-1.15 (laptop screen tilted `+0.22 rad` toward camera so content is visible — initially had `-1.15 rad` which leaned the screen away from camera and made it invisible).
- **WorkerRobot** at z=-1.7, x=-3.6/0/3.6, with stool base (NOT hover disc — they're seated). Body in `RoundedBox` with `smoothness=2` (NOT 3 — perf). Strong emissive on body parts (`emissiveIntensity 0.4-0.55`) so robots are visible against dark background.
- **Validator** state machine: visits stations `[-3.6, 0, 3.6, 0]`, `WALK_T = 2.2s`, `PAUSE_T = 1.8s` per station. Smooth-step ease-in-out walking, body bob only while walking, smoothly rotates to face the worker during pause, scan beam intensifies + rotates 2x faster during pause.
- **Walkway** (amber translucent strip + 9 dashed center lines) at y=-1.595, z=-3.6.
- **Data pipelines**: 3 streams from worker positions to wall screen at `[0, 2.5, -8.8]`.
- **Micro-drones**: 3 (cut from 7 for perf), simple sphere + halo, no Trail wrapper.
- **Sparkles**: 25 total (cut from 130).
- **Lighting**: ambient 0.85 (warm slate), front camera fill `[0, 5, 12]` intensity 1.15, two top keys (left+right), three colored point lights for accent. **No shadow maps** — `ContactShadows` removed.

### Removed / not in current scene

- `AICoreReactor` (was `[0, 0, -9]`, displaced by WallScreen).
- `MeshReflectorMaterial` (perf).
- `ContactShadows` (perf).
- `Trail` from drones (perf).
- 2 side `HoloDashboard`s (`WORKER.METRICS` + `REASONING.LOG`) — removed when WallScreen took over.
- `ThinkerRobot` (still defined in the file, NOT rendered — kept for possible reuse).
- `SupervisorRobot` (still defined, NOT rendered — replaced by `Validator` with proper walk/pause state machine).
- `livePill` "3 AGENTS LIVE · VALIDATOR ACTIVE" (was upper-right, removed by request).
- `hudCard` (upper-left HUD card with 4 corner brackets — replaced by centered text).

### Centering technique — IMPORTANT

The hero text uses `position: absolute, left: 0, right: 0, margin: 0 auto, width: min(620px, 90vw)` to center horizontally. **Do NOT use `transform: translateX(-50%)`.** The `fadeUp` keyframe ends at `transform: translateY(0)` which **clobbers** an inline `translateX(-50%)`, causing the text to drift to the right. This bug was hit and fixed.

For animations that need to coexist with positioning transforms, use the **`fadeIn`** keyframe (opacity only, no transform). It's defined in `index.css` next to `fadeUp`.

## 7. Two global components

### `RoboticCursor.tsx`

- Replaces native cursor on hover-capable devices. Disabled on `(hover: none), (pointer: coarse)`.
- Adds class `rcursor-on` to `<html>`; CSS rule in `index.css` sets `cursor: none !important` on everything.
- SVG of a robotic finger: glowing tip at SVG `(0, 0)` (the click point), two articulated knuckles, palm/wrist with circuit accents.
- Outer glow ring centered on cursor, expands + recolors purple over interactive elements (`button, a, [role="button"], input, textarea, select, label, [data-cursor="hover"]`).
- Sub-pixel lerp tracking via `requestAnimationFrame`. Press-burst pulse on click.

### `SleepingMascot.tsx`

- Fixed `bottom: 24, left: 24`, z=80, ~132×156px.
- States: `sleeping → waking → awake`. State machine in `useEffect`.
- Sleeping: 4s breathe loop, drifting `Z Z z` particles, dim core, charging dock pulse.
- Waking: 1.4s flash + transition. Eyes light up, head sits upright, arms raise.
- Awake: pulsing `READY ↗` cue pointing toward the chat.
- **Click behavior** (this is wired through `App.tsx`, not the mascot itself):
  - Mascot calls `onGoToChat?.()` prop on every click.
  - `App.tsx` provides `goToChat()` which checks `page !== 'home'` → calls `navigate('home')` then waits 500ms then `scrollIntoView` + focuses the textarea inside `#prompt-section`.
  - This means **the mascot works on every page** — it routes back to home and lands the cursor in the prompt field.

## 8. Bugs hit during development (do not repeat)

### Build / install

1. **Stale workspace dep** `"shared": "*"` in `package.json` blocked installs after the package was deleted. Removed in this work.
2. **Duplicate three.js types** when both `three` and `@types/three` were installed. Symptom: hundreds of "Type X is not assignable to Type X" errors with phrases like "missing the following properties from type Y: static, pivot". **Fix: never install `@types/three` with modern three.**
3. **Hoisted node_modules** in npm workspaces — `apps/frontend/node_modules/three` does NOT exist; check `<root>/node_modules/three`.

### React Three Fiber gotchas

4. **`<line>` with `bufferGeometry` spread is wrong.** Use drei's `<Line>` for line primitives.
5. **`rotation` prop belongs on the `<mesh>`, not on the geometry**. `<cylinderGeometry args=[...] rotation={[...]} />` is a silent bug — geometry doesn't have rotation.
6. **`coneGeometry` apex points +Y by default.** A "scan beam" cone hanging downward needs the cone positioned at `[0, -0.6, 0]` (apex at top, wide end at bottom).
7. **Default camera looks down -Z with no `lookAt`.** Position the camera with knowledge of where you want world (0,0,0) to land in frame.
8. **`MeshReflectorMaterial` is extremely expensive.** It re-renders the scene every frame. Avoid unless you specifically need a mirror floor.

### CSS / animation

9. **`transform: translateX(-50%)` + animated `transform` = bug.** CSS animations override inline transforms while running and at their end keyframe. Use `margin: 0 auto` for horizontal centering of absolutely-positioned elements when an animation may set transform.
10. **`fadeUp` (translateY) conflicts with positioning transforms.** Created `fadeIn` (opacity only) for elements that need positioning + fade-in.

### Layout

11. **Camera at z=8.8 means workers extend to ~95% of hero height.** "Buttons under the office" inside the hero is tight; the cleanest fix is rendering the buttons in a SIBLING `<div>` after the `<section>` closes, in normal page flow.
12. **Hero must be full-bleed** (`width: 100%`, NOT inside the centered max-width 1180 container) for the office to read edge-to-edge.

## 9. Performance settings — current values

| Knob | Value | Note |
|---|---|---|
| `dpr` | `[1, 1]` | No hi-DPI scaling, biggest perf win |
| `antialias` | `false` | Reduces shader compile + per-frame overdraw |
| `RoundedBox smoothness` | `2` | Each step adds many vertices |
| Drone count | `3` | Was `7` |
| Sparkles | `25` total | Was `130` (two layers) |
| Reflector | none | Removed `MeshReflectorMaterial` |
| Shadows | none | Removed `ContactShadows` |
| Trails | none | Removed `Trail` from drones |
| `frameloop` | toggles via `IntersectionObserver` | `'never'` when scrolled out of hero |
| Suspense fallback | `<HeroLoader />` | Spinning ring + "INITIALIZING OPERATIONS CENTER" |
| Canvas import | `lazy()` in `Home.tsx` | Bundle split |

## 10. The user's working preferences (collected from feedback)

- **Iterates from screenshots.** Expect to see a screenshot, get specific complaints, ship a fix, repeat.
- **Picks the visually heavier option** when given a choice. Chose R3F 3D over SVG/CSS even with the perf risk explicitly called out.
- **Wants the hero to feel cinematic and alive.** "AI ecosystem", "operational headquarters", "robotic agents collaborating" — these are the words he uses. The brief in the second message of this project is the source of truth for vision.
- **Wants concrete, recognizable scene metaphors.** "office where subagents are working on laptops" — scenes should be readable, not abstract.
- **Cuts dead code completely.** No stubs, no `// removed` comments. If something is gone, delete it.
- **Doesn't want premature abstractions.** No factory functions for one-off components. The big `OperationsCenter.tsx` (~1000 lines, single file with sub-components) is intentional and fine — leave it that way unless asked.

## 11. Auto-memory location

The user has a Claude auto-memory system at:
```
C:\Users\1mhmd\.claude\projects\c--Users-1mhmd-OneDrive-Desktop-Ai-Projects-AgentForge\memory\
```
With these existing memory files referenced in `MEMORY.md`:
- `user_work_style.md`
- `feedback_continue_means_execute.md`
- `feedback_no_fabricated_metrics.md`
- `feedback_diagnosis_first.md`
- `feedback_brief_inspection_checklist.md`
- `feedback_dont_recreate_deleted_patterns.md`
- `feedback_probe_endpoints_before_wiring.md`
- `feedback_probe_cleanup.md`
- `feedback_proactive_security_flag.md`
- `feedback_surgical_patches.md`
- `feedback_python_source_rules.md`
- `feedback_triple_quote_docstrings.md`
- `feedback_merge_conflict_resolution.md`
- `feedback_powershell_pythonpath.md`
- `feedback_call_llm_signature.md`
- `project_agentforge.md`
- `project_mcp_integration.md`
- `reference_audit_reports.md`

Most of these are about the Python `apps/ai/` work, not the frontend. The frontend session has produced no auto-memories yet — this file is the substitute.

## 12. What the original brief asked for vs. what's built

The original brief was titled **"ELITE CREATIVE DIRECTION — AUTONOMOUS AI HEADQUARTERS EXPERIENCE"** and called for:

| Brief item | Status | Notes |
|---|---|---|
| Hero "Autonomous Agent Operations Center" | ✅ shipped | The 3D office + wall screen |
| Worker robots typing on holographic terminals | ✅ shipped (modified) | Now sitting at physical desks with real laptops, not floating holograms |
| Thinker robots with neural orbs | ⚠️ removed from scene | Component still in file, can re-add |
| Supervisor robots monitoring | ✅ shipped as Validator | Walk-and-pause state machine, holographic clipboard |
| Maintenance micro-drones | ✅ shipped | Reduced from 7 to 3 for perf |
| Floating dashboards | ⚠️ replaced | Single big WallScreen instead of three side dashboards |
| Sleeping robot mascot bottom-right | ✅ shipped (bottom-LEFT per user's pref) | Cross-page navigation via `goToChat` |
| Wake-up cinematic sequence | ✅ shipped | Sleep → wake → awake; eyes light up, arms raise, READY arrow |
| Custom robotic cursor | ✅ shipped | SVG robotic finger, magnetic hover, press pulse |
| Logo system + animation | ❌ NOT shipped | Existing navbar logo unchanged |
| Section transitions | ❌ NOT shipped | Existing `warpFlash` between pages is unchanged |
| Audio-inspired visual feedback | ⚠️ partial | Pulsing emissives, scanlines, validator scan beam intensify |

If asked to continue the cinematic direction, **logo system** and **animated section transitions** are the obvious next targets.

## 13. Things I (the assistant) would do differently next time

These are honest reflections from this session — note them so the next assistant doesn't repeat the same misses.

- **Test 3D screen orientations before shipping.** I shipped a laptop with the screen tilted 66° backward, invisible to the camera. Should have done a math check of the rotation direction first.
- **Plan camera math before placing DOM overlays.** I positioned DOM headlines at `top: 80` without computing where the 3D wall screen actually projects in viewport coordinates. The result: text and screen drifted apart vertically and horizontally. Later passes computed the projection (camera → distance → vertical FOV → viewport y), and that should have been done up front.
- **Watch for animation-vs-transform bugs.** When using `position: absolute, left: 50%, transform: translateX(-50%)` with an animation that keyframes `transform`, the animation wins. Default to `margin: 0 auto` + `left: 0; right: 0`.
- **Cut perf-heavy drei components by default.** `MeshReflectorMaterial`, `ContactShadows`, `Trail` are all expensive. Default to "off" and add only when needed.
- **Stop adding entries to old todo lists.** When the work pivots, clear the list and start fresh.
- **Confirm visible state after major changes.** Don't claim "fixed!" without a screenshot from the user. tsc + Vite log clean is necessary but not sufficient.

## 14. Quick start for a new session

If you're an AI assistant picking this up cold, here's how to land softly:

1. Read this file end-to-end before touching code.
2. The dev server lives at `http://localhost:5173/`. Run from `apps/frontend` with `npm run dev`.
3. Most current work is in `apps/frontend/src/components/OperationsCenter.tsx` and `apps/frontend/src/pages/Home.tsx`.
4. Run `npx tsc --noEmit` from `apps/frontend` to type-check.
5. Use the Bash tool with PowerShell-friendly paths (Windows). When chaining commands, `&&` works in Git Bash but PowerShell needs `; if ($?) { ... }`.
6. When the user says "continue" or gives a green light → execute, don't ask.
7. When the user sends a numbered list of fixes → address all of them in one response.
8. When in doubt about a layout request, position by exact pixel value he gave, then adjust based on his next screenshot.

---

_Last updated at the end of the session that produced the violet-wall-screen office hero with seated worker robots, pacing validator, sleeping mascot, and robotic-finger cursor. Total scene composition is at `apps/frontend/src/components/OperationsCenter.tsx`._
