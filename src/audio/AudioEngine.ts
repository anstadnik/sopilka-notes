export class AudioEngine {
  private context: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private buffer: Float32Array<ArrayBuffer> = new Float32Array(2048);
  private _sampleRate = 44100;

  get sampleRate(): number {
    return this._sampleRate;
  }

  async start(): Promise<void> {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.context = new AudioContext();
    this._sampleRate = this.context.sampleRate;
    const source = this.context.createMediaStreamSource(stream);
    this.analyser = this.context.createAnalyser();
    this.analyser.fftSize = 2048;
    source.connect(this.analyser);
    this.buffer = new Float32Array(this.analyser.fftSize);
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
    this.context?.close();
    this.context = null;
    this.analyser = null;
  }
}
