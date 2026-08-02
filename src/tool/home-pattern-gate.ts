import { homePatternLogic } from "./home-pattern-gate-logic";
const homePatternGate = document.getElementById("homePatternGate");
const homePatternBoard = document.getElementById("homePatternBoard");
const homePatternPath = document.getElementById("homePatternPath");
const homePatternTrail = document.getElementById("homePatternTrail");
const homePatternStatus = document.getElementById("homePatternStatus");
const homePatternDots = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-pattern-node]"));
const homeGatedElements = [
    document.getElementById("announcementBanner"),
    document.querySelector(".page-shell")
].filter((element): element is HTMLElement => element instanceof HTMLElement);

let selectedHomePattern: number[] = [];
let activeHomePatternPointer: number | undefined;
let homePatternLocked = false;
let homePatternResetTimer: number | undefined;

if (
    homePatternGate instanceof HTMLElement
    && homePatternBoard instanceof HTMLElement
    && homePatternPath instanceof SVGPolylineElement
    && homePatternTrail instanceof SVGLineElement
    && homePatternStatus instanceof HTMLElement
) {
    setHomeContentInert(true);
    if (!homePatternLogic.enabled) {
        unlockHomePatternGate(false);
    } else {
        bindHomePatternGate();
        renderHomePatternLine();
    }
}

function bindHomePatternGate(): void {
    if (!(homePatternBoard instanceof HTMLElement)) return;
    homePatternBoard.addEventListener("pointerdown", startHomePattern);
    homePatternBoard.addEventListener("pointermove", moveHomePattern);
    homePatternBoard.addEventListener("pointerup", finishHomePattern);
    homePatternBoard.addEventListener("pointercancel", cancelHomePattern);
    homePatternBoard.addEventListener("keydown", handleHomePatternKeydown);
    window.addEventListener("resize", () => renderHomePatternLine());
}

function startHomePattern(event: PointerEvent): void {
    if (homePatternLocked || !(homePatternBoard instanceof HTMLElement)) return;
    const node = readHomePatternNode(event.target);
    if (node === undefined) return;

    event.preventDefault();
    resetHomePattern();
    homePatternGate?.classList.add("is-drawing");
    activeHomePatternPointer = event.pointerId;
    homePatternBoard.setPointerCapture(event.pointerId);
    addHomePatternNode(node);
    renderHomePatternLine(event);
}

function moveHomePattern(event: PointerEvent): void {
    if (event.pointerId !== activeHomePatternPointer || homePatternLocked) return;
    event.preventDefault();
    const target = document.elementFromPoint(event.clientX, event.clientY);
    const node = readHomePatternNode(target);
    if (node !== undefined) addHomePatternNode(node);
    renderHomePatternLine(event);
}

function finishHomePattern(event: PointerEvent): void {
    if (event.pointerId !== activeHomePatternPointer || !(homePatternBoard instanceof HTMLElement)) return;
    event.preventDefault();
    if (homePatternBoard.hasPointerCapture(event.pointerId)) homePatternBoard.releasePointerCapture(event.pointerId);
    activeHomePatternPointer = undefined;
    homePatternGate?.classList.remove("is-drawing");
    renderHomePatternLine();
    verifyHomePattern();
}

function cancelHomePattern(event: PointerEvent): void {
    if (event.pointerId !== activeHomePatternPointer) return;
    activeHomePatternPointer = undefined;
    homePatternGate?.classList.remove("is-drawing");
    resetHomePattern();
}

function handleHomePatternKeydown(event: KeyboardEvent): void {
    if (homePatternLocked) return;
    if (event.key === "Escape") {
        resetHomePattern();
        return;
    }
    if (event.key !== "Enter" && event.key !== " ") return;

    const node = readHomePatternNode(event.target);
    if (node === undefined) return;
    event.preventDefault();
    addHomePatternNode(node);
    if (selectedHomePattern.length >= homePatternLogic.pattern.length) verifyHomePattern();
}

function readHomePatternNode(target: EventTarget | null): number | undefined {
    if (!(target instanceof Element) || !(homePatternBoard instanceof HTMLElement)) return undefined;
    const dot = target.closest<HTMLElement>("[data-pattern-node]");
    if (!dot || !homePatternBoard.contains(dot)) return undefined;
    const node = Number(dot.dataset.patternNode);
    return Number.isInteger(node) ? node : undefined;
}

