// Critter Sounds: taps the mix for the voice bots as 16-bit stereo PCM, in 60 ms chunks (Discord and Fluxer take 48 kHz).
// It runs on the audio thread; the page passes the chunks on only while a bot is in a voice channel.
class PcmTap extends AudioWorkletProcessor {
  constructor() {
    super();
    this.n = 2880; // 60 ms at 48 kHz
    this.buf = new Int16Array(this.n * 2); this.i = 0; this.on = false;
    this.port.onmessage = e => { this.on = !!e.data.on; this.i = 0; };
  }
  process(inputs) {
    const inp = inputs[0];
    if (!this.on || !inp || !inp.length) return true;
    const L = inp[0], R = inp[1] || inp[0];
    for (let k = 0; k < L.length; k++) {
      let l = L[k], r = R[k];
      l = l > 1 ? 1 : l < -1 ? -1 : l; r = r > 1 ? 1 : r < -1 ? -1 : r;
      this.buf[this.i++] = l < 0 ? l * 32768 : l * 32767;
      this.buf[this.i++] = r < 0 ? r * 32768 : r * 32767;
      if (this.i >= this.buf.length) { const out = this.buf; this.port.postMessage(out.buffer, [out.buffer]); this.buf = new Int16Array(this.n * 2); this.i = 0; }
    }
    return true;
  }
}
registerProcessor('pcm-tap', PcmTap);
