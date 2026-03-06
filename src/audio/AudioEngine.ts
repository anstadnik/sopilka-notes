export class AudioEngine {
  private context: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private stream: MediaStream | null = null;
  private buffer: Float32Array<ArrayBuffer> = new Float32Array(2048);
  private _sampleRate = 44100;
  private _active = false;

  get sampleRate(): number {
    return this._sampleRate;
  }

  get isActive(): boolean {
    return this._active;
  }

  async start(): Promise<void> {
    if (this._active) return;

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.stream = stream;
    this.context = new AudioContext();

    // Handle suspended context (e.g. autoplay policy)
    if (this.context.state === "suspended") {
      await this.context.resume();
    }

    this._sampleRate = this.context.sampleRate;
    const source = this.context.createMediaStreamSource(stream);
    this.analyser = this.context.createAnalyser();
    this.analyser.fftSize = 2048;
    source.connect(this.analyser);
    this.buffer = new Float32Array(this.analyser.fftSize);
    this._active = true;
  }

  getContext(): AudioContext | null {
    return this.context;
  }

  getBuffer(): Float32Array {
    if (this.analyser) {
      this.analyser.getFloatTimeDomainData(this.buffer);
    }
    return this.buffer;
  }

  stop(): void {
    this._active = false;
    // Stop all MediaStream tracks to release the microphone
    if (this.stream) {
      for (const track of this.stream.getTracks()) {
        track.stop();
      }
      this.stream = null;
    }
    if (this.context && this.context.state !== "closed") {
      this.context.close();
    }
    this.context = null;
    this.analyser = null;
  }

  dispose(): void {
    this.stop();
    this.buffer = new Float32Array(2048);
    this._sampleRate = 44100;
  }
}
