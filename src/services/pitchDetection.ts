import type { LivePitchData } from '../types/karaoke';

const NOTE_STRINGS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export function frequencyToNote(frequency: number): { noteName: string; octave: number; cents: number; midi: number } {
  const noteNum = 12 * (Math.log(frequency / 440) / Math.log(2));
  const midi = Math.round(noteNum) + 69;
  const noteIndex = (midi % 12 + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  const cents = Math.floor((noteNum - Math.round(noteNum)) * 100);

  return {
    noteName: `${NOTE_STRINGS[noteIndex]}${octave}`,
    octave,
    cents,
    midi
  };
}

export function autoCorrelate(buffer: Float32Array, sampleRate: number): { frequency: number; confidence: number } {
  const SIZE = buffer.length;
  let rms = 0;

  for (let i = 0; i < SIZE; i++) {
    const val = buffer[i];
    rms += val * val;
  }
  rms = Math.sqrt(rms / SIZE);

  if (rms < 0.01) {
    return { frequency: -1, confidence: 0 };
  }

  let r1 = 0, r2 = SIZE - 1, thres = 0.2;
  for (let i = 0; i < SIZE / 2; i++) {
    if (Math.abs(buffer[i]) < thres) {
      r1 = i;
      break;
    }
  }
  for (let i = 1; i < SIZE / 2; i++) {
    if (Math.abs(buffer[SIZE - i]) < thres) {
      r2 = SIZE - i;
      break;
    }
  }

  const trimmed = buffer.slice(r1, r2);
  const c = new Float32Array(trimmed.length);

  for (let i = 0; i < trimmed.length; i++) {
    for (let j = 0; j < trimmed.length - i; j++) {
      c[i] = c[i] + trimmed[j] * trimmed[j + i];
    }
  }

  let d = 0;
  while (c[d] > c[d + 1]) d++;
  let maxval = -1, maxpos = -1;
  for (let i = d; i < trimmed.length; i++) {
    if (c[i] > maxval) {
      maxval = c[i];
      maxpos = i;
    }
  }

  let T0 = maxpos;
  const x1 = c[T0 - 1], x2 = c[T0], x3 = c[T0 + 1];
  const a = (x1 + x3 - 2 * x2) / 2;
  const b = (x3 - x1) / 2;
  if (a) T0 = T0 - b / (2 * a);

  const confidence = maxval / c[0];
  const freq = sampleRate / T0;

  if (freq >= 60 && freq <= 1500 && confidence > 0.6) {
    return { frequency: freq, confidence };
  }

  return { frequency: -1, confidence: 0 };
}

export class PitchTracker {
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private micStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private animationFrameId: number | null = null;
  private isRunning: boolean = false;
  private scoreAccumulator: number[] = [];

  public start(onPitchUpdate: (data: LivePitchData) => void, onError?: (err: any) => void): boolean {
    if (this.isRunning) return true;

    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioContextClass();
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 2048;

      navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      }).then(stream => {
        this.micStream = stream;
        if (!this.audioCtx || !this.analyser) return;

        this.sourceNode = this.audioCtx.createMediaStreamSource(stream);
        this.sourceNode.connect(this.analyser);
        this.isRunning = true;

        const buffer = new Float32Array(this.analyser.fftSize);

        const updateLoop = () => {
          if (!this.isRunning || !this.analyser || !this.audioCtx) return;

          this.analyser.getFloatTimeDomainData(buffer);
          const { frequency, confidence } = autoCorrelate(buffer, this.audioCtx.sampleRate);

          let detectedNote = "--";
          let currentScore = 80;

          if (frequency > 0 && confidence > 0.6) {
            const noteInfo = frequencyToNote(frequency);
            detectedNote = noteInfo.noteName;
            
            const centPenalty = Math.min(30, Math.abs(noteInfo.cents) * 0.6);
            const rawScore = Math.max(50, Math.min(100, (confidence * 100) - centPenalty));
            this.scoreAccumulator.push(rawScore);
            if (this.scoreAccumulator.length > 50) this.scoreAccumulator.shift();
            
            const avgScore = this.scoreAccumulator.reduce((a, b) => a + b, 0) / this.scoreAccumulator.length;
            currentScore = Math.round(avgScore);
          }

          onPitchUpdate({
            detectedFrequency: frequency > 0 ? Math.round(frequency) : 0,
            detectedNote,
            clarity: confidence,
            currentPitchScore: currentScore,
            isMicActive: true
          });

          this.animationFrameId = requestAnimationFrame(updateLoop);
        };

        this.animationFrameId = requestAnimationFrame(updateLoop);
      }).catch(err => {
        console.warn("Microphone access not available or denied:", err);
        if (onError) onError(err);
      });

      return true;
    } catch (e) {
      console.error("Failed to initialize PitchTracker:", e);
      if (onError) onError(e);
      return false;
    }
  }

  public stop() {
    this.isRunning = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    if (this.micStream) {
      this.micStream.getTracks().forEach(track => track.stop());
      this.micStream = null;
    }
    if (this.audioCtx) {
      this.audioCtx.close();
      this.audioCtx = null;
    }
    this.scoreAccumulator = [];
  }

  public getAverageSessionScore(): number {
    if (this.scoreAccumulator.length === 0) return 85;
    return Math.round(this.scoreAccumulator.reduce((a, b) => a + b, 0) / this.scoreAccumulator.length);
  }
}
