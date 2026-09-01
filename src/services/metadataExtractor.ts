import * as musicMetadata from 'music-metadata-browser';

export interface ExtractedMetadata {
  title: string;
  artist: string;
  album?: string;
  duration?: number;
  coverArt?: string;
}

/**
 * Extracts ID3 / metadata directly from local audio file in browser
 */
export async function extractAudioMetadata(file: File): Promise<ExtractedMetadata> {
  // Default fallback from filename
  const cleanFileName = file.name.replace(/\.[^/.]+$/, '');
  let fallbackTitle = cleanFileName;
  let fallbackArtist = 'Custom Artist';

  if (cleanFileName.includes(' - ')) {
    const parts = cleanFileName.split(' - ');
    fallbackArtist = parts[0].trim();
    fallbackTitle = parts.slice(1).join(' - ').trim();
  }

  try {
    const metadata = await musicMetadata.parseBlob(file);
    const common = metadata.common;

    let coverArt: string | undefined = undefined;
    if (common.picture && common.picture.length > 0) {
      const pic = common.picture[0];
      const base64 = btoa(
        new Uint8Array(pic.data).reduce((data, byte) => data + String.fromCharCode(byte), '')
      );
      coverArt = `data:${pic.format};base64,${base64}`;
    }

    return {
      title: common.title || fallbackTitle,
      artist: common.artist || fallbackArtist,
      album: common.album,
      duration: metadata.format.duration ? Math.round(metadata.format.duration) : undefined,
      coverArt
    };
  } catch (err) {
    console.warn("Could not read ID3 metadata from file, using filename fallback:", err);
    return {
      title: fallbackTitle,
      artist: fallbackArtist
    };
  }
}
