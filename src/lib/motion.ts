import type { Transition, Variants } from 'framer-motion';

// Seconds for Framer Motion. Keep shared values aligned with styles/tokens.css.
export const motionDuration = { popover: 0.15, move: 0.2, exit: 0.18 };
export const motionEase = {
  out: [0.2, 0, 0, 1],
  in: [0.55, 0, 1, 0.45],
} satisfies Record<string, [number, number, number, number]>;

export const personaReveal: Transition = { type: 'spring', duration: 0.42, bounce: 0.16 };

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: motionDuration.move, ease: motionEase.out },
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: { duration: motionDuration.exit, ease: motionEase.in },
  },
};
