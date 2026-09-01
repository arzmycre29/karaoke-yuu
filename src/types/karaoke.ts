export type EventMode = 'train' | 'competition';
export type ViewType = 'stage' | 'operator' | 'judge' | 'request';
export type MediaSourceType = 'youtube' | 'local';

export interface LyricWord {
  text: string;
  startTime: number;
  endTime: number;
  furigana?: string;
}

export interface LyricLine {
  id: string;
  startTime: number;
  endTime: number;
  text: string;
  romaji?: string;
  furigana?: string;
  words?: LyricWord[];
}

export interface Song {
  id: string;
  title: string;
  artist: string;
  source: MediaSourceType;
  youtubeId?: string;
  mediaUrl?: string; // For local audio/video (Vocal / Main Version)
  isVideo?: boolean; // True if local file is MP4 / WebM video
  instrumentalUrl?: string; // Dedicated Studio Instrumental / Off-Vocal Track
  instrumentalFileName?: string;
  duration: number;
  rawLyrics?: string;
  parsedLyrics?: LyricLine[];
  coverArt?: string;
  animeTitle?: string;
}

export interface QueueItem {
  id: string;
  song: Song;
  singerName: string;
  performerNote?: string;
  mode: EventMode;
  addedAt: number;
  status: 'waiting' | 'playing' | 'completed';
}

export interface ScoringCriterion {
  id: string;
  name: string;
  description: string;
  weight: number; // e.g. 25 (%)
  maxScore: number; // e.g. 100
}

export interface ScoringConfig {
  pitchWeight: number; // e.g. 30 (%)
  judgeWeight: number; // e.g. 70 (%)
  criteria: ScoringCriterion[];
}

export interface JudgeSubmission {
  judgeId: string;
  judgeName: string;
  queueItemId: string;
  criteriaScores: Record<string, number>; // criterionId -> score (0-100)
  totalJudgeScore: number;
  comments?: string;
  submittedAt: number;
}

export interface ParticipantScore {
  id: string;
  queueItemId: string;
  singerName: string;
  songTitle: string;
  artist: string;
  pitchScore: number;
  judgeScore: number;
  finalScore: number;
  breakdown: {
    pitchScore: number;
    judgeAverage: number;
    judgeSubmissionsCount: number;
  };
  completedAt: number;
}

export interface LivePitchData {
  detectedFrequency: number;
  detectedNote: string;
  clarity: number; // 0 to 1
  currentPitchScore: number; // 0 to 100
  isMicActive: boolean;
}

export interface JudgeInfo {
  id: string;
  name: string;
  lastActive: number;
}

export interface PlayerCommand {
  type: 'seek' | 'replay' | 'stop';
  targetTime: number;
  timestamp: number;
}

export interface AppState {
  currentQueueItem: QueueItem | null;
  queue: QueueItem[];
  history: ParticipantScore[];
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  vocalGuide: boolean;
  activeMode: EventMode;
  scoringConfig: ScoringConfig;
  livePitch: LivePitchData;
  judges: JudgeInfo[];
  submissions: JudgeSubmission[];
  showLeaderboard: boolean;
  showScoreOverlay: boolean;
  activeSingerScoreSummary?: ParticipantScore | null;
  soundFxTrigger?: { id: string; name: string; timestamp: number } | null;
  playerCommand?: PlayerCommand | null;
}
