import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OnboardingWizard, derivePersonaBadge } from './OnboardingWizard';

afterEach(() => {
  cleanup();
});

describe('Onboarding Persona Picker (S4-01)', () => {
  it('computes Night Owl persona when nightlife and weekend vibes are chosen', () => {
    const badge = derivePersonaBadge({
      vibes: ['Parties & nightlife', 'Concerts & live music'],
      rhythm: 'WEEKENDS',
    });
    expect(badge.title).toBe('Night Owl');
  });

  it('computes Culture Vulture persona when theatre & culture is chosen', () => {
    const badge = derivePersonaBadge({
      vibes: ['Theatre & culture'],
      rhythm: 'WEEKNIGHTS',
    });
    expect(badge.title).toBe('Culture Vulture');
  });

  it('allows skipping from Step 1 immediately (<30s skippable contract)', () => {
    const onComplete = vi.fn();
    const { getByRole } = render(<OnboardingWizard onComplete={onComplete} />);
    fireEvent.click(getByRole('button', { name: /Skip/i }));
    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({ skipped: true }));
  });

  it('steps through Vibe → UI Hall/People → Rhythm → Persona Reveal', () => {
    const onComplete = vi.fn();
    const { getByRole, getByText } = render(<OnboardingWizard onComplete={onComplete} />);

    // Step 1: Vibe
    expect(getByText(/What are you into\?/i)).toBeDefined();
    fireEvent.click(getByRole('button', { name: /Parties & nightlife/i }));
    fireEvent.click(getByRole('button', { name: /Continue to Cohort/i }));

    // Step 2: Your People (University of Ibadan halls)
    expect(getByText(/Your Campus Cohort/i)).toBeDefined();
    expect(getByText(/Mellanby Hall/i)).toBeDefined();
    fireEvent.click(getByRole('button', { name: /Continue to Rhythm/i }));

    // Step 3: Rhythm
    expect(getByText(/When do you usually go out\?/i)).toBeDefined();
    fireEvent.click(getByRole('button', { name: /Reveal My Persona/i }));

    // Step 4: Persona Reveal
    expect(getByText(/Night Owl/i)).toBeDefined();
    fireEvent.click(getByRole('button', { name: /Jump into Feed/i }));
    expect(onComplete).toHaveBeenCalledWith(
      expect.objectContaining({
        skipped: false,
        personaBadge: 'Night Owl',
      }),
    );
  });
});
