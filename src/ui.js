import { LANDMARKS } from './landmarks.js';
import { ambientAudio } from './audio.js';
import { VideoRecorder } from './recorder.js';

export class UIController {
  constructor(viewer) {
    this.viewer = viewer;

    this.loaderScreen = document.getElementById('loading-screen');
    this.loaderBar = document.getElementById('loader-bar');
    this.loaderStatus = document.getElementById('loader-status');
    this.walkBanner = document.getElementById('walk-banner');
    this.tourChipsContainer = document.getElementById('tour-chips');
    this.touchControls = document.getElementById('touch-controls');

    this.hudOverlay = document.querySelector('.hud-overlay');
    this.hideUiBtn = document.getElementById('btn-hide-ui');
    this.restoreUiBtn = document.getElementById('btn-restore-ui');
    this.micBtn = document.getElementById('btn-mic');
    this.recordBtn = document.getElementById('btn-record');
    this.recBadge = document.getElementById('recording-badge');
    this.recTimer = document.getElementById('rec-timer');
    this.recFormatTag = document.getElementById('rec-format');
    this.recMicTag = document.getElementById('rec-mic-status');
    this.recStopBtn = document.getElementById('btn-stop-rec');

    this.isUIHidden = false;
    this.enableMic = true; // Enabled by default for voiceover audio recording
    this.recorder = null;
    if (this.viewer?.renderer?.domElement) {
      this.recorder = new VideoRecorder(
        this.viewer.renderer.domElement,
        () => ambientAudio.getStreamDestination()
      );
    }

    this.activeLandmarkId = 'overview';

    this.init();
  }

  init() {
    this.detectTouch();
    this.renderLandmarks();
    this.setupModeSwitcher();
    this.setupAtmosphereSwitcher();
    this.setupActions();
    this.setupModals();
    this.setupTouchControls();
    this.updateMicButtonUI();
  }

