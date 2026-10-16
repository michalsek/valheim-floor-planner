import { useEffect, useState } from 'react';

import { getImage } from './imageStore';

export type UnderlayImage =
  | { state: 'loading'; url: null }
  | { state: 'missing'; url: null }
  | { state: 'ready'; url: string };

const LOADING: UnderlayImage = { state: 'loading', url: null };

/**
 * An object URL for a stored image, made inside the effect (so StrictMode's double
 * run makes and revokes its own) and revoked when the id changes or on unmount.
 */
export const useUnderlayImage = (imageId: string | null): UnderlayImage => {
  const [image, setImage] = useState<{ id: string | null; value: UnderlayImage }>({
    id: imageId,
    value: LOADING,
  });

  useEffect(() => {
    if (imageId === null) return;
    let url: string | null = null;
    let cancelled = false;
    void getImage(imageId).then((blob) => {
      if (cancelled) return;
      if (!blob) {
        setImage({ id: imageId, value: { state: 'missing', url: null } });
        return;
      }
      url = URL.createObjectURL(blob);
      setImage({ id: imageId, value: { state: 'ready', url } });
    });
    return () => {
      cancelled = true;
      if (!url) return;
      URL.revokeObjectURL(url);
      // Forget the revoked URL, so switching back to this id (A → B → A) shows
      // "loading" until a fresh one is made, never the dead one.
      const revoked = url;
      setImage((s) => (s.value.url === revoked ? { id: null, value: LOADING } : s));
    };
  }, [imageId]);

  // A new id shows "loading" until its image arrives, never the old image.
  return image.id === imageId ? image.value : LOADING;
};
