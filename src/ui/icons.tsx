/** Circled V60: ring, cone, lip, rib, drop. */
export const Logo = ({ class: cls = "logo" }: { class?: string }) => (
  <svg class={cls} viewBox="0 0 64 64" aria-hidden="true" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="32" cy="32" r="28" stroke-width="3.2" />
    <line x1="14" y1="21" x2="50" y2="21" stroke-width="3.2" />
    <path d="M18 21 L46 21 L34.5 41 L29.5 41 Z" stroke-width="3.2" />
    <path d="M32 25 L32 37" stroke-width="2" opacity=".6" />
    <path d="M32 45 Q35 49 32 51 Q29 49 32 45 Z" fill="currentColor" stroke="none" />
  </svg>
);

const base = { viewBox: "0 0 28 28", fill: "none", stroke: "currentColor", "stroke-width": "2.2", "stroke-linecap": "round", "stroke-linejoin": "round", "aria-hidden": "true" } as const;

export const BrewIcon = () => (
  <svg {...base}><circle cx="14" cy="15" r="10" /><path d="M14 9v6l4 2" /><path d="M11 3h6" /></svg>
);
export const RecipeIcon = () => (
  <svg {...base}><path d="M4 7h20M8 7l5 12h2l5-12" /><path d="M14 22v2" /></svg>
);
export const BagIcon = () => (
  <svg {...base}><path d="M7 6h14l1.5 18h-17z" /><path d="M7 6l2-2h10l2 2" /><circle cx="14" cy="15" r="3" /></svg>
);
