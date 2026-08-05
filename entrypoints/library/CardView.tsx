import { useEffect, useMemo, useState } from 'preact/hooks';
import { ColorIconPicker, type TagValue } from '@/components/ColorIconPicker';
import { getThumbnail } from '@/lib/captureStore';
import { contrastPairs, type WcagLevel } from '@/lib/contrast';
import { EXPORT_FORMATS, getFormat } from '@/lib/exporters';
import { updateCard } from '@/lib/storage';
import type { ColorRole, FontSource, Palette, StyleCard } from '@/lib/types';
import { COLOR_ROLES } from '@/lib/types';

const ROLE_LABELS: Record<ColorRole, string> = {
  background: 'Backgrounds',
  text: 'Text',
  accent: 'Accents',
  border: 'Borders',
};

const WCAG_BADGE_CLASS: Record<WcagLevel, string> = {
  AAA: 'wcag-pass',
  AA: 'wcag-pass',
  'AA Large': 'wcag-large',
  Fail: 'wcag-fail',
};

const SOURCE_LABELS: Record<FontSource, string> = {
  google: 'Google Fonts',
  adobe: 'Adobe Fonts',
  'self-hosted': 'Self-hosted',
  system: 'System',
  unknown: 'Unknown',
};

function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text);
}

function download(filename: string, text: string, mime: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function CardView({ card, onDelete }: { card: StyleCard; onDelete: (id: string) => void }) {
  const [thumb, setThumb] = useState<string | null>(null);
  const [formatId, setFormatId] = useState(EXPORT_FORMATS[0].id);
  const [notes, setNotes] = useState(card.notes);
  const [copied, setCopied] = useState(false);
  const [tag, setTag] = useState<TagValue>({ color: card.color, icon: card.icon });
  const [showPicker, setShowPicker] = useState(false);
  const [palette, setPalette] = useState<Palette>(card.palette);

  const patchPalette = (next: Palette) => {
    setPalette(next);
    void updateCard(card.id, { palette: next });
  };

  const removeSwatch = (role: ColorRole, hex: string) => {
    patchPalette({ ...palette, [role]: palette[role].filter((s) => s.hex !== hex) });
  };

  // Splitting undoes a perceptual merge: the absorbed shades return as their
  // own swatches and the canonical keeps only its own count.
  const splitSwatch = (role: ColorRole, hex: string) => {
    const swatch = palette[role].find((s) => s.hex === hex);
    if (!swatch?.merged?.length) return;
    const own = swatch.count - swatch.merged.reduce((sum, m) => sum + m.count, 0);
    const next = [
      ...palette[role].filter((s) => s.hex !== hex),
      { hex: swatch.hex, count: own },
      ...swatch.merged.map((m) => ({ ...m })),
    ].sort((a, b) => b.count - a.count || a.hex.localeCompare(b.hex));
    patchPalette({ ...palette, [role]: next });
  };

  const setTagValue = (patch: TagValue) => {
    const next = { ...tag, ...patch };
    setTag(next);
    void updateCard(card.id, { color: next.color, icon: next.icon });
  };

  useEffect(() => {
    let url: string | null = null;
    void getThumbnail(card.id).then((blob) => {
      if (blob) {
        url = URL.createObjectURL(blob);
        setThumb(url);
      }
    });
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [card.id]);

  const exported = useMemo(
    () => getFormat(formatId)?.render({ ...card, palette }) ?? '',
    [formatId, card, palette],
  );

  // Recomputed from the curated palette, so removing a junk swatch also
  // removes its contrast rows.
  const contrast = useMemo(() => contrastPairs(palette), [palette]);

  const doCopy = async () => {
    await copyToClipboard(exported);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const doDownload = () => {
    const fmt = getFormat(formatId);
    if (!fmt) return;
    const host = safeHost(card.url);
    download(`stylegrab-${host}.${fmt.ext}`, exported, fmt.mime);
  };

  const saveNotes = () => {
    if (notes !== card.notes) void updateCard(card.id, { notes });
  };

  return (
    <div class="card" style="display: grid; gap: 14px;">
      <div class="row" style="align-items: flex-start; gap: 14px;">
        {thumb ? (
          <img
            src={thumb}
            alt=""
            style="width: 220px; height: auto; border-radius: 6px; border: 1px solid var(--border); flex: 0 0 auto;"
          />
        ) : (
          <div
            style="width: 220px; height: 130px; border-radius: 6px; border: 1px dashed var(--border); flex: 0 0 auto; display: flex; align-items: center; justify-content: center; color: var(--faint); font-size: 12px;"
          >
            no thumbnail
          </div>
        )}
        <div style="flex: 1; min-width: 0;">
          <div class="row" style="gap: 8px; margin-bottom: 2px;">
            {(tag.icon || tag.color) && (
              <span class="tag-chip" style={tag.color ? `border-color:${tag.color}` : undefined}>
                {tag.color && <span class="tag-dot" style={`background:${tag.color}`} />}
                {tag.icon && <span>{tag.icon}</span>}
              </span>
            )}
            <a
              href={card.url}
              target="_blank"
              rel="noreferrer"
              style="color: var(--accent-hover); word-break: break-all; flex: 1;"
            >
              {card.title || card.url}
            </a>
          </div>
          <div class="hint">{new Date(card.createdAt).toLocaleString()}</div>
        </div>
        <button
          style="flex: 0 0 auto;"
          aria-pressed={showPicker}
          onClick={() => setShowPicker((v) => !v)}
        >
          🏷️ Tag
        </button>
        <button class="danger" style="flex: 0 0 auto;" onClick={() => onDelete(card.id)}>
          Delete
        </button>
      </div>

      {showPicker && <ColorIconPicker color={tag.color} icon={tag.icon} onChange={setTagValue} />}

      {COLOR_ROLES.map((role) =>
        palette[role].length ? (
          <div key={role}>
            <h2>{ROLE_LABELS[role]}</h2>
            <div style="display: flex; flex-wrap: wrap; gap: 8px;">
              {palette[role].map((swatch) => (
                <div key={swatch.hex} class="swatch" title={`${swatch.hex} · ${swatch.count}×`}>
                  <span class="swatch-chip" style={`background:${swatch.hex}`} />
                  <span class="swatch-hex">{swatch.hex}</span>
                  {swatch.merged?.length ? (
                    <button
                      class="swatch-action"
                      title={`Merged: ${swatch.merged.map((m) => m.hex).join(', ')} — click to split`}
                      aria-label={`Split ${role} ${swatch.hex}`}
                      onClick={() => splitSwatch(role, swatch.hex)}
                    >
                      +{swatch.merged.length}
                    </button>
                  ) : null}
                  <button
                    class="swatch-action"
                    title="Remove this colour from the capture"
                    aria-label={`Remove ${role} ${swatch.hex}`}
                    onClick={() => removeSwatch(role, swatch.hex)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : null,
      )}

      {contrast.length > 0 && (
        <div>
          <h2>Contrast</h2>
          <div style="display: grid; gap: 6px;">
            {contrast.map((p) => (
              <div key={`${p.text.hex}-${p.background.hex}`} class="row" style="gap: 8px;">
                <span
                  class="contrast-sample"
                  style={`background:${p.background.hex}; color:${p.text.hex}`}
                >
                  Aa
                </span>
                <span class="hint" style="flex: 1;">
                  {p.text.hex} on {p.background.hex}
                </span>
                <span class="hint">{p.ratio.toFixed(2)}:1</span>
                <span class={`wcag-badge ${WCAG_BADGE_CLASS[p.level]}`}>{p.level}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {card.typography.length > 0 && (
        <div>
          <h2>Typography</h2>
          <div style="display: grid; gap: 8px;">
            {card.typography.map((t) => (
              <div key={t.family} style="display: grid; gap: 2px;">
                <div class="row" style="gap: 8px;">
                  <strong style="flex: 0 0 auto; font-family: var(--font-preview);">{t.family}</strong>
                  <span class="source-badge">{SOURCE_LABELS[t.source]}</span>
                </div>
                <div class="hint" style="word-break: break-all;">{t.stack}</div>
                <div class="hint">
                  weights: {t.weights.join(', ') || '—'} · sizes: {t.sizes.map((s) => `${s}px`).join(', ') || '—'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h2>Notes</h2>
        <textarea
          rows={2}
          value={notes}
          onInput={(e) => setNotes(e.currentTarget.value)}
          onBlur={saveNotes}
          placeholder="Your notes about this capture…"
        />
      </div>

      <div>
        <h2>Export</h2>
        <div class="row" style="gap: 8px; margin-bottom: 8px;">
          <select
            style="flex: 0 0 auto; width: auto;"
            value={formatId}
            onChange={(e) => setFormatId(e.currentTarget.value)}
          >
            {EXPORT_FORMATS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
          <button class="primary" style="flex: 0 0 auto;" onClick={doCopy}>
            {copied ? '✓ Copied' : 'Copy'}
          </button>
          <button style="flex: 0 0 auto;" onClick={doDownload}>
            Download
          </button>
        </div>
        <textarea
          readOnly
          rows={Math.min(16, Math.max(4, exported.split('\n').length))}
          class="export-preview"
          value={exported}
        />
      </div>
    </div>
  );
}

function safeHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '') || 'capture';
  } catch {
    return 'capture';
  }
}
