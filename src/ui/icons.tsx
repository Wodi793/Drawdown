/** Circled V60: ring, lip, cone, drop. Solid shapes so it holds up at 20 px. */
export const Logo = ({ class: cls = "logo" }: { class?: string }) => (
  <svg class={cls} viewBox="0 0 64 64" aria-hidden="true" fill="currentColor">
    <circle cx="32" cy="32" r="28.6" fill="none" stroke="currentColor" stroke-width="4" />
    <rect x="13" y="17.2" width="38" height="5" rx="2.5" />
    <path d="M16.8 21.6 H47.2 L36.3 41.6 Q35.6 42.8 34.2 42.8 H29.8 Q28.4 42.8 27.7 41.6 Z" />
    <path d="M32 46.4 C34.9 49.9 35.6 51.8 35.6 53 A3.6 3.6 0 0 1 28.4 53 C28.4 51.8 29.1 49.9 32 46.4 Z" />
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
