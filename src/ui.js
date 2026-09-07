import { LANDMARKS } from './landmarks.js';
import { ambientAudio } from './audio.js';

export class UIController {
  constructor(viewer) {
    this.viewer = viewer;

    this.loaderScreen = document.getElementById('loading-screen');
    this.loaderBar = document.getElementById('loader-bar');
    this.loaderStatus = document.getElementById('loader-status');
    this.walkBanner = document.getElementById('walk-banner');
    this.tourChipsContainer = document.getElementById('tour-chips');
    this.touchControls = document.getElementById('touch-controls');

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

    const setMode = (mode) => {
      if (mode === 'orbit') {
        orbitBtn?.classList.add('active');
        walkBtn?.classList.remove('active');
        this.walkBanner?.classList.remove('visible');
        this.touchControls?.classList.remove('active-touch');
        this.viewer.controller.setMode('orbit');
      } else {
        walkBtn?.classList.add('active');
        orbitBtn?.classList.remove('active');
        this.walkBanner?.classList.add('visible');
        if (document.body.classList.contains('touch-device')) {
          this.touchControls?.classList.add('active-touch');
        }
        this.viewer.controller.setMode('walk');
      }
    };

    orbitBtn?.addEventListener('click', () => setMode('orbit'));
    walkBtn?.addEventListener('click', () => setMode('walk'));
  }

  setupAtmosphereSwitcher() {
    const dayBtn = document.getElementById('btn-atmo-day');
    const sunsetBtn = document.getElementById('btn-atmo-sunset');
    const nightBtn = document.getElementById('btn-atmo-night');

    const setAtmo = (mode, targetBtn) => {
      [dayBtn, sunsetBtn, nightBtn].forEach((btn) => btn?.classList.remove('active'));
      targetBtn?.classList.add('active');
      this.viewer.setAtmosphere(mode);
    };

    dayBtn?.addEventListener('click', () => setAtmo('day', dayBtn));
    sunsetBtn?.addEventListener('click', () => setAtmo('sunset', sunsetBtn));
    nightBtn?.addEventListener('click', () => setAtmo('night', nightBtn));
  }

  setupActions() {
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
