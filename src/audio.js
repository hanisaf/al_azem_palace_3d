class AmbientAudio {
  constructor() {
    this.ctx = null;
    this.isPlaying = false;
    this.gainNode = null;
    this.waterNodes = [];
  }

  init() {
    if (this.ctx) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    this.ctx = new AudioContext();

    // Master gain
    this.gainNode = this.ctx.createGain();
    this.gainNode.gain.setValueAtTime(0, this.ctx.currentTime);
    this.gainNode.connect(this.ctx.destination);

    // Synthesize fountain bubbling water
    this.createWaterLoop();
  }

  createWaterLoop() {
    if (!this.ctx) return;

    // Buffer of pink-ish noise for natural fluid motion
    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.08;
      b6 = white * 0.115926;
    }

    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;

    // Dual bandpass filters for trickling water resonance
    const filter1 = this.ctx.createBiquadFilter();
    filter1.type = 'bandpass';
    filter1.frequency.setValueAtTime(580, this.ctx.currentTime);
    filter1.Q.setValueAtTime(2.5, this.ctx.currentTime);

    const filter2 = this.ctx.createBiquadFilter();
    filter2.type = 'bandpass';
    filter2.frequency.setValueAtTime(1450, this.ctx.currentTime);
    filter2.Q.setValueAtTime(3.0, this.ctx.currentTime);

    // LFO for subtle dynamic variation
    const lfo = this.ctx.createOscillator();
    lfo.frequency.setValueAtTime(0.35, this.ctx.currentTime);
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.setValueAtTime(120, this.ctx.currentTime);
    lfo.connect(lfoGain);
    lfoGain.connect(filter1.frequency);

    const waterGain = this.ctx.createGain();
    waterGain.gain.setValueAtTime(0.35, this.ctx.currentTime);

    noiseSource.connect(filter1);
    noiseSource.connect(filter2);
    filter1.connect(waterGain);
    filter2.connect(waterGain);
    waterGain.connect(this.gainNode);

    noiseSource.start(0);
    lfo.start(0);

    this.waterNodes.push(noiseSource, lfo);
  }

  toggle() {
    this.init();
    if (!this.ctx) return false;

    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    if (this.isPlaying) {
      this.gainNode.gain.setTargetAtTime(0, this.ctx.currentTime, 0.5);
      this.isPlaying = false;
    } else {
      this.gainNode.gain.setTargetAtTime(0.5, this.ctx.currentTime, 0.8);
      this.isPlaying = true;
    }
    return this.isPlaying;
  }

  getStreamDestination() {
    if (!this.ctx || !this.gainNode) return null;
    if (!this.streamDest) {
      this.streamDest = this.ctx.createMediaStreamDestination();
      this.gainNode.connect(this.streamDest);
    }
    return this.streamDest;
  }
}

export const ambientAudio = new AmbientAudio();
