import { io, Socket } from 'socket.io-client';
import type { AppState, QueueItem, JudgeSubmission, ParticipantScore } from '../types/karaoke';
import { parseLRC, SAMPLE_ANIME_SONGS } from './lyricParser';

const BROADCAST_CHANNEL_NAME = 'j_stage_karaoke_sync_v1';
const STORAGE_KEY = 'j_stage_karaoke_state_v1';

export const DEFAULT_INITIAL_STATE: AppState = {
  currentQueueItem: {
    id: 'queue-init-1',
    song: {
      ...SAMPLE_ANIME_SONGS[0],
      parsedLyrics: parseLRC(SAMPLE_ANIME_SONGS[0].rawLyrics)
    },
    singerName: 'Yuki & Taka (Train Special)',
    mode: 'train',
    addedAt: Date.now(),
    status: 'playing'
  },
  queue: [
    {
      id: 'queue-init-2',
      song: {
        ...SAMPLE_ANIME_SONGS[1],
        parsedLyrics: parseLRC(SAMPLE_ANIME_SONGS[1].rawLyrics)
      },
      singerName: 'Ren (Contestant #01)',
      performerNote: 'Cover Sing Category A',
      mode: 'competition',
      addedAt: Date.now() + 1000,
      status: 'waiting'
    },
    {
      id: 'queue-init-3',
      song: {
        ...SAMPLE_ANIME_SONGS[2],
        parsedLyrics: parseLRC(SAMPLE_ANIME_SONGS[2].rawLyrics)
      },
      singerName: 'Aoi (Contestant #02)',
      performerNote: 'Key: Original',
      mode: 'competition',
      addedAt: Date.now() + 2000,
      status: 'waiting'
    },
    {
      id: 'queue-init-4',
      song: {
        ...SAMPLE_ANIME_SONGS[3],
        parsedLyrics: parseLRC(SAMPLE_ANIME_SONGS[3].rawLyrics)
      },
      singerName: 'Kenji & Audience (Train)',
      mode: 'train',
      addedAt: Date.now() + 3000,
      status: 'waiting'
    }
  ],
  history: [
    {
      id: 'hist-1',
      queueItemId: 'prev-1',
      singerName: 'Haruto (Contestant #00)',
      songTitle: 'Silhouette (KANA-BOON)',
      artist: 'KANA-BOON',
      pitchScore: 91,
      judgeScore: 94,
      finalScore: 93.1,
      breakdown: {
        pitchScore: 91,
        judgeAverage: 94,
        judgeSubmissionsCount: 3
      },
      completedAt: Date.now() - 3600000
    }
  ],
  isPlaying: false,
  currentTime: 0,
  duration: 285,
  volume: 85,
  isMuted: false,
  vocalGuide: true,
  activeMode: 'train',
  scoringConfig: {
    pitchWeight: 30,
    judgeWeight: 70,
    criteria: [
      { id: 'crit-vocal', name: 'Teknik Vokal & Kontrol', description: 'Pitch accuracy, artikulasi, dynamic range', weight: 35, maxScore: 100 },
      { id: 'crit-express', name: 'Penghayatan & Ekspresi', description: 'Emosi lagu, interpretasi karakter', weight: 30, maxScore: 100 },
      { id: 'crit-stage', name: 'Penguasaan Panggung', description: 'Stage presence, audience engagement', weight: 20, maxScore: 100 },
      { id: 'crit-tone', name: 'Karakter Suara (Tone)', description: 'Keunikan timbre dan stabilitas nada', weight: 15, maxScore: 100 }
    ]
  },
  livePitch: {
    detectedFrequency: 0,
    detectedNote: '--',
    clarity: 0,
    currentPitchScore: 88,
    isMicActive: false
  },
  judges: [
    { id: 'judge-1', name: 'Juri 1 (Vocal Coach)', lastActive: Date.now() },
    { id: 'judge-2', name: 'Juri 2 (Music Producer)', lastActive: Date.now() },
    { id: 'judge-3', name: 'Juri 3 (Guest Utaite)', lastActive: Date.now() }
  ],
  submissions: [],
  showLeaderboard: false,
  showScoreOverlay: false,
  activeSingerScoreSummary: null,
  soundFxTrigger: null
};

export class SyncService {
  private static instance: SyncService;
  private clientId: string = Math.random().toString(36).substring(2, 9);
  private channel: BroadcastChannel | null = null;
  private socket: Socket | null = null;
  private state: AppState = DEFAULT_INITIAL_STATE;
  private listeners: Set<(state: AppState) => void> = new Set();
  private saveStorageTimer: any = null;

  private constructor() {
    this.loadStateFromStorage();
    this.initBroadcastChannel();
    this.initSocket();
  }

