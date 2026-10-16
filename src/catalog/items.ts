/**
 * Display names for resource item ids. The catalogue extract has ids only, so this
 * is a small hand-kept map; unknown ids are shown as they are.
 */
const ITEM_LABELS: Record<string, string> = {
  Wood: 'Wood',
  FineWood: 'Fine wood',
  RoundLog: 'Core wood',
  ElderBark: 'Ancient bark',
  YggdrasilWood: 'Yggdrasil wood',
  Blackwood: 'Ashwood',
  Stone: 'Stone',
  Grausten: 'Grausten',
  BlackMarble: 'Black marble',
  Iron: 'Iron',
  Tar: 'Tar',
  Gold: 'Gold',
  FlametalNew: 'Flametal',
};

export const itemLabel = (id: string): string => ITEM_LABELS[id] ?? id;
