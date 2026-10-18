import { memo } from 'react';

import { buildMaterial, MATERIAL_LABELS, pieceSizeLabel } from '../../catalog/buildPalette';
import { itemLabel } from '../../catalog/items';
import type { Library } from '../../catalog/library';
import { materialVar } from '../../catalog/materialColors';
import type { PieceDef } from '../../catalog/pieceDefs';
import { keepFocus } from '../../controls/keepFocus';

import styles from './BuildPalette.module.css';
import { cachedGlyph } from './pieceGlyph';
import { useThumbnail } from './useThumbnail';

/** The tooltip: names, prefab, size and material, cost. */
const tooltip = (def: PieceDef, lib: Library): string => {
  const size = pieceSizeLabel(def);
  const material = MATERIAL_LABELS[buildMaterial(def)];
  const cost = def.resources.map((r) => `${r.amount} ${itemLabel(lib, r.item)}`).join(', ');
  return [
    def.name,
    def.namePl !== def.name ? def.namePl : null,
    def.prefab,
    [size, material].filter(Boolean).join(' · '),
    cost ? `Cost: ${cost}` : null,
  ]
    .filter(Boolean)
    .join('\n');
};

const Glyph = ({ def, lib }: { def: PieceDef; lib: Library }) => {
  const glyph = cachedGlyph(def, lib);
  if (!glyph) return <span className={styles.glyph} />;
  return (
    <svg
      className={styles.glyph}
      viewBox={glyph.viewBox}
      style={{ color: materialVar(def.material) }}
      aria-hidden
    >
      {glyph.faces.map((face, i) => (
        <g key={i} className={styles[face.tone]}>
          <path d={face.fill} />
          <path className={styles.edges} d={face.edges} />
        </g>
      ))}
    </svg>
  );
};

interface PieceTileProps {
  def: PieceDef;
  lib: Library;
  armed: boolean;
  onArm(prefab: string): void;
}

/**
 * A palette tile: the piece's model thumbnail once there is one (its glyph meanwhile, or
 * without a model), name and snap size; a click arms it.
 */
export const PieceTile = memo(function PieceTile({ def, lib, armed, onArm }: PieceTileProps) {
  const size = pieceSizeLabel(def);
  const [thumbnail, watchTile] = useThumbnail(def.prefab);
  return (
    <li ref={watchTile}>
      <button
        type="button"
        className={armed ? `${styles.tile} ${styles.armed}` : styles.tile}
        aria-pressed={armed}
        title={tooltip(def, lib)}
        onMouseDown={keepFocus}
        onClick={() => onArm(def.prefab)}
      >
        {thumbnail ? (
          <img className={styles.thumbnail} src={thumbnail} alt="" draggable={false} />
        ) : (
          <Glyph def={def} lib={lib} />
        )}
        <span className={styles.name}>{def.name}</span>
        {size && <span className={styles.size}>{size}</span>}
      </button>
    </li>
  );
});
