/**
 * A clickable picker for tagging a capture card with a colour and/or an emoji
 * icon. Per project convention, icon/colour input is ALWAYS a picker, never a
 * hand-entry text field. Fully offline — curated sets, no external CDN.
 * Clicking the currently selected item clears it (toggle).
 */

const COLORS = [
  '#ef4444',
  '#f97316',
  '#f59e0b',
  '#eab308',
  '#22c55e',
  '#10b981',
  '#06b6d4',
  '#3b82f6',
  '#6366f1',
  '#8b5cf6',
  '#ec4899',
  '#64748b',
];

const ICONS = [
  '🎨', '🖌️', '🌈', '💡', '⭐', '🔥', '🌊', '🌿', '🍬', '🕹️',
  '📐', '🧩', '🏷️', '📌', '❤️', '🔖', '✨', '🧪',
];

export interface TagValue {
  color?: string;
  icon?: string;
}

export function ColorIconPicker({
  color,
  icon,
  onChange,
}: TagValue & { onChange: (patch: TagValue) => void }) {
  return (
    <div class="picker">
      <div class="picker-row" role="group" aria-label="Tag colour">
        {COLORS.map((c) => (
          <button
            key={c}
            type="button"
            class={`picker-color${color === c ? ' selected' : ''}`}
            style={`background:${c}`}
            title={c}
            aria-pressed={color === c}
            onClick={() => onChange({ color: color === c ? undefined : c })}
          />
        ))}
      </div>
      <div class="picker-row" role="group" aria-label="Tag icon">
        {ICONS.map((e) => (
          <button
            key={e}
            type="button"
            class={`picker-icon${icon === e ? ' selected' : ''}`}
            aria-pressed={icon === e}
            onClick={() => onChange({ icon: icon === e ? undefined : e })}
          >
            {e}
          </button>
        ))}
      </div>
    </div>
  );
}
