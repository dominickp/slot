/**
 * Central animation timing configuration (milliseconds).
 *
 * Tweak values here to change pacing across controller and renderer animations.
 */
export const ANIMATION_TIMING = {
  controller: {
    spinFlow: {
      // Duration of the initial reel-to-grid transition animation.
      spinDropMs: 520,
      // Duration of each cascade removal/drop animation.
      cascadeMs: 200,
      // Delay between consecutive cascade animations.
      betweenCascadesMs: 24,
      // Pause after initial render before cascade playback starts.
      preCascadePauseMs: 30,
      // Maximum number of cascades animated before fast-forwarding.
      maxAnimatedCascades: 8,
      // Duration of the floating win text animation.
      winTextMs: 520,
    },
    triggerEffects: {
      // Scatter pulse duration on base-spin bonus trigger.
      bonusScatterPulseMs: 1100,
      // Scatter pulse duration for 2-scatter tease.
      teaseScatterPulseMs: 760,
      // Scatter pulse duration for free-spin retrigger.
      retriggerScatterPulseMs: 860,
      // Center callout duration for retrigger award text.
      retriggerCalloutMs: 860,
    },
    pauses: {
      // Short pause after base spin resolves.
      postBaseSpinMs: 600,
      // Pause after retrigger text/callout before continuing.
      postRetriggerMs: 240,
      // Delay between free spins in an active bonus round.
      betweenFreeSpinsMs: 350,
    },
  },
  renderer: {
    defaults: {
      // Generic badge pop/fade animation duration.
      badgeMs: 300,
      // Focus pulse duration used on emphasized symbols.
      focusedTileMs: 520,
      // Clover-to-target multiplier packet travel duration.
      multiplierBurstMs: 380,
      // Upgrade pulse duration for value changes.
      upgradePulseMs: 340,
      // Flip reveal duration for value/symbol cards.
      flipRevealMs: 360,
      // Full tile spin reveal duration for bonus reveals.
      tileSpinRevealMs: 320,
      // Center callout animation duration.
      centerCalloutMs: 820,
      // Token travel duration from sources to pot.
      collectFlowTravelMs: 760,
      // Pot result badge duration after collection completes.
      collectFlowBadgeMs: 760,
      // Scatter pulse default duration.
      scatterTriggerMs: 900,
      // Spin transition duration for initial board animation.
      spinTransitionMs: 520,
      // Grid drop duration for symbol fall animations.
      gridDropMs: 420,
      // Cascade sequence duration baseline.
      cascadeMs: 300,
      // Delay after a connection highlight before explosion/removal starts.
      cascadeHighlightPauseMs: 405,
      // Pre-spin blur animation duration.
      spinStartMs: 500,
      // Floating win text animation duration.
      winFloatMs: 800,
    },
    stagger: {
      // Column stagger for spin transition entry.
      spinTransitionColumnMs: 28,
      // Column stagger for grid drop animation.
      gridDropColumnMs: 16,
      // Column stagger for cascade drop animation.
      cascadeDropColumnMs: 12,
    },
    bonusSequence: {
      // Reveal duration when reveal count is small.
      revealDurationSmallMs: 290,
      // Reveal duration when reveal count is medium.
      revealDurationMediumMs: 250,
      // Reveal duration when reveal count is large.
      revealDurationLargeMs: 220,
      // Reveal stagger when reveal count is small.
      revealStaggerSmallMs: 24,
      // Reveal stagger when reveal count is medium.
      revealStaggerMediumMs: 16,
      // Reveal stagger when reveal count is large.
      revealStaggerLargeMs: 12,
      // Threshold for medium reveal pacing.
      revealMediumThreshold: 12,
      // Threshold for large reveal pacing.
      revealLargeThreshold: 20,
      // Badge duration for clover multiplier display.
      cloverBadgeMs: 360,
      // Delay after clover badge before burst packets launch.
      cloverBadgeGapMs: 120,
      // Gap after clover updates before next action.
      cloverSettleGapMs: 300,
      // Badge duration for post-collect clover multiplier display.
      postCollectCloverBadgeMs: 320,
      // Delay after post-collect clover badge before burst packets launch.
      postCollectCloverGapMs: 90,
      // Burst duration for post-collect clover packet travel.
      postCollectBurstMs: 320,
      // Gap after post-collect updates before next action.
      postCollectSettleGapMs: 80,
      // Delay after each collector step completes.
      collectorStepGapMs: 320,
      // Per-source collector value tick display duration.
      collectorTickMs: 34,
      // Delay between collector value ticks.
      collectorTickGapMs: 14,
      // Pause after collector suction/count-up before post-collect reveals.
      collectorPostAnimationDelayMs: 220,
      // Duration for round total collection badge.
      roundCollectedBadgeMs: 420,
      // Delay between feature rounds.
      betweenRoundsGapMs: 80,
      // Base focus duration for clover animations.
      cloverFocusBaseMs: 520,
      // Extra clover focus time per affected target.
      cloverFocusPerTargetMs: 45,
      // Minimum clover focus duration.
      cloverFocusMinMs: 560,
      // Collector focus duration when sources exist.
      collectorFocusWithSourcesMs: 1840,
      // Collector focus duration when no sources exist.
      collectorFocusWithoutSourcesMs: 980,
      // Rainbow focus base duration.
      rainbowFocusBaseMs: 420,
      // Rainbow focus extra duration per reveal.
      rainbowFocusPerRevealMs: 28,
      // Minimum rainbow focus duration.
      rainbowFocusMinMs: 560,
    },
  },
};

export function getRevealPacing(revealCount) {
  const pacing = ANIMATION_TIMING.renderer.bonusSequence;

  if (revealCount > pacing.revealLargeThreshold) {
    return {
      durationMs: pacing.revealDurationLargeMs,
      staggerMs: pacing.revealStaggerLargeMs,
    };
  }

  if (revealCount > pacing.revealMediumThreshold) {
    return {
      durationMs: pacing.revealDurationMediumMs,
      staggerMs: pacing.revealStaggerMediumMs,
    };
  }

  return {
    durationMs: pacing.revealDurationSmallMs,
    staggerMs: pacing.revealStaggerSmallMs,
  };
}

export default ANIMATION_TIMING;
