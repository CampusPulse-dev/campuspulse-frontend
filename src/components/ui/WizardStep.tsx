'use client';

import { forwardRef, type ComponentPropsWithoutRef } from 'react';
import { motion, useIsPresent, useReducedMotion } from 'framer-motion';
import { fadeInUp } from '@/lib/motion';

export const WizardStep = forwardRef<HTMLElement, ComponentPropsWithoutRef<'section'>>(
  function WizardStep({ children, className }, ref) {
    const present = useIsPresent();
    const reduced = useReducedMotion();
    return (
      <motion.section
        ref={ref}
        className={className}
        inert={!present || undefined}
        aria-hidden={!present || undefined}
        variants={reduced ? undefined : fadeInUp}
        initial={reduced ? false : 'hidden'}
        animate="visible"
        exit={reduced ? undefined : 'exit'}
      >
        {children}
      </motion.section>
    );
  },
);
