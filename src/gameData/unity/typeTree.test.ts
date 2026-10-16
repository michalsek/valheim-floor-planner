import { describe, expect, it } from 'vitest';

import { ByteReader } from '../bytes/ByteReader';

import { COMMON_STRINGS } from './commonStrings';
import { parseTypeTreeBlob, readValue } from './typeTree';

const ALIGN = 0x4000;
const common = (s: string) => ([...COMMON_STRINGS].find(([, v]) => v === s)![0] | 0x80000000) >>> 0;

/** A format-22 blob: 32-byte nodes, then the local string buffer. */
const blob = (nodes: [level: number, type: string, name: string, flags?: number][]) => {
  let strings = '';
  const offset = (s: string) => {
    if ([...COMMON_STRINGS.values()].includes(s)) return common(s);
    const at = strings.length;
    strings += `${s}\0`;
    return at;
  };
  const body = new DataView(new ArrayBuffer(8 + nodes.length * 32));
  body.setInt32(0, nodes.length, true);
  nodes.forEach(([level, type, name, flags = 0], i) => {
    const at = 8 + i * 32;
    body.setUint8(at + 2, level);
    body.setUint32(at + 4, offset(type), true);
    body.setUint32(at + 8, offset(name), true);
    body.setInt32(at + 20, flags, true);
  });
  body.setInt32(4, strings.length, true);
  return new Uint8Array([...new Uint8Array(body.buffer), ...new TextEncoder().encode(strings)]);
};

describe('type trees', () => {
  const root = parseTypeTreeBlob(
    new ByteReader(
      blob([
        [0, 'Piece', 'Base'],
        [1, 'string', 'm_Name'],
        [2, 'Array', 'Array', ALIGN],
        [3, 'int', 'size'],
        [3, 'char', 'data'],
        [1, 'bool', 'm_Active', ALIGN],
        [1, 'vector', 'm_Ids'],
        [2, 'Array', 'Array', ALIGN],
        [3, 'int', 'size'],
        [3, 'SInt64', 'data'],
        [1, 'float', 'm_Health'],
      ]),
      true
    )
  );

  it('builds the node tree with common and local strings', () => {
    expect(root.type).toBe('Piece');
    expect(root.name).toBe('Base');
    expect(root.children.map((c) => c.name)).toEqual(['m_Name', 'm_Active', 'm_Ids', 'm_Health']);
    expect(root.children[2]!.children[0]!.children[1]!.type).toBe('SInt64');
  });

  it('reads a value with alignment, 64-bit integers and typed arrays', () => {
    const data = new DataView(new ArrayBuffer(36));
    data.setInt32(0, 3, true);
    new Uint8Array(data.buffer).set(new TextEncoder().encode('Bed'), 4); // padded to 8
    data.setUint8(8, 1); // bool, padded to 12
    data.setInt32(12, 2, true);
    data.setBigInt64(16, 4337326046729615269n, true);
    data.setBigInt64(24, -1n, true);
    data.setFloat32(32, 400, true);
    const r = new ByteReader(new Uint8Array(data.buffer), true);
    const value = readValue(root, r) as Record<string, unknown>;
    expect(value.m_Name).toBe('Bed');
    expect(value.m_Active).toBe(true);
    expect([...(value.m_Ids as BigInt64Array)]).toEqual([4337326046729615269n, -1n]);
    expect(value.m_Health).toBe(400);
    expect(r.pos).toBe(36);
  });
});
