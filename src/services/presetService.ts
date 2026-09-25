import type { Song } from '../types/karaoke';
import { SAMPLE_ANIME_SONGS, parseLRC } from './lyricParser';

const PRESETS_STORAGE_KEY = 'j_stage_presets_v1';

export const getBackendServerUrl = (): string => {
  return `${window.location.protocol}//${window.location.hostname}:3001`;
};

export class PresetService {
  private static instance: PresetService;
  private presets: Song[] = [];

  private constructor() {
    this.loadPresets();
    this.syncWithServerDisk();
  }

  public static getInstance(): PresetService {
    if (!PresetService.instance) {
      PresetService.instance = new PresetService();
    }
    return PresetService.instance;
  }

  private loadPresets() {
    try {
      const saved = localStorage.getItem(PRESETS_STORAGE_KEY);
      if (saved) {
        this.presets = JSON.parse(saved);
      } else {
        // Initialize with default sample songs
        this.presets = SAMPLE_ANIME_SONGS.map(s => ({
          ...s,
          parsedLyrics: parseLRC(s.rawLyrics)
        }));
        this.saveToStorage();
      }
    } catch (e) {
      console.warn("Could not load presets from local storage:", e);
      this.presets = [];
    }
  }

  // Fetch disk-persisted presets from Node backend server
  private async syncWithServerDisk() {
    try {
      const serverUrl = getBackendServerUrl();
      const res = await fetch(`${serverUrl}/api/presets`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.presets) && data.presets.length > 0) {
          // Merge server disk presets with local presets
          const mergedMap = new Map<string, Song>();
          this.presets.forEach(p => mergedMap.set(p.title + p.artist, p));
          data.presets.forEach((p: Song) => mergedMap.set(p.title + p.artist, p));

          this.presets = Array.from(mergedMap.values());
          localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(this.presets));
        } else if (this.presets.length > 0) {
          // Push initial presets to server disk
          this.saveToServerDisk();
        }
      }
    } catch (e) {
      // Backend not reached, running in standalone browser mode
    }
  }

  private async saveToServerDisk() {
    try {
      const serverUrl = getBackendServerUrl();
      await fetch(`${serverUrl}/api/presets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ presets: this.presets })
      });
    } catch (e) {
      // Silent catch if server offline
    }
  }

  // Pull presets directly from GitHub via backend
  public async pullFromGithub(): Promise<{ success: boolean; message: string; count?: number; presets?: Song[] }> {
    try {
      const serverUrl = getBackendServerUrl();
      const res = await fetch(`${serverUrl}/api/git/pull`, {
        method: 'POST'
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (Array.isArray(data.presets)) {
          this.presets = data.presets.map((s: any) => ({
            ...s,
            parsedLyrics: (s.parsedLyrics && s.parsedLyrics.length > 0)
              ? s.parsedLyrics
              : (s.rawLyrics ? parseLRC(s.rawLyrics) : [])
          }));
          localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(this.presets));
        }
        return { success: true, message: data.message, count: this.presets.length, presets: this.presets };
      } else {
        return { success: false, message: data.error || 'Gagal menarik data dari GitHub' };
      }
    } catch (e: any) {
      return { success: false, message: e.message || 'Koneksi ke backend server gagal' };
    }
  }

  // Push presets directly to GitHub via backend
  public async pushToGithub(commitMessage?: string): Promise<{ success: boolean; message: string; alreadyUpToDate?: boolean }> {
    try {
      const serverUrl = getBackendServerUrl();
      const res = await fetch(`${serverUrl}/api/git/push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          presets: this.presets,
          commitMessage
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        return { success: true, message: data.message, alreadyUpToDate: data.alreadyUpToDate };
      } else {
        return { success: false, message: data.error || 'Gagal melakukan push ke GitHub' };
      }
    } catch (e: any) {
      return { success: false, message: e.message || 'Koneksi ke backend server gagal' };
    }
  }

  // Get Git Status
  public async getGitStatus(): Promise<{ success: boolean; lastCommit?: string; hasLocalChanges?: boolean; error?: string }> {
    try {
      const serverUrl = getBackendServerUrl();
      const res = await fetch(`${serverUrl}/api/git/status`);
      return await res.json();
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  private saveToStorage() {
    try {
      localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(this.presets));
      this.saveToServerDisk();
    } catch (e) {
      console.warn("Could not save presets to storage:", e);
    }
  }

  public getPresets(): Song[] {
    return [...this.presets];
  }

  public savePreset(song: Song): Song {
    const existingIndex = this.presets.findIndex(p => p.id === song.id || (p.title === song.title && p.artist === song.artist));
    const presetSong: Song = {
      ...song,
      id: song.id || `preset-${Date.now()}`
    };

    if (existingIndex >= 0) {
      this.presets[existingIndex] = presetSong;
    } else {
      this.presets.unshift(presetSong);
    }

    this.saveToStorage();
    return presetSong;
  }

  public deletePreset(songId: string) {
    this.presets = this.presets.filter(p => p.id !== songId);
    this.saveToStorage();
  }

  public exportPresetsAsJson(): string {
    return JSON.stringify(this.presets, null, 2);
  }

  public importPresetsFromJson(jsonString: string): boolean {
    try {
      const parsed = JSON.parse(jsonString);
      if (Array.isArray(parsed)) {
        this.presets = parsed.map(s => ({
          ...s,
          parsedLyrics: (s.parsedLyrics && s.parsedLyrics.length > 0)
            ? s.parsedLyrics
            : (s.rawLyrics ? parseLRC(s.rawLyrics) : [])
        }));
        this.saveToStorage();
        return true;
      }
      return false;
    } catch (e) {
      console.error("Invalid JSON preset format:", e);
      return false;
    }
  }
}
