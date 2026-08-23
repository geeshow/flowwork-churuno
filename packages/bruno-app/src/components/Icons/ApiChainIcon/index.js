import React, { useId } from 'react';
import { HUB_FILL, LEAF_FILL } from 'components/Icons/FlowworkLogo';

/**
 * API Chain mark — a Möbius band: one continuous ribbon looping into an ∞,
 * passing over itself at the twist. A chain of calls that feeds back into
 * itself, drawn in the same family as the Flowwork mark: `currentColor`
 * edges around a ribbon that runs from the leaf amber to the hub orange.
 *
 * Built from two strokes per piece (a wide edge under a narrower fill). The
 * "under" piece is the left loop → falling strand → right loop as one path;
 * the rising strand is painted last so it crosses on top. Its edge keeps flat
 * caps so it ends exactly where it meets the band; its fill gets round caps
 * so the two fills overlap instead of leaving an antialiased seam.
 */
const UNDER = 'M9.828 14.828a4 4 0 1 1 0 -5.656a10 10 0 0 1 2.172 2.828a10 10 0 0 0 2.172 2.828a4 4 0 1 0 0 -5.656';
const OVER = 'M9.828 14.828a10 10 0 0 0 2.172 -2.828a10 10 0 0 1 2.172 -2.828';

const EDGE_WIDTH = 3.8;
const FILL_WIDTH = 2.2;

const ApiChainIcon = ({ size = 16, className }) => {
  // useId wraps its token in punctuation (":r1:", "«r1»") that url(#…) may not take
  const gradientId = `api-chain-ribbon-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const ribbon = `url(#${gradientId})`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      data-testid="api-chain-icon"
    >
      <defs>
        <linearGradient id={gradientId} gradientUnits="userSpaceOnUse" x1="3" y1="12" x2="21" y2="12">
          <stop offset="0" stopColor={LEAF_FILL} />
          <stop offset="1" stopColor={HUB_FILL} />
        </linearGradient>
      </defs>
      <path d={UNDER} stroke="currentColor" strokeWidth={EDGE_WIDTH} strokeLinecap="round" />
      <path d={UNDER} stroke={ribbon} strokeWidth={FILL_WIDTH} strokeLinecap="round" />
      <path d={OVER} stroke="currentColor" strokeWidth={EDGE_WIDTH} strokeLinecap="butt" />
      <path d={OVER} stroke={ribbon} strokeWidth={FILL_WIDTH} strokeLinecap="round" />
    </svg>
  );
};

export default ApiChainIcon;