  detectTouch() {
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
      document.body.classList.add('touch-device');
    }
  }

  updateProgress(percent) {
    const p = Math.min(100, Math.round(percent));
    if (this.loaderBar) this.loaderBar.style.width = `${p}%`;
    if (this.loaderStatus) this.loaderStatus.textContent = `Streaming Palace Model · ${p}%`;
  }

  hideLoader() {
    if (this.loaderBar) this.loaderBar.style.width = '100%';
    if (this.loaderStatus) this.loaderStatus.textContent = 'Palace Ready';
    setTimeout(() => {
      this.loaderScreen?.classList.add('hidden');
    }, 450);
  }

  showError(error) {
    console.error('Palace loading error:', error);
    if (this.loaderStatus) {
      this.loaderStatus.innerHTML = `
        <div style="color:#ef4444;margin-top:8px;font-weight:600;">
          Unable to load 3D model: ${error?.message || error}
        </div>
        <button id="btn-retry-load" style="margin-top:14px;padding:8px 18px;border-radius:20px;background:#d4af37;color:#0b0f17;border:none;cursor:pointer;font-weight:700;box-shadow:0 2px 10px rgba(212,175,55,0.4);">
          Retry Loading
        </button>
      `;
      document.getElementById('btn-retry-load')?.addEventListener('click', () => {
        window.location.reload();
      });
    }
  }

  setViewer(viewer) {
    this.viewer = viewer;
  }

  renderLandmarks() {
    if (!this.tourChipsContainer) return;
    this.tourChipsContainer.innerHTML = '';

    LANDMARKS.forEach((lm) => {
      const chip = document.createElement('button');
      chip.className = `landmark-chip ${lm.id === this.activeLandmarkId ? 'active' : ''}`;
      chip.id = `chip-${lm.id}`;
      chip.innerHTML = `
        <span class="chip-title">${lm.title}</span>
        <span class="chip-sub">${lm.titleAr}</span>
      `;

      chip.addEventListener('click', () => {
        this.selectLandmark(lm.id);
      });

      this.tourChipsContainer.appendChild(chip);
    });
  }

  selectLandmark(id) {
    this.activeLandmarkId = id;

    // Update active class on chips
    document.querySelectorAll('.landmark-chip').forEach((c) => c.classList.remove('active'));
    const current = document.getElementById(`chip-${id}`);
    if (current) {
      current.classList.add('active');
      current.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }

    this.viewer.jumpToLandmark(id);
  }

  setupModeSwitcher() {
    const orbitBtn = document.getElementById('btn-mode-orbit');
    const walkBtn = document.getElementById('btn-mode-walk');
    const personBtn = document.getElementById('btn-mode-person');

    const setMode = (mode) => {
      [orbitBtn, walkBtn, personBtn].forEach((b) => b?.classList.remove('active'));

      if (mode === 'orbit') {
        orbitBtn?.classList.add('active');
        this.walkBanner?.classList.remove('visible');
        this.touchControls?.classList.remove('active-touch');
        this.viewer?.controller?.setMode('orbit');
      } else if (mode === 'walk') {
        walkBtn?.classList.add('active');
        if (this.walkBanner) {
          this.walkBanner.innerHTML = `
            <span>👁️ First-Person Mode</span>
            <span>•</span>
            <span>Use <span class="key-badge">W</span> <span class="key-badge">A</span> <span class="key-badge">S</span> <span class="key-badge">D</span> to walk</span>
            <span>•</span>
            <span>Click scene to look around</span>
            <span>•</span>
            <span><span class="key-badge">Shift</span> to sprint</span>
          `;
          this.walkBanner.classList.add('visible');
        }
        if (document.body.classList.contains('touch-device')) {
          this.touchControls?.classList.add('active-touch');
        }
        this.viewer?.controller?.setMode('walk');
      } else if (mode === 'person') {
        personBtn?.classList.add('active');
        if (this.walkBanner) {
          this.walkBanner.innerHTML = `
            <span>👤 Person Walk (Safadi)</span>
            <span>•</span>
            <span>Use <span class="key-badge">W</span> <span class="key-badge">A</span> <span class="key-badge">S</span> <span class="key-badge">D</span> to walk</span>
            <span>•</span>
            <span>Drag mouse to orbit camera</span>
            <span>•</span>
            <span><span class="key-badge">Shift</span> to run</span>
          `;
          this.walkBanner.classList.add('visible');
        }
        if (document.body.classList.contains('touch-device')) {
          this.touchControls?.classList.add('active-touch');
        }
        this.viewer?.controller?.setMode('person');
      }
    };

    orbitBtn?.addEventListener('click', () => setMode('orbit'));
    walkBtn?.addEventListener('click', () => setMode('walk'));
    personBtn?.addEventListener('click', () => setMode('person'));
  }

  setupAtmosphereSwitcher() {
    const dayBtn = document.getElementById('btn-atmo-day');
    const sunsetBtn = document.getElementById('btn-atmo-sunset');
    const nightBtn = document.getElementById('btn-atmo-night');

    const setAtmo = (mode, targetBtn) => {
      [dayBtn, sunsetBtn, nightBtn].forEach((btn) => btn?.classList.remove('active'));
      targetBtn?.classList.add('active');
      this.viewer?.setAtmosphere(mode);
    };

    dayBtn?.addEventListener('click', () => setAtmo('day', dayBtn));
    sunsetBtn?.addEventListener('click', () => setAtmo('sunset', sunsetBtn));
    nightBtn?.addEventListener('click', () => setAtmo('night', nightBtn));
  }

  toggleUI(forceState = undefined) {
    this.isUIHidden = forceState !== undefined ? forceState : !this.isUIHidden;
    if (this.hudOverlay) {
      this.hudOverlay.classList.toggle('ui-hidden', this.isUIHidden);
    }
    if (this.restoreUiBtn) {
      this.restoreUiBtn.classList.toggle('hidden', !this.isUIHidden);
    }
  }

  toggleMic() {
    this.enableMic = !this.enableMic;
    this.updateMicButtonUI();
  }

  updateMicButtonUI() {
    if (this.micBtn) {
      this.micBtn.classList.toggle('active', this.enableMic);
      this.micBtn.title = this.enableMic
        ? 'Microphone Voiceover: ON (Press M to mute)'
        : 'Microphone Voiceover: OFF (Press M to enable)';
    }
    if (this.recMicTag) {
      this.recMicTag.textContent = this.enableMic ? '🎙️ MIC ON' : '🎙️ MIC OFF';
      this.recMicTag.classList.toggle('muted', !this.enableMic);
    }
  }

  async toggleRecording() {
    if (!this.recorder) {
      if (this.viewer?.renderer?.domElement) {
        this.recorder = new VideoRecorder(
          this.viewer.renderer.domElement,
          () => ambientAudio.getStreamDestination()
        );
      }
    }
    if (!this.recorder) return;

    if (this.recorder.isRecording) {
      this.stopRecording();
    } else {
      await this.startRecording();
    }
  }

  async startRecording() {
    if (!this.recorder) return;

    this.recordBtn?.classList.add('recording');
    if (this.recordBtn) this.recordBtn.title = 'Stop Recording & Download MP4 (Press R)';

    // Pre-activate badge so user gets immediate visual feedback
    if (this.recBadge) {
      this.recBadge.classList.remove('hidden');
      if (this.recTimer) this.recTimer.textContent = '00:00';
      if (this.recFormatTag) this.recFormatTag.textContent = 'MP4';
      if (this.recMicTag) {
        this.recMicTag.textContent = this.enableMic ? '🎙️ MIC...' : '🎙️ MUTED';
        this.recMicTag.classList.toggle('muted', !this.enableMic);
      }
    }

    try {
      const res = await this.recorder.start({
        preferredFormat: 'mp4',
        enableMic: this.enableMic,
        onTick: (timeStr, formatStr, hasMic) => {
          if (this.recTimer) this.recTimer.textContent = timeStr;
          if (this.recFormatTag) this.recFormatTag.textContent = formatStr;
          if (this.recMicTag) {
            this.recMicTag.textContent = hasMic ? '🎙️ MIC ON' : (this.enableMic ? '🎙️ NO MIC' : '🎙️ MUTED');
            this.recMicTag.classList.toggle('muted', !hasMic);
          }
        }
      });

      if (!res || !res.success) {
        this.stopRecording();
      } else {
        if (this.recFormatTag) this.recFormatTag.textContent = res.format.toUpperCase();
        if (this.recMicTag) {
          this.recMicTag.textContent = res.hasMic ? '🎙️ MIC ON' : (this.enableMic ? '🎙️ NO MIC' : '🎙️ MUTED');
          this.recMicTag.classList.toggle('muted', !res.hasMic);
        }
      }
    } catch (err) {
      console.error('Failed to start recording:', err);
      this.stopRecording();
    }
  }

  stopRecording() {
    if (!this.recorder || !this.recorder.isRecording) {
      this.recordBtn?.classList.remove('recording');
      this.recBadge?.classList.add('hidden');
      return;
    }
    this.recorder.stop();
    this.recordBtn?.classList.remove('recording');
    if (this.recordBtn) this.recordBtn.title = 'Record Video Tour (Press R)';
    this.recBadge?.classList.add('hidden');
  }

  setupActions() {
    // Hide UI
    this.hideUiBtn?.addEventListener('click', () => this.toggleUI(true));
    this.restoreUiBtn?.addEventListener('click', () => this.toggleUI(false));

    // Microphone Voiceover
    this.micBtn?.addEventListener('click', () => this.toggleMic());

    // Video Recording
    this.recordBtn?.addEventListener('click', () => this.toggleRecording());
    this.recStopBtn?.addEventListener('click', () => this.stopRecording());

    // Courtyard Sound
    const audioBtn = document.getElementById('btn-audio');
    audioBtn?.addEventListener('click', () => {
      const isPlaying = ambientAudio.toggle();
      audioBtn.classList.toggle('active', isPlaying);
      audioBtn.title = isPlaying ? 'Mute Courtyard Fountain' : 'Play Courtyard Fountain Sound';
    });

    // Screenshot
    const screenshotBtn = document.getElementById('btn-screenshot');
    screenshotBtn?.addEventListener('click', () => {
      this.viewer.captureScreenshot();
    });

    // Fullscreen
    const fullscreenBtn = document.getElementById('btn-fullscreen');
    fullscreenBtn?.addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen?.();
      } else {
        document.exitFullscreen?.();
      }
    });

    // Global Hotkeys (H: Hide UI, R: Record Video, M: Toggle Microphone)
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      const key = e.key ? e.key.toLowerCase() : '';

      if (key === 'h') {
        e.preventDefault();
        this.toggleUI();
      } else if (key === 'r') {
        e.preventDefault();
        this.toggleRecording();
      } else if (key === 'm') {
        e.preventDefault();
        this.toggleMic();
      }
    });
  }

  setupModals() {
    const infoModal = document.getElementById('modal-info');
    const helpModal = document.getElementById('modal-help');
    const infoBtn = document.getElementById('btn-info');
    const helpBtn = document.getElementById('btn-help');
    const infoClose = document.getElementById('modal-info-close');
    const helpClose = document.getElementById('modal-help-close');

    infoBtn?.addEventListener('click', () => infoModal?.classList.add('open'));
    helpBtn?.addEventListener('click', () => helpModal?.classList.add('open'));

    infoClose?.addEventListener('click', () => infoModal?.classList.remove('open'));
    helpClose?.addEventListener('click', () => helpModal?.classList.remove('open'));

    [infoModal, helpModal].forEach((m) => {
      m?.addEventListener('click', (e) => {
        if (e.target === m) m.classList.remove('open');
      });
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        infoModal?.classList.remove('open');
        helpModal?.classList.remove('open');
      }
    });
  }

  setupTouchControls() {
    const bindTouch = (btnId, prop) => {
      const btn = document.getElementById(btnId);
      if (!btn) return;
      const start = (e) => {
        e.preventDefault();
        this.viewer.controller.moveState[prop] = true;
      };
      const end = (e) => {
        e.preventDefault();
        this.viewer.controller.moveState[prop] = false;
      };
      btn.addEventListener('touchstart', start, { passive: false });
      btn.addEventListener('touchend', end, { passive: false });
      btn.addEventListener('mousedown', start);
      btn.addEventListener('mouseup', end);
    };

    bindTouch('touch-w', 'forward');
    bindTouch('touch-s', 'backward');
    bindTouch('touch-a', 'left');
    bindTouch('touch-d', 'right');
  }
}