function addHomePatternNode(node: number): void {
    const nextPattern = homePatternLogic.appendNode(selectedHomePattern, node);
    if (nextPattern.length === selectedHomePattern.length) return;
    selectedHomePattern = nextPattern;
    vibrateHomePattern(8);
    homePatternDots.forEach((dot) => {
        dot.classList.toggle("is-selected", selectedHomePattern.includes(Number(dot.dataset.patternNode)));
    });
    renderHomePatternLine();
}

function renderHomePatternLine(pointer?: PointerEvent): void {
    if (
        !(homePatternBoard instanceof HTMLElement)
        || !(homePatternPath instanceof SVGPolylineElement)
        || !(homePatternTrail instanceof SVGLineElement)
    ) return;

    const boardRect = homePatternBoard.getBoundingClientRect();
    homePatternPath.ownerSVGElement?.setAttribute("viewBox", `0 0 ${boardRect.width} ${boardRect.height}`);
    const centers = new Map<number, { x: number; y: number }>();
    homePatternDots.forEach((dot) => {
        const rect = dot.getBoundingClientRect();
        centers.set(Number(dot.dataset.patternNode), {
            x: rect.left - boardRect.left + rect.width / 2,
            y: rect.top - boardRect.top + rect.height / 2
        });
    });

    homePatternPath.setAttribute("points", selectedHomePattern
        .map((node) => centers.get(node))
        .filter((point): point is { x: number; y: number } => Boolean(point))
        .map((point) => `${point.x},${point.y}`)
        .join(" "));

    const lastNode = selectedHomePattern.length ? selectedHomePattern[selectedHomePattern.length - 1] : 0;
    const lastPoint = centers.get(lastNode);
    if (pointer && lastPoint) {
        homePatternTrail.setAttribute("x1", String(lastPoint.x));
        homePatternTrail.setAttribute("y1", String(lastPoint.y));
        homePatternTrail.setAttribute("x2", String(pointer.clientX - boardRect.left));
        homePatternTrail.setAttribute("y2", String(pointer.clientY - boardRect.top));
        homePatternTrail.hidden = false;
    } else {
        homePatternTrail.hidden = true;
    }
}

function verifyHomePattern(): void {
    if (!(homePatternGate instanceof HTMLElement) || !(homePatternStatus instanceof HTMLElement)) return;
    homePatternLocked = true;
    if (homePatternLogic.matches(selectedHomePattern)) {
        homePatternGate.classList.add("is-success");
        homePatternStatus.textContent = "已通过";
        vibrateHomePattern(18);
        window.setTimeout(() => unlockHomePatternGate(true), 160);
        return;
    }

    homePatternGate.classList.add("is-error");
    homePatternStatus.textContent = "图案不正确";
    vibrateHomePattern([18, 32, 18]);
    homePatternResetTimer = window.setTimeout(() => {
        homePatternLocked = false;
        resetHomePattern();
    }, 480);
}

function resetHomePattern(): void {
    if (homePatternResetTimer !== undefined) {
        window.clearTimeout(homePatternResetTimer);
        homePatternResetTimer = undefined;
    }
    selectedHomePattern = [];
    homePatternDots.forEach((dot) => dot.classList.remove("is-selected"));
    homePatternGate?.classList.remove("is-drawing", "is-error");
    if (homePatternStatus instanceof HTMLElement) homePatternStatus.textContent = "";
    renderHomePatternLine();
}

function unlockHomePatternGate(animate: boolean): void {
    if (!(homePatternGate instanceof HTMLElement)) return;
    if (animate) homePatternGate.classList.add("is-unlocking");
    window.setTimeout(() => {
        homePatternGate.hidden = true;
        document.body.classList.remove("is-gated");
        setHomeContentInert(false);
    }, animate ? 300 : 0);
}

function setHomeContentInert(inert: boolean): void {
    homeGatedElements.forEach((element) => {
        element.inert = inert;
    });
}

function vibrateHomePattern(pattern: number | number[]): void {
    if ("vibrate" in navigator) navigator.vibrate(pattern);
}
