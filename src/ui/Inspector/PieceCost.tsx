import { library } from '../../catalog';
import { itemLabel } from '../../catalog/items';
import { computeBom } from '../../model/bom';
import { Row, Section } from '../shared/PanelList';

/** Piece counts and what they cost, for the pieces (or prop) of the inspected item. */
export const PieceCost = ({ pieces }: { pieces: readonly { prefab: string }[] }) => {
  const bom = computeBom(pieces, library.catalog);
  if (bom.pieces.length === 0) return null;
  return (
    <>
      <Section title="Pieces">
        {bom.pieces.map((line) => (
          <Row key={line.prefab} label={line.name} value={line.count} />
        ))}
      </Section>
      <Section title="Cost">
        {bom.resources.map((line) => (
          <Row key={line.item} label={itemLabel(line.item)} value={line.amount} />
        ))}
      </Section>
    </>
  );
};
