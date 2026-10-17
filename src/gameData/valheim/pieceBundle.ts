/**
 * The bundle holding the Hammer's piece table: opening its serialized file, and
 * finding the table's prefabs. Shared by the catalogue and model extraction.
 */
import type { ByteSource } from '../bytes/ByteSource';
import { GameDataError } from '../GameDataError';
import { openBundle, type Bundle } from '../unity/bundle';
import {
  CLASS_MONO_BEHAVIOUR,
  openSerializedFile,
  type SerializedFile,
} from '../unity/serializedFile';
import { fields, list, localRef, str, type Fields } from '../unity/values';

import { HAMMER_TABLE_PATH } from './constants';
import { componentsOf } from './hierarchy';

const CLASS_ASSET_BUNDLE = 142;
const SERIALIZED_NODE = 0x4;
const FIELD_PIECE_TABLE = 'm_pieces';

export interface PieceBundle {
  bundle: Bundle;
  file: SerializedFile;
}

export const openPieceBundle = (bundleSource: ByteSource): PieceBundle => {
  const bundle = openBundle(bundleSource);
  const node =
    bundle.nodes.find((n) => n.flags & SERIALIZED_NODE) ??
    bundle.nodes.find((n) => !/\.(resS|resource)$/.test(n.name));
  if (!node) throw new GameDataError('corrupt', 'bundle has no serialized file');
  return { bundle, file: openSerializedFile(bundle.node(node.name)) };
};

/** The first MonoBehaviour of `go` whose type has a field called `field`. */
export const behaviourWith = (file: SerializedFile, go: Fields, field: string): bigint | null =>
  componentsOf(go).find(
    (id) =>
      file.classId(id) === CLASS_MONO_BEHAVIOUR &&
      (file.typeOf(id).node?.children.some((c) => c.name === field) ?? false)
  ) ?? null;

/** The asset at `path` in the bundle's container (paths compare case-insensitively). */
const containerAsset = (file: SerializedFile, path: string): bigint | null => {
  const wanted = path.toLowerCase();
  for (const id of file.idsOfClass(CLASS_ASSET_BUNDLE)) {
    const bundle = fields(file.read(id), 'AssetBundle');
    for (const entry of list(bundle.m_Container, 'm_Container')) {
      const [key, info] = list(entry, 'm_Container entry');
      if (str(key, 'container path').toLowerCase() === wanted) {
        return localRef(fields(info, 'AssetInfo').asset, 'asset');
      }
    }
  }
  return null;
};

/** The prefab IDs on the Hammer's piece table, in table order. */
export const pieceTable = (file: SerializedFile): bigint[] => {
  const tableId = containerAsset(file, HAMMER_TABLE_PATH);
  if (tableId === null) throw new GameDataError('missingPieces', 'no Hammer piece table');
  const table = behaviourWith(file, fields(file.read(tableId), 'piece table'), FIELD_PIECE_TABLE);
  if (table === null) throw new GameDataError('missingPieces', 'empty piece table');
  return list(fields(file.read(table), 'PieceTable').m_pieces, 'm_pieces').flatMap((ptr) => {
    const id = localRef(ptr, 'm_pieces');
    return id === null ? [] : [id];
  });
};
