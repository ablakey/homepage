interface PlaceholderProps {
  name: string;
}

/** Shared, platform-agnostic component. Replace with real shared UI. */
export function Placeholder({ name }: PlaceholderProps) {
  return <div data-shared-component={name}>{name}</div>;
}
