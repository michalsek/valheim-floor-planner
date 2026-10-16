/**
 * Registers the `three/webgpu` classes (node materials included) as r3f JSX
 * elements. Import this once before rendering any `<Canvas>`.
 */
import { extend, type ThreeToJSXElements } from '@react-three/fiber';
import * as THREE from 'three/webgpu';

declare module '@react-three/fiber' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface ThreeElements extends ThreeToJSXElements<typeof THREE> {}
}

extend(THREE as never);
