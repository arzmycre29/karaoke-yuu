export interface LrcSearchResult {
  id: number;
  trackName: string;
  artistName: string;
  albumName: string;
  duration: number;
  syncedLyrics?: string;
  plainLyrics?: string;
}

/**
 * Searches LRCLIB for synced lyrics by track & artist title
 */
export async function searchLrcLib(query: string, artist?: string): Promise<LrcSearchResult[]> {
  try {
    const params = new URLSearchParams({
      q: query,
      ...(artist ? { artist_name: artist } : {})
    });
    
    const res = await fetch(`https://lrclib.net/api/search?${params.toString()}`);
    if (!res.ok) {
      throw new Error(`LRCLIB returned status ${res.status}`);
    }

    const data = await res.json();
    return data;
  } catch (err) {
    console.warn("Failed to fetch from LRCLIB (offline or network error):", err);
    return [];
  }
}
