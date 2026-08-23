import React from 'react';

/**
 * Flowwork mark — Tabler's topology-star-3 (a hub with six linked nodes), but
 * with the nodes filled in: the hub in the brand amber, the leaves in a lighter
 * tint. Strokes follow `currentColor` so it sits on either theme; the same
 * geometry is rendered into public/favicon.svg (keep the two in sync).
 */
export const NODES = [
  { cx: 12, cy: 12, hub: true },
  { cx: 4, cy: 12 },
  { cx: 20, cy: 12 },
  { cx: 8, cy: 5 },
  { cx: 16, cy: 5 },
  { cx: 8, cy: 19 },
  { cx: 16, cy: 19 }
];

export const LINKS = 'M6 12h4M14 12h4M15 7l-2 3M9 7l2 3M11 14l-2 3M13 14l2 3';

export const HUB_FILL = '#E8890C';
export const LEAF_FILL = '#F7C873';

const FlowworkLogo = ({ size = 16, stroke = 1.5, className }) => (
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
    data-testid="flowwork-logo"
  >
    <path d={LINKS} />
    {NODES.map(({ cx, cy, hub }) => (
      <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={2} fill={hub ? HUB_FILL : LEAF_FILL} />
    ))}
  </svg>
);

export default FlowworkLogo;
