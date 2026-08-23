import React from 'react';
import { HUB_FILL, LEAF_FILL } from 'components/Icons/FlowworkLogo';

/**
 * API Chain mark — three nodes stepping up left to right, linked in sequence:
 * a chain of calls where each step feeds the next. Drawn with the same strokes
 * and node fills as the Flowwork mark so the two read as one family; the last
 * node takes the hub colour as the destination.
 */
const STEPS = [
  { cx: 5, cy: 18 },
  { cx: 12, cy: 12 },
  { cx: 19, cy: 6, last: true }
];

const ApiChainIcon = ({ size = 16, stroke = 1.5, className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={stroke}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
    data-testid="api-chain-icon"
  >
    <path d="M5 18l7 -6l7 -6" />
    {STEPS.map(({ cx, cy, last }) => (
      <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={2.5} fill={last ? HUB_FILL : LEAF_FILL} />
    ))}
  </svg>
);

export default ApiChainIcon;
