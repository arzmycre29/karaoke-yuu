/**
 * Web Audio API DSP Real-time Vocal Cancellation Engine (Karaoke Filter)
 * Uses Center-Channel Phase Inversion with Low-Pass Bass Preservation
 */
export class VocalRemoverEngine {
  private audioCtx: AudioContext | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private splitterNode: ChannelSplitterNode | null = null;
  private inverterNode: GainNode | null = null;
  private bassFilterNode: BiquadFilterNode | null = null;
  private dryGainNode: GainNode | null = null;
  private wetGainNode: GainNode | null = null;
  private isEnabled: boolean = false;

  public setup(mediaElement: HTMLMediaElement): boolean {
    try {
      if (this.sourceNode) return true;

      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      this.audioCtx = new AudioCtxClass();

      // Create audio source from HTML5 audio/video element
      this.sourceNode = this.audioCtx.createMediaElementSource(mediaElement);

      // Split stereo channels
      this.splitterNode = this.audioCtx.createChannelSplitter(2);

      // Channel 1 -> Left, Channel 2 -> Right
      // Inverter for Right channel to subtract center vocal: L + (-R)
      this.inverterNode = this.audioCtx.createGain();
      this.inverterNode.gain.value = -1;

      // Low-pass filter (< 150Hz) to preserve kick drum and bassline in mono
      this.bassFilterNode = this.audioCtx.createBiquadFilter();
      this.bassFilterNode.type = 'lowpass';
      this.bassFilterNode.frequency.value = 150;

      // Dry / Wet crossfaders
      this.dryGainNode = this.audioCtx.createGain();
      this.dryGainNode.gain.value = 1.0; // Normal audio

      this.wetGainNode = this.audioCtx.createGain();
      this.wetGainNode.gain.value = 0.0; // Karaoke filtered audio

      // Connect Dry path
      this.sourceNode.connect(this.dryGainNode);
      this.dryGainNode.connect(this.audioCtx.destination);

      // Connect Wet Karaoke path
      this.sourceNode.connect(this.splitterNode);
      this.sourceNode.connect(this.bassFilterNode);

      // Left Channel -> Wet Gain
      this.splitterNode.connect(this.wetGainNode, 0);
      // Right Channel -> Inverter -> Wet Gain
      this.splitterNode.connect(this.inverterNode, 1);
      this.inverterNode.connect(this.wetGainNode);

      // Add preserved bass to Wet path
      this.bassFilterNode.connect(this.wetGainNode);

      this.wetGainNode.connect(this.audioCtx.destination);

      return true;
    } catch (e) {
      console.warn("Could not initialize VocalRemoverEngine (media might be cross-origin or already hooked):", e);
      return false;
    }
  }

  public setVocalRemoval(enabled: boolean) {
    this.isEnabled = enabled;
    if (!this.audioCtx || !this.dryGainNode || !this.wetGainNode) return;

    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }

    const now = this.audioCtx.currentTime;
    if (enabled) {
      // Switch to Instrumental / Karaoke Mode
      this.dryGainNode.gain.setValueAtTime(this.dryGainNode.gain.value, now);
      this.dryGainNode.gain.linearRampToValueAtTime(0.0, now + 0.1);

      this.wetGainNode.gain.setValueAtTime(this.wetGainNode.gain.value, now);
      this.wetGainNode.gain.linearRampToValueAtTime(1.0, now + 0.1);
    } else {
      // Switch to Normal Vocal Mode
      this.dryGainNode.gain.setValueAtTime(this.dryGainNode.gain.value, now);
      this.dryGainNode.gain.linearRampToValueAtTime(1.0, now + 0.1);

      this.wetGainNode.gain.setValueAtTime(this.wetGainNode.gain.value, now);
      this.wetGainNode.gain.linearRampToValueAtTime(0.0, now + 0.1);
    }
  }

  public getStatus(): boolean {
    return this.isEnabled;
  }
}
