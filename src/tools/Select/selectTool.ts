import type { Tool } from '../types';

import { SelectIcon } from './SelectIcon';

/** M1: the select tool only pans. Selection arrives in M4. */
export const selectTool: Tool = {
  id: 'select',
  label: 'Pan / Select',
  shortcut: 'v',
  icon: SelectIcon,
  cursor: 'grab',
  panOnPrimaryDrag: true,
};
