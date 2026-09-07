import { PalaceViewer } from './viewer.js';
import { UIController } from './ui.js';

window.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('canvas-container');

  const ui = new UIController(null);

  const viewer = new PalaceViewer(
    container,
    (progress) => {
      ui.updateProgress(progress);
    },
    () => {
      ui.hideLoader();
    },
    (error) => {
      ui.showError(error);
    }
  );

  ui.setViewer(viewer);
});
