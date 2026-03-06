export class Metronome {
  private _bpm = 80;
  private _playing = false;
  private _audioCtx: AudioContext | null = null;
  private _nextClickTime = 0; // in AudioContext time (seconds)
  private _currentBeat = 0; // 0-3 for 4/4 time
  private _beatPhase = 0; // 0–1 progress within current beat
  private _startTime = 0; // performance.now() when started
  private _beatDurationMs = 750;

  get bpm(): number {
    return this._bpm;
  }

  get currentBeat(): number {
    return this._currentBeat;
  }

  get beatPhase(): number {
    return this._beatPhase;
  }

  get beatDurationMs(): number {
    return this._beatDurationMs;
  }

  get playing(): boolean {
    return this._playing;
  }

  setBpm(bpm: number): void {
    this._bpm = bpm;
    this._beatDurationMs = 60000 / bpm;
  }

  start(audioCtx: AudioContext): void {
    this._audioCtx = audioCtx;
    this._playing = true;
    this._startTime = performance.now();
    this._beatDurationMs = 60000 / this._bpm;
    this._nextClickTime = audioCtx.currentTime;
    this._currentBeat = 0;
    this._beatPhase = 0;
    // Schedule first few clicks
    this.scheduleClicks();
  }

  stop(): void {
    this._playing = false;
    this._audioCtx = null;
  }

  update(nowMs: number): void {
    if (!this._playing || !this._audioCtx) return;

    // Update beat tracking
    const elapsed = nowMs - this._startTime;
    const totalBeats = elapsed / this._beatDurationMs;
    this._currentBeat = Math.floor(totalBeats) % 4;
    this._beatPhase = totalBeats - Math.floor(totalBeats);

    // Schedule upcoming clicks
    this.scheduleClicks();
  }

  private scheduleClicks(): void {
    const ctx = this._audioCtx;
    if (!ctx) return;

    const beatDurationSec = 60 / this._bpm;
    // Schedule clicks up to 200ms ahead
    const scheduleAhead = ctx.currentTime + 0.2;

    while (this._nextClickTime <= scheduleAhead) {
      this.playClick(this._nextClickTime, this._currentBeatForTime(this._nextClickTime));
      this._nextClickTime += beatDurationSec;
    }
  }

  private _currentBeatForTime(audioTime: number): number {
    if (!this._audioCtx) return 0;
    const elapsedSec = audioTime - (this._audioCtx.currentTime - (performance.now() - this._startTime) / 1000);
    const beat = Math.round(elapsedSec / (60 / this._bpm));
    return ((beat % 4) + 4) % 4;
  }

  private playClick(time: number, beat: number): void {
    const ctx = this._audioCtx;
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    // Downbeat (beat 0) is higher pitch and louder
    osc.frequency.value = beat === 0 ? 1000 : 700;
    osc.type = "sine";

    const volume = beat === 0 ? 0.15 : 0.08;
    const duration = 0.03; // 30ms click

    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.start(time);
    osc.stop(time + duration + 0.01);
  }
}