  public static getInstance(): SyncService {
    if (!SyncService.instance) {
      SyncService.instance = new SyncService();
    }
    return SyncService.instance;
  }

  private loadStateFromStorage() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        this.state = { ...DEFAULT_INITIAL_STATE, ...parsed, soundFxTrigger: null, playerCommand: null };
      }
    } catch (e) {
      console.warn("Could not load from localStorage:", e);
    }
  }

  // Throttled save to localStorage (avoids freezing main UI thread during 20fps time updates)
  private saveStateToStorage(immediate = false) {
    if (immediate) {
      if (this.saveStorageTimer) clearTimeout(this.saveStorageTimer);
      this.saveStorageTimer = null;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      } catch (e) {
        console.warn("Could not save to localStorage:", e);
      }
      return;
    }

    if (this.saveStorageTimer) return;
    this.saveStorageTimer = setTimeout(() => {
      this.saveStorageTimer = null;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      } catch (e) {
        console.warn("Could not save to localStorage:", e);
      }
    }, 1000);
  }

  private initBroadcastChannel() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      this.channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      this.channel.onmessage = (event) => {
        if (!event.data || event.data.clientId === this.clientId) return;

        if (event.data.type === 'STATE_UPDATE') {
          this.state = event.data.state;
          this.notifyListeners(false);
        } else if (event.data.type === 'TIME_UPDATE') {
          this.state = {
            ...this.state,
            currentTime: event.data.currentTime,
            duration: event.data.duration || this.state.duration
          };
          this.notifyListeners(false);
        }
      };
    }
  }

  private initSocket() {
    try {
      const serverUrl = window.location.hostname === 'localhost' ? 'http://localhost:3001' : window.location.origin;
      this.socket = io(serverUrl, {
        autoConnect: true,
        reconnectionAttempts: 5,
        timeout: 2000
      });

      this.socket.on('connect', () => {
        console.log('🔗 Connected to J-Stage Sync Server');
      });

      this.socket.on('STATE_UPDATE', (newState: AppState) => {
        this.state = newState;
        this.notifyListeners(false);
      });

      this.socket.on('TIME_UPDATE', (timeData: { currentTime: number; duration?: number }) => {
        this.state = {
          ...this.state,
          currentTime: timeData.currentTime,
          duration: timeData.duration || this.state.duration
        };
        this.notifyListeners(false);
      });
    } catch (err) {
      console.warn("Socket.io initialization skipped (running local BroadcastChannel mode)");
    }
  }

  public getState(): AppState {
    return this.state;
  }

  public subscribe(listener: (state: AppState) => void): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(persist = true) {
    if (persist) {
      this.saveStateToStorage(false);
    }
    this.listeners.forEach((l) => l(this.state));
  }

  // Lightweight time update from stage player (never overwrites master state properties)
  public updateTime(currentTime: number, duration?: number) {
    const validTime = Math.max(0, currentTime);
    const validDur = duration && duration > 0 ? duration : this.state.duration;

    this.state = {
      ...this.state,
      currentTime: validTime,
      duration: validDur
    };

    if (this.channel) {
      this.channel.postMessage({
        type: 'TIME_UPDATE',
        currentTime: validTime,
        duration: validDur,
        clientId: this.clientId
      });
    }

    if (this.socket && this.socket.connected) {
      this.socket.emit('TIME_UPDATE', {
        currentTime: validTime,
        duration: validDur
      });
    }

    this.notifyListeners(false);
  }

  public updateState(updater: Partial<AppState> | ((prev: AppState) => AppState)) {
    if (typeof updater === 'function') {
      this.state = updater(this.state);
    } else {
      this.state = { ...this.state, ...updater };
    }

    if (this.channel) {
      this.channel.postMessage({
        type: 'STATE_UPDATE',
        state: this.state,
        clientId: this.clientId
      });
    }

    if (this.socket && this.socket.connected) {
      this.socket.emit('UPDATE_STATE', this.state);
    }

    this.notifyListeners(true);
  }

  public play() {
    this.updateState({ isPlaying: true });
  }

  public pause() {
    this.updateState({ isPlaying: false });
  }

  public togglePlay() {
    this.updateState((prev) => ({
      ...prev,
      isPlaying: !prev.isPlaying
    }));
  }

  public setCurrentSong(item: QueueItem | null) {
    this.updateState((prev) => ({
      ...prev,
      currentQueueItem: item,
      currentTime: 0,
      isPlaying: !!item,
      showScoreOverlay: false,
      submissions: [],
      playerCommand: {
        type: 'replay',
        targetTime: 0,
        timestamp: Date.now()
      }
    }));
  }

  public nextSong() {
    this.updateState((prev) => {
      if (prev.queue.length === 0) {
        return {
          ...prev,
          currentQueueItem: null,
          isPlaying: false,
          currentTime: 0,
          playerCommand: { type: 'stop', targetTime: 0, timestamp: Date.now() }
        };
      }
      const [nextItem, ...remainingQueue] = prev.queue;
      return {
        ...prev,
        currentQueueItem: { ...nextItem, status: 'playing' },
        queue: remainingQueue,
        currentTime: 0,
        isPlaying: true,
        showScoreOverlay: false,
        submissions: [],
        playerCommand: {
          type: 'replay',
          targetTime: 0,
          timestamp: Date.now()
        }
      };
    });
  }

  public seekTo(targetTime: number) {
    const validTime = Math.max(0, Math.min(this.state.duration || 100, targetTime));
    this.updateState((prev) => ({
      ...prev,
      currentTime: validTime,
      playerCommand: {
        type: 'seek',
        targetTime: validTime,
        timestamp: Date.now()
      }
    }));
  }

  public seekRelative(deltaSeconds: number) {
    const target = Math.max(0, Math.min(this.state.duration || 100, this.state.currentTime + deltaSeconds));
    this.seekTo(target);
  }

  public replaySong() {
    this.updateState((prev) => ({
      ...prev,
      currentTime: 0,
      isPlaying: true,
      playerCommand: {
        type: 'replay',
        targetTime: 0,
        timestamp: Date.now()
      }
    }));
  }

  public stopSong() {
    this.updateState((prev) => ({
      ...prev,
      currentTime: 0,
      isPlaying: false,
      playerCommand: {
        type: 'stop',
        targetTime: 0,
        timestamp: Date.now()
      }
    }));
  }

  public setVolume(volume: number) {
    const validVol = Math.max(0, Math.min(100, volume));
    this.updateState((prev) => ({
      ...prev,
      volume: validVol,
      isMuted: false
    }));
  }

  public toggleMute() {
    this.updateState((prev) => ({
      ...prev,
      isMuted: !prev.isMuted
    }));
  }

  public setVocalGuide(enabled: boolean) {
    this.updateState((prev) => ({
      ...prev,
      vocalGuide: enabled
    }));
  }

  public addSongToQueue(item: Omit<QueueItem, 'id' | 'addedAt' | 'status'>) {
    const newItem: QueueItem = {
      ...item,
      id: `queue-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      addedAt: Date.now(),
      status: 'waiting'
    };

    this.updateState((prev) => {
      if (!prev.currentQueueItem) {
        return {
          ...prev,
          currentQueueItem: { ...newItem, status: 'playing' },
          isPlaying: true,
          currentTime: 0
        };
      }
      return {
        ...prev,
        queue: [...prev.queue, newItem]
      };
    });
  }

  public submitJudgeScore(submission: Omit<JudgeSubmission, 'submittedAt'>) {
    const fullSubmission: JudgeSubmission = {
      ...submission,
      submittedAt: Date.now()
    };

    this.updateState((prev) => {
      const filtered = prev.submissions.filter(s => s.judgeId !== submission.judgeId);
      return {
        ...prev,
        submissions: [...filtered, fullSubmission]
      };
    });
  }

  public finalizePerformanceScore(averagePitchScore?: number) {
    this.updateState((prev) => {
      if (!prev.currentQueueItem) return prev;

      const pScore = averagePitchScore !== undefined ? averagePitchScore : prev.livePitch.currentPitchScore || 85;
      
      let avgJudge = 85;
      if (prev.submissions.length > 0) {
        const sum = prev.submissions.reduce((acc, curr) => acc + curr.totalJudgeScore, 0);
        avgJudge = Math.round(sum / prev.submissions.length);
      }

      const pWeight = prev.scoringConfig.pitchWeight / 100;
      const jWeight = prev.scoringConfig.judgeWeight / 100;
      const finalScore = parseFloat((pScore * pWeight + avgJudge * jWeight).toFixed(1));

      const newRecord: ParticipantScore = {
        id: `score-${Date.now()}`,
        queueItemId: prev.currentQueueItem.id,
        singerName: prev.currentQueueItem.singerName,
        songTitle: prev.currentQueueItem.song.title,
        artist: prev.currentQueueItem.song.artist,
        pitchScore: pScore,
        judgeScore: avgJudge,
        finalScore,
        breakdown: {
          pitchScore: pScore,
          judgeAverage: avgJudge,
          judgeSubmissionsCount: prev.submissions.length
        },
        completedAt: Date.now()
      };

      return {
        ...prev,
        history: [newRecord, ...prev.history],
        activeSingerScoreSummary: newRecord,
        showScoreOverlay: true
      };
    });
  }

  public triggerSoundFx(id: string, name: string) {
    this.updateState((prev) => ({
      ...prev,
      soundFxTrigger: { id, name, timestamp: Date.now() }
    }));
  }
}
