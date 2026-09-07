export class VideoRecorder {
  constructor(canvas, getAudioNode = null) {
    this.canvas = canvas;
    this.getAudioNode = getAudioNode;
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.isRecording = false;
    this.startTime = 0;
    this.timerInterval = null;
    this.onTickCallback = null;
    this.micStream = null;
    this.mixAudioCtx = null;
    this.selectedFormat = 'mp4';
  }

  isSupported() {
    return !!(this.canvas && this.canvas.captureStream && window.MediaRecorder);
  }

  isMp4Supported() {
    if (!window.MediaRecorder) return false;
    return (
      MediaRecorder.isTypeSupported('video/mp4;codecs=avc1,mp4a.40.2') ||
      MediaRecorder.isTypeSupported('video/mp4;codecs=avc1') ||
      MediaRecorder.isTypeSupported('video/mp4;codecs=h264') ||
      MediaRecorder.isTypeSupported('video/mp4')
    );
  }

  async start({ onTick = null, enableMic = false, preferredFormat = 'mp4' } = {}) {
    if (!this.isSupported() || this.isRecording) return false;

    this.onTickCallback = onTick;
    this.recordedChunks = [];

    // 1. Capture 60fps canvas stream
    const canvasStream = this.canvas.captureStream(60);
    const combinedStream = new MediaStream();

    // Add video track
    canvasStream.getVideoTracks().forEach((track) => combinedStream.addTrack(track));

    // 2. Microphone Capture
    this.micStream = null;
    if (enableMic && navigator.mediaDevices?.getUserMedia) {
      try {
        this.micStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
      } catch (err) {
        console.warn('Microphone permission denied or unavailable:', err);
        this.micStream = null;
      }
    }

    // 3. Audio Mixing (Mic Voiceover + Courtyard Fountain Ambience)
    let ambientDest = null;
    if (this.getAudioNode) {
      try {
        ambientDest = this.getAudioNode();
      } catch (e) {
        console.warn('Could not get ambient audio destination:', e);
      }
    }

    const hasAmbientAudio = ambientDest && ambientDest.stream && ambientDest.stream.getAudioTracks().length > 0;
    const hasMic = !!(this.micStream && this.micStream.getAudioTracks().length > 0);

    if (hasMic && hasAmbientAudio) {
      // Blend both using an AudioContext mixer
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.mixAudioCtx = new AudioContext();
        if (this.mixAudioCtx.state === 'suspended') {
          await this.mixAudioCtx.resume();
        }
        const mixDest = this.mixAudioCtx.createMediaStreamDestination();

        // Mic input (full volume)
        const micSource = this.mixAudioCtx.createMediaStreamSource(this.micStream);
        const micGain = this.mixAudioCtx.createGain();
        micGain.gain.value = 1.0;
        micSource.connect(micGain);
        micGain.connect(mixDest);

        // Ambient fountain (subtle background volume)
        const ambientSource = this.mixAudioCtx.createMediaStreamSource(ambientDest.stream);
        const ambientGain = this.mixAudioCtx.createGain();
        ambientGain.gain.value = 0.35;
        ambientSource.connect(ambientGain);
        ambientGain.connect(mixDest);

        mixDest.stream.getAudioTracks().forEach((track) => combinedStream.addTrack(track));
      } catch (e) {
        console.warn('Audio mixing fallback:', e);
        // Fallback to mic audio track directly
        this.micStream.getAudioTracks().forEach((track) => combinedStream.addTrack(track));
      }
    } else if (hasMic) {
      // Only mic voiceover
      this.micStream.getAudioTracks().forEach((track) => combinedStream.addTrack(track));
    } else if (hasAmbientAudio) {
      // Only ambient courtyard fountain
      ambientDest.stream.getAudioTracks().forEach((track) => combinedStream.addTrack(track));
    }

    // 4. Select MIME type prioritizing MP4
    let selectedMime = '';
    const mp4Types = [
      'video/mp4;codecs=avc1,mp4a.40.2',
      'video/mp4;codecs=avc1',
      'video/mp4;codecs=h264,aac',
      'video/mp4;codecs=h264',
      'video/mp4'
    ];

    const webmTypes = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm'
    ];

    const candidateTypes = preferredFormat === 'mp4'
      ? [...mp4Types, ...webmTypes]
      : [...webmTypes, ...mp4Types];

    for (const type of candidateTypes) {
      if (MediaRecorder.isTypeSupported(type)) {
        selectedMime = type;
        break;
      }
    }

    this.selectedFormat = selectedMime.includes('mp4') ? 'mp4' : 'webm';

    const options = {
      mimeType: selectedMime || undefined,
      videoBitsPerSecond: 10000000 // 10 Mbps for crystal-clear 3D resolution
    };

    try {
      this.mediaRecorder = new MediaRecorder(combinedStream, options);
    } catch (e) {
      console.warn('MediaRecorder init fallback without options:', e);
      this.mediaRecorder = new MediaRecorder(combinedStream);
    }

    if (this.mediaRecorder.mimeType) {
      if (this.mediaRecorder.mimeType.toLowerCase().includes('mp4')) {
        this.selectedFormat = 'mp4';
      } else if (this.mediaRecorder.mimeType.toLowerCase().includes('webm')) {
        this.selectedFormat = 'webm';
      }
    }

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        this.recordedChunks.push(event.data);
      }
    };

    this.mediaRecorder.onstop = () => {
      this.finishAndDownload(this.selectedFormat, selectedMime);
      this.cleanupAudio();
    };

    this.mediaRecorder.start(250); // Slice chunks every 250ms
    this.isRecording = true;
    this.startTime = Date.now();

    if (this.onTickCallback) {
      this.onTickCallback('00:00', this.selectedFormat.toUpperCase(), hasMic);
      this.timerInterval = setInterval(() => {
        const elapsedSec = Math.floor((Date.now() - this.startTime) / 1000);
        const mins = String(Math.floor(elapsedSec / 60)).padStart(2, '0');
        const secs = String(elapsedSec % 60).padStart(2, '0');
        this.onTickCallback(`${mins}:${secs}`, this.selectedFormat.toUpperCase(), hasMic);
      }, 1000);
    }

    return { success: true, format: this.selectedFormat, hasMic };
  }

  stop() {
    if (!this.isRecording || !this.mediaRecorder) return;

    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }

    this.isRecording = false;
    this.mediaRecorder.stop();
  }

  cleanupAudio() {
    // Release microphone tracks cleanly
    if (this.micStream) {
      this.micStream.getTracks().forEach((t) => t.stop());
      this.micStream = null;
    }

    // Close mixer audio context
    if (this.mixAudioCtx) {
      try {
        this.mixAudioCtx.close();
      } catch (e) {}
      this.mixAudioCtx = null;
    }
  }

  finishAndDownload(format, mimeType) {
    if (this.recordedChunks.length === 0) return;

    const ext = format === 'mp4' ? 'mp4' : 'webm';
    const blobType = mimeType || (format === 'mp4' ? 'video/mp4' : 'video/webm');
    const blob = new Blob(this.recordedChunks, { type: blobType });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `Al-Azm-Palace-Tour-${Date.now()}.${ext}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 6000);

    this.recordedChunks = [];
  }
}
