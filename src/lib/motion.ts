import type { Transition, Variants } from 'framer-motion';

/**
 * Hardware-accelerated Framer Motion presets for CampusPulse.
 * Uses only GPU-composited `transform` (x, y, scale) and `opacity` properties.
 */
export const springSnappy: Transition = {
  type: 'spring',
  stiffness: 380,
  damping: 28,
  mass: 0.8,
};

export const springGentle: Transition = {
  type: 'spring',
  stiffness: 220,
  damping: 24,
  mass: 1,
};

export const springBouncy: Transition = {
  type: 'spring',
  stiffness: 300,
  damping: 16,
  mass: 0.9,
};

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: springGentle,
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: { duration: 0.16, ease: 'easeOut' },
  },
};

export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.02,
    },
  },
};

export const modalBackdropVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.18 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

export const bottomSheetVariants: Variants = {
  hidden: { opacity: 0, y: 36, scale: 0.98 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: springSnappy,
  },
  exit: {
    opacity: 0,
    y: 28,
    scale: 0.98,
    transition: { duration: 0.16, ease: 'easeIn' },
  },
};
