import { describe, expect, it } from 'vitest';

import { readMesh } from './mesh';
import type { StreamingInfo } from './streamingInfo';

/** float → half (exact for the values used here). */
const toHalf = (value: number): number => {
  const view = new DataView(new ArrayBuffer(4));
  view.setFloat32(0, value);
  const bits = view.getUint32(0);
  const exponent = ((bits >> 23) & 0xff) - 127 + 15;
  return value === 0 ? 0 : ((bits >> 16) & 0x8000) | (exponent << 10) | ((bits >> 13) & 0x3ff);
};

const channel = (stream: number, offset: number, format: number, dimension: number) => ({
  stream,
  offset,
  format,
  dimension,
});
const off = channel(0, 0, 0, 0);

describe('readMesh', () => {
  it('decodes two streams: float positions, half4 normals, unorm16 UVs', () => {
    const positions = [0, 0, 0, 1, 0, 0, 0, 2, 0];
    const normals = [0, 0, -1, 0, 1, 0, 0.5, -0.5, 0];
    const uvs = [0, 0, 1, 0.5, 0.25, 1];
    // Stream 0: position (12 B) + half4 normal (8 B) = 20 B × 3 = 60 → stream 1 at 64.
    const bytes = new Uint8Array(32 + 64 + 12);
    const view = new DataView(bytes.buffer, 32);
    for (let v = 0; v < 3; v++) {
      for (let c = 0; c < 3; c++) {
        view.setFloat32(v * 20 + c * 4, positions[v * 3 + c]!, true);
        view.setUint16(12 + v * 20 + c * 2, toHalf(normals[v * 3 + c]!), true);
      }
      view.setUint16(12 + v * 20 + 6, toHalf(1), true); // the unread 4th component
      for (let c = 0; c < 2; c++) {
        view.setUint16(64 + v * 4 + c * 2, Math.round(uvs[v * 2 + c]! * 65535), true);
      }
    }
    const indexBytes = new Uint8Array(new Uint16Array([0, 1, 2, 2, 1, 0]).buffer);
    const reads: StreamingInfo[] = [];

    const mesh = readMesh(
      {
        m_Name: 'synthetic',
        m_MeshCompression: 0,
        m_IndexFormat: 0,
        m_IndexBuffer: indexBytes,
        m_SubMeshes: [
          { firstByte: 0, indexCount: 3, baseVertex: 0, topology: 0 },
          { firstByte: 6, indexCount: 3, baseVertex: 1, topology: 0 },
        ],
        m_VertexData: {
          m_VertexCount: 3,
          m_Channels: [
            channel(0, 0, 0, 3),
            channel(0, 12, 1, 0x34),
            off,
            off,
            channel(1, 0, 4, 2),
            ...Array.from({ length: 9 }, () => off),
          ],
          m_DataSize: new Uint8Array(0),
        },
        m_LocalAABB: { m_Center: { x: 0.5, y: 1, z: 0 }, m_Extent: { x: 0.5, y: 1, z: 0 } },
        m_StreamData: { offset: 32n, size: 76, path: 'archive:/CAB-a/CAB-a.resS' },
      },
      (info) => {
        reads.push(info);
        return bytes.subarray(info.offset, info.offset + info.size);
      }
    );

    expect(reads).toEqual([{ path: 'archive:/CAB-a/CAB-a.resS', offset: 32, size: 76 }]);
    expect([...mesh.positions]).toEqual(positions);
    expect([...mesh.normals!]).toEqual(normals);
    expect([...mesh.uv0!].map((u) => Math.round(u * 1e4) / 1e4)).toEqual(uvs);
    expect(mesh.tangents).toBeNull();
    expect(mesh.streamed).toBe(true);
    expect(mesh.normalFormat).toBe(1);
    expect(mesh.submeshes[1]).toEqual({ start: 3, count: 3, baseVertex: 1, topology: 0 });
    expect(mesh.bounds).toEqual({ min: [0, 0, 0], max: [1, 2, 0] });
  });
});
