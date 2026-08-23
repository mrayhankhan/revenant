'use client';

import { useEffect, useRef } from 'react';

/**
 * The hero visualisation: a field of job postings, decaying.
 *
 * Every dot is a listing. They arrive alive, age through amber, and a fraction
 * of them die — at which point they stop being lit and drift as dark husks that
 * are still, technically, on the board. That is the product's whole thesis
 * rendered literally, so the animation is an argument rather than decoration.
 *
 * Canvas rather than DOM because several hundred independently animating nodes
 * as elements would thrash layout on every frame.
 */

interface Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  /** 1 = freshly posted, 0 = long dead. */
  life: number;
  decay: number;
  /** Dead listings that remain listed — the ghosts. */
  ghost: boolean;
}

const COLORS = {
  live: [52, 211, 153],
  aging: [251, 191, 36],
  stale: [100, 116, 139],
  ghost: [251, 113, 133],
} as const;

function colorFor(node: Node): readonly [number, number, number] {
  if (node.ghost) return COLORS.ghost;
  if (node.life > 0.66) return COLORS.live;
  if (node.life > 0.33) return COLORS.aging;
  return COLORS.stale;
}

export function DecayField(): React.ReactElement {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pointer = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    // Motion here is meaningful but not essential; a stated preference against
    // it wins outright, so we paint one static frame and stop.
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let width = 0;
    let height = 0;
    let nodes: Node[] = [];
    let frame = 0;
    let running = true;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    // Declared as consts rather than function declarations so the null checks
    // above stay narrowed inside them; a hoisted declaration loses that.
    const spawn = (initial: boolean): Node => {
      const life = initial ? Math.random() : 1;
      return {
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.16,
        vy: (Math.random() - 0.5) * 0.16,
        r: 1 + Math.random() * 1.8,
        life,
        // Roughly a thirty-second lifetime, so the field turns over slowly
        // enough to read as decay rather than as flicker.
        decay: 0.00018 + Math.random() * 0.00042,
        ghost: false,
      };
    };

    const resize = (): void => {
      const parent = canvas.parentElement;
      if (!parent) return;

      width = parent.clientWidth;
      height = parent.clientHeight;

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Density scaled to area so a phone does not render a thousand nodes.
      const count = Math.min(260, Math.round((width * height) / 5200));
      nodes = Array.from({ length: count }, () => spawn(true));
    };

    const step = (): void => {
      context.clearRect(0, 0, width, height);

      for (const node of nodes) {
        node.x += node.vx;
        node.y += node.vy;

        if (node.x < -10) node.x = width + 10;
        if (node.x > width + 10) node.x = -10;
        if (node.y < -10) node.y = height + 10;
        if (node.y > height + 10) node.y = -10;

        if (!reduced) node.life -= node.decay;

        // A listing that reaches the end of its life does not disappear. It
        // stays on the board as a ghost — which is exactly the problem.
        if (node.life <= 0 && !node.ghost) {
          node.ghost = true;
          node.life = 0;
        }

        // Ghosts eventually get replaced by a genuinely new posting.
        if (node.ghost && Math.random() < 0.0016) {
          Object.assign(node, spawn(false));
        }

        const [r, g, b] = colorFor(node);
        const alpha = node.ghost ? 0.22 : 0.16 + node.life * 0.5;

        // Nodes near the cursor brighten, so the field responds to a reader
        // moving across it without demanding to be played with.
        let boost = 0;
        if (pointer.current) {
          const dx = node.x - pointer.current.x;
          const dy = node.y - pointer.current.y;
          const distance = Math.hypot(dx, dy);
          if (distance < 130) boost = (1 - distance / 130) * 0.55;
        }

        context.beginPath();
        context.arc(node.x, node.y, node.r + boost * 1.6, 0, Math.PI * 2);
        context.fillStyle = `rgba(${r},${g},${b},${Math.min(1, alpha + boost)})`;
        context.fill();
      }

      if (running && !reduced) frame = requestAnimationFrame(step);
    };

    const onPointerMove = (event: PointerEvent): void => {
      const rect = canvas.getBoundingClientRect();
      pointer.current = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    };

    const onPointerLeave = (): void => {
      pointer.current = null;
    };

    resize();
    step();

    const observer = new ResizeObserver(resize);
    if (canvas.parentElement) observer.observe(canvas.parentElement);

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerleave', onPointerLeave);

    // requestAnimationFrame is throttled in a hidden tab; stopping explicitly
    // keeps a backgrounded page from holding a scheduled frame.
    const onVisibility = (): void => {
      if (document.visibilityState === 'visible' && !reduced) {
        running = true;
        frame = requestAnimationFrame(step);
      } else {
        running = false;
        cancelAnimationFrame(frame);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      running = false;
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerleave', onPointerLeave);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="absolute inset-0 h-full w-full"
      style={{ maskImage: 'radial-gradient(80% 70% at 50% 40%, #000 30%, transparent 100%)' }}
    />
  );
}
