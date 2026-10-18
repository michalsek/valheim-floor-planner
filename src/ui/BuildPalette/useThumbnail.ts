/**
 * A palette tile's model thumbnail: wanted while the tile is in view (one shared
 * IntersectionObserver), its URL once rendered or read from the cache; null meanwhile
 * or without a model, when the tile shows its glyph.
 */
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

import {
  getThumbnail,
  subscribeThumbnail,
  unwantThumbnail,
  wantThumbnail,
} from '../../scene/thumbnails/thumbnailStore';

type OnView = (inView: boolean) => void;

const watched = new Map<Element, OnView>();
let observer: IntersectionObserver | null = null;

const observe = (element: Element, onView: OnView): (() => void) => {
  observer ??= new IntersectionObserver(
    (records) => records.forEach((r) => watched.get(r.target)?.(r.isIntersecting)),
    // A row ahead, so thumbnails are usually ready as tiles scroll in.
    { rootMargin: '96px 0px' }
  );
  watched.set(element, onView);
  observer.observe(element);
  return () => {
    watched.delete(element);
    observer?.unobserve(element);
  };
};

/** The thumbnail URL for `prefab`, and the callback ref that watches its tile. */
export const useThumbnail = (
  prefab: string
): [url: string | null, watchTile: (element: Element | null) => void] => {
  const [element, setElement] = useState<Element | null>(null);
  const url = useSyncExternalStore(
    useCallback((listener) => subscribeThumbnail(prefab, listener), [prefab]),
    () => getThumbnail(prefab)
  );

  useEffect(() => {
    if (!element || url) return;
    const stop = observe(element, (inView) =>
      inView ? wantThumbnail(prefab) : unwantThumbnail(prefab)
    );
    return () => {
      stop();
      unwantThumbnail(prefab);
    };
  }, [element, prefab, url]);

  return [url, setElement];
};
