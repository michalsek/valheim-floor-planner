/**
 * `StreamingAssets/SoftRef/manifest_extended`: plain text listing every asset as
 *
 *     - asset ID: <hash>
 *       bundle: <bundle name>
 *       path in bundle: <asset path>
 *
 * Bundle names are hashes that differ between builds, so we look them up here.
 */

/** The bundle holding `assetPath`, or null when the manifest doesn't list it. */
export const bundleFor = (text: string, assetPath: string): string | null => {
  const wanted = `path in bundle: ${assetPath}`;
  let bundle: string | null = null;
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (line.startsWith('- asset ID:')) bundle = null;
    else if (line.startsWith('bundle:')) bundle = line.slice('bundle:'.length).trim();
    else if (line === wanted) return bundle;
  }
  return null;
};
