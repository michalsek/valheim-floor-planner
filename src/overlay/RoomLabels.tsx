import { formatArea, formatCompact, formatSize } from '../format';
import type { Box } from '../model/geometry/rings';
import type { Room } from '../model/rooms';
import { useViewport } from '../store/hooks';
import { useDerivedPlan } from '../store/planHooks';

import styles from './Overlay.module.css';
import { roomLabelLevel } from './roomLabelLevel';
import { textWidth, type TextFont } from './textWidth';
import { useWorldToScreen } from './useWorldToScreen';

const LINE_HEIGHT = 16;

// Must match the font sizes and weights in Overlay.module.css.
const MAIN: TextFont = { sizePx: 12, weight: 600 };
const DETAIL: TextFont = { sizePx: 11, weight: 400 };
const ROOF: TextFont = { sizePx: 11, weight: 600 };

interface Line {
  text: string;
  className: string | undefined;
  font: TextFont;
}

/** A box's sizes, marked when the outline isn't a plain rectangle. */
const sizeOf = (box: Box, isRect: boolean, digits?: number, unit = ''): string =>
  `${formatSize(box.w, box.d, digits)}${unit}${isRect ? '' : ' (bounds)'}`;

const NO_CLEAR = 'no clear space';

const mainLine = (room: Room): string =>
  room.clearBox
    ? `clear ${sizeOf(room.clearBox, room.clearIsRect, 2, ' m')} · ${formatArea(room.clearArea)}`
    : `grid ${formatSize(room.gridBox.w, room.gridBox.d)} · ${NO_CLEAR}`;

const detailLine = (room: Room): string => {
  const outer = `outer ${sizeOf(room.outerBox, room.outerIsRect, 2)}`;
  return room.clearBox ? `grid ${sizeOf(room.gridBox, room.gridIsRect)} · ${outer}` : outer;
};

const roofLine = (room: Room): Line | null => {
  const { roof } = room;
  if (!roof) return null;
  if (!roof.wholePiece) {
    return {
      text: `roof ${formatCompact(roof.span)} m ⚠ off-grid ridge`,
      className: styles.roofWarn,
      font: ROOF,
    };
  }
  const { p26, p45, p67 } = roof.rise;
  const rises = [p26, p45, p67].map(formatCompact).join(' / ');
  return {
    text: `roof ${formatCompact(roof.span)} m ✓ ridge ${rises} m`,
    className: styles.roofOk,
    font: ROOF,
  };
};

const widest = (lines: readonly Line[]): number =>
  Math.max(0, ...lines.map((line) => textWidth(line.text, line.font)));

const linesFor = (room: Room, wPx: number, dPx: number): Line[] => {
  const main = { text: mainLine(room), className: styles.roomLabel, font: MAIN };
  const roof = roofLine(room);
  const levels = {
    full: [
      main,
      { text: detailLine(room), className: styles.labelSecondary, font: DETAIL },
      ...(roof ? [roof] : []),
    ],
    compact: [main],
    area: [
      {
        text: room.clearBox ? formatArea(room.clearArea) : NO_CLEAR,
        className: styles.roomLabel,
        font: MAIN,
      },
    ],
  };
  const level = roomLabelLevel(wPx, dPx, {
    full: widest(levels.full),
    compact: widest(levels.compact),
    area: widest(levels.area),
  });
  return level === 'none' ? [] : levels[level];
};

/** Each room's sizes, area and roof fit, centred in its largest free rectangle. */
export const RoomLabels = () => {
  const { rooms } = useDerivedPlan();
  const { zoom } = useViewport();
  const toScreen = useWorldToScreen();

  return (
    <g>
      {rooms.map((room) => {
        const { center, w, d } = room.labelSpot;
        const lines = linesFor(room, w * zoom, d * zoom);
        if (lines.length === 0) return null;
        const at = toScreen(center);
        const top = at.y - ((lines.length - 1) * LINE_HEIGHT) / 2;
        return (
          <g key={room.key}>
            {lines.map((line, i) => (
              <text
                key={i}
                className={line.className}
                x={at.x}
                y={top + i * LINE_HEIGHT}
                paintOrder="stroke"
              >
                {line.text}
              </text>
            ))}
          </g>
        );
      })}
    </g>
  );
};
