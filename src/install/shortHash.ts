/** A short, stable name for a longer key: the first 8 bytes of its SHA-256, in hex. */
export const shortHash = async (text: string): Promise<string> => {
  const hash = new Uint8Array(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  );
  return Array.from(hash.subarray(0, 8), (b) => b.toString(16).padStart(2, '0')).join('');
};
