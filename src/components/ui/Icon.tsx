import type { LucideIcon, LucideProps } from 'lucide-react';
export function Icon({
  icon: Glyph,
  size = 20,
  strokeWidth = 1.75,
  ...props
}: LucideProps & { icon: LucideIcon }) {
  return <Glyph size={size} strokeWidth={strokeWidth} aria-hidden="true" {...props} />;
}
