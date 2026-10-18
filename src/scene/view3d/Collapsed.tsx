import type { ReactNode } from 'react';

/**
 * Its children, drawn only while `shown`: otherwise collapsed to a point (scale 0)
 * rather than hidden or unmounted, so they still draw (nothing) and their programs
 * link when the 3D view opens, not on the level step that first shows them. Their
 * meshes mustn't be frustum-culled, or a collapsed one may not draw.
 */
export const Collapsed = ({ shown, children }: { shown: boolean; children: ReactNode }) => (
  <group scale={shown ? 1 : 0}>{children}</group>
);
