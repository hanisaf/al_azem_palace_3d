import { PalaceViewer } from './viewer.js';
import { UIController } from './ui.js';

window.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('canvas-container');

  let ui = null;

  const viewer = new PalaceViewer(
    container,
    (progress) => {
      ui?.updateProgress(progress);
    },
    () => {
      ui?.hideLoader();
    },
    (error) => {
      ui?.showError(error);
    }
  );

  ui = new UIController(viewer);
});
