import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export class NavigationController {
  constructor(camera, domElement, character = null) {
    this.camera = camera;
    this.domElement = domElement;
    this.character = character;

    this.mode = 'orbit'; // 'orbit' | 'walk' | 'person'
    this.isTransitioning = false;
    this.transitionProgress = 1;
    this.transitionDuration = 1.5;
    this.startPos = new THREE.Vector3();
    this.endPos = new THREE.Vector3();
    this.startTarget = new THREE.Vector3();
    this.endTarget = new THREE.Vector3();

    // Orbit Controls
    this.orbit = new OrbitControls(this.camera, this.domElement);
    this.orbit.enableDamping = true;
    this.orbit.dampingFactor = 0.05;
    this.orbit.maxPolarAngle = Math.PI / 2 + 0.01; // Don't go underground
    this.orbit.minDistance = 1.5;
    this.orbit.maxDistance = 100.0;
    this.orbit.target.set(0, 3.5, 0);

    // First-Person Walk State
    this.walkSpeed = 4.0; // m/s
    this.sprintMultiplier = 2.0;
    this.eyeHeight = 1.65;
    this.moveState = { forward: false, backward: false, left: false, right: false, sprint: false };
    this.walkEuler = new THREE.Euler(0, 0, 0, 'YXZ');
    this.isPointerLocked = false;
    this.isMouseDown = false;
    this.lastMouseX = 0;
    this.lastMouseY = 0;

    // Third-Person Character Walk State
    this.thirdPersonYaw = 0; // angle around character
    this.thirdPersonPitch = 0.28; // angle above character
    this.thirdPersonDistance = 4.8; // meters from character (calibrated for 2x scale)
    this.camTargetSmooth = new THREE.Vector3();

    // Movement bounds within palace
    this.bounds = {
      minX: -16.5,
      maxX: 16.5,
      minZ: -32.5,
      maxZ: 32.5
    };

    this.setupKeyboard();
    this.setupMouse();
    this.setupTouch();
  }

  setCharacter(character) {
    this.character = character;
  }

  setupKeyboard() {
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      const key = e.key ? e.key.toLowerCase() : '';
      if (e.code === 'KeyW' || e.code === 'ArrowUp' || key === 'w' || key === 'arrowup') {
        this.moveState.forward = true;
      }
      if (e.code === 'KeyS' || e.code === 'ArrowDown' || key === 's' || key === 'arrowdown') {
        this.moveState.backward = true;
      }
      if (e.code === 'KeyA' || e.code === 'ArrowLeft' || key === 'a' || key === 'arrowleft') {
        this.moveState.left = true;
      }
      if (e.code === 'KeyD' || e.code === 'ArrowRight' || key === 'd' || key === 'arrowright') {
        this.moveState.right = true;
      }
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.shiftKey) {
        this.moveState.sprint = true;
      }
    });

    window.addEventListener('keyup', (e) => {
      const key = e.key ? e.key.toLowerCase() : '';
      if (e.code === 'KeyW' || e.code === 'ArrowUp' || key === 'w' || key === 'arrowup') {
        this.moveState.forward = false;
      }
      if (e.code === 'KeyS' || e.code === 'ArrowDown' || key === 's' || key === 'arrowdown') {
        this.moveState.backward = false;
      }
      if (e.code === 'KeyA' || e.code === 'ArrowLeft' || key === 'a' || key === 'arrowleft') {
        this.moveState.left = false;
      }
      if (e.code === 'KeyD' || e.code === 'ArrowRight' || key === 'd' || key === 'arrowright') {
        this.moveState.right = false;
      }
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || !e.shiftKey) {
        this.moveState.sprint = false;
      }
    });
  }

  setupMouse() {
    this.domElement.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.isMouseDown = true;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
      }
    });

    window.addEventListener('mouseup', () => {
      this.isMouseDown = false;
    });

    window.addEventListener('mousemove', (e) => {
      let dx = 0;
      let dy = 0;

      if (this.isPointerLocked) {
        dx = e.movementX || 0;
        dy = e.movementY || 0;
      } else if (this.isMouseDown) {
        dx = e.clientX - this.lastMouseX;
        dy = e.clientY - this.lastMouseY;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
      }

      if (dx === 0 && dy === 0) return;

      if (this.mode === 'walk') {
        const sensitivity = 0.0028;
        this.walkEuler.y -= dx * sensitivity;
        this.walkEuler.x -= dy * sensitivity;
        this.walkEuler.x = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, this.walkEuler.x));
        this.camera.quaternion.setFromEuler(this.walkEuler);
      } else if (this.mode === 'person') {
        const sensitivity = 0.0035;
        this.thirdPersonYaw -= dx * sensitivity;
        this.thirdPersonPitch += dy * sensitivity;
        // Clamp pitch to avoid going under the floor or flipping over the head
        this.thirdPersonPitch = Math.max(-0.06, Math.min(0.95, this.thirdPersonPitch));
      }
    });

    // Zoom distance with mouse wheel in person mode
    this.domElement.addEventListener('wheel', (e) => {
      if (this.mode === 'person') {
        this.thirdPersonDistance += e.deltaY * 0.003;
        this.thirdPersonDistance = Math.max(2.5, Math.min(8.5, this.thirdPersonDistance));
      }
    }, { passive: true });

    // Pointer lock toggle when clicking canvas in walk / person mode
    this.domElement.addEventListener('click', () => {
      if ((this.mode === 'walk' || this.mode === 'person') && !this.isPointerLocked) {
        this.domElement.requestPointerLock?.();
      }
    });

    document.addEventListener('pointerlockchange', () => {
      this.isPointerLocked = document.pointerLockElement === this.domElement;
      document.body.classList.toggle('pointer-locked', this.isPointerLocked);
    });
  }

  setupTouch() {
    let touchStartX = 0;
    let touchStartY = 0;

    this.domElement.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
      }
    }, { passive: true });

    this.domElement.addEventListener('touchmove', (e) => {
      if (e.touches.length !== 1) return;

      const dx = e.touches[0].clientX - touchStartX;
      const dy = e.touches[0].clientY - touchStartY;
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;

      if (this.mode === 'walk') {
        const sensitivity = 0.0035;
        this.walkEuler.y -= dx * sensitivity;
        this.walkEuler.x -= dy * sensitivity;
        this.walkEuler.x = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, this.walkEuler.x));
        this.camera.quaternion.setFromEuler(this.walkEuler);
      } else if (this.mode === 'person') {
        const sensitivity = 0.004;
        this.thirdPersonYaw -= dx * sensitivity;
        this.thirdPersonPitch += dy * sensitivity;
        this.thirdPersonPitch = Math.max(-0.06, Math.min(0.95, this.thirdPersonPitch));
      }
    }, { passive: true });
  }

  setMode(mode) {
    if (this.mode === mode) return;
    const oldMode = this.mode;
    this.mode = mode;

    if (mode === 'orbit') {
      if (document.pointerLockElement === this.domElement) {
        document.exitPointerLock?.();
      }
      this.orbit.enabled = true;
      const dir = new THREE.Vector3();
      this.camera.getWorldDirection(dir);
      this.orbit.target.copy(this.camera.position).addScaledVector(dir, 15);
      this.orbit.update();
    } else if (mode === 'walk') {
      this.orbit.enabled = false;
      if (
        this.camera.position.y > 3.5 ||
        Math.abs(this.camera.position.x) > 13.0 ||
        Math.abs(this.camera.position.z) > 25.0
      ) {
        this.camera.position.set(0.0, this.eyeHeight, -6.0);
        this.walkEuler.set(0, 0, 0, 'YXZ');
      } else {
        this.camera.position.y = this.eyeHeight;
        this.clampPosition(this.camera.position);
        this.walkEuler.setFromQuaternion(this.camera.quaternion, 'YXZ');
        this.walkEuler.x = 0;
        this.walkEuler.z = 0;
      }
      this.camera.quaternion.setFromEuler(this.walkEuler);
    } else if (mode === 'person') {
      this.orbit.enabled = false;

      // Ensure Safadi is spawned in an accessible courtyard area
      if (this.character) {
        this.character.setVisible(true);
        if (
          Math.abs(this.character.position.x) > 12.0 ||
          Math.abs(this.character.position.z) > 24.0
        ) {
          this.character.spawnAt(0.0, -4.5, 0);
        }

        // Align camera behind character
        this.thirdPersonYaw = this.character.rotationY;
        this.thirdPersonPitch = 0.28;
        this.camTargetSmooth.copy(this.character.getHeadPosition());

        const camX = this.character.position.x + this.thirdPersonDistance * Math.cos(this.thirdPersonPitch) * Math.sin(this.thirdPersonYaw);
        const camY = Math.max(0.4, this.camTargetSmooth.y + this.thirdPersonDistance * Math.sin(this.thirdPersonPitch));
        const camZ = this.character.position.z + this.thirdPersonDistance * Math.cos(this.thirdPersonPitch) * Math.cos(this.thirdPersonYaw);

        this.camera.position.set(camX, camY, camZ);
        this.camera.lookAt(this.camTargetSmooth);
      }
    }
  }

  flyTo(pos, target, duration = 1.6) {
    this.isTransitioning = true;
    this.transitionProgress = 0;
    this.transitionDuration = duration;

    this.startPos.copy(this.camera.position);
    this.endPos.copy(pos);

    this.startTarget.copy(this.orbit.target);
    this.endTarget.copy(target);

    this.orbit.enabled = false;
  }

  clampPosition(pos) {
    pos.x = Math.max(this.bounds.minX, Math.min(this.bounds.maxX, pos.x));
    pos.z = Math.max(this.bounds.minZ, Math.min(this.bounds.maxZ, pos.z));
    pos.y = this.eyeHeight;
  }

  update(delta) {
    // Handle animated fly-to transitions
    if (this.isTransitioning) {
      this.transitionProgress += delta / this.transitionDuration;
      if (this.transitionProgress >= 1) {
        this.transitionProgress = 1;
        this.isTransitioning = false;
        this.camera.position.copy(this.endPos);
        this.orbit.target.copy(this.endTarget);
        if (this.mode === 'orbit') {
          this.orbit.enabled = true;
          this.orbit.update();
        } else if (this.mode === 'walk') {
          this.walkEuler.setFromQuaternion(this.camera.quaternion, 'YXZ');
        }
      } else {
        const t = this.transitionProgress;
        const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

        this.camera.position.lerpVectors(this.startPos, this.endPos, ease);
        const curTarget = new THREE.Vector3().lerpVectors(this.startTarget, this.endTarget, ease);
        this.camera.lookAt(curTarget);
        this.orbit.target.copy(curTarget);
      }
      return;
    }

    if (this.mode === 'orbit') {
      this.orbit.update();
    } else if (this.mode === 'walk') {
      // First-person movement
      const speed = (this.moveState.sprint ? this.walkSpeed * this.sprintMultiplier : this.walkSpeed) * delta;
      const forward = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(0, this.walkEuler.y, 0));
      const right = new THREE.Vector3(1, 0, 0).applyEuler(new THREE.Euler(0, this.walkEuler.y, 0));

      const moveDir = new THREE.Vector3();
      if (this.moveState.forward) moveDir.add(forward);
      if (this.moveState.backward) moveDir.sub(forward);
      if (this.moveState.right) moveDir.add(right);
      if (this.moveState.left) moveDir.sub(right);

      if (moveDir.lengthSq() > 0) {
        moveDir.normalize();
        this.camera.position.addScaledVector(moveDir, speed);
        this.clampPosition(this.camera.position);
      }
    } else if (this.mode === 'person') {
      // Third-person character movement
      if (this.character) {
        // Compute horizontal forward and right vectors from camera orbit yaw
        const forward = new THREE.Vector3(-Math.sin(this.thirdPersonYaw), 0, -Math.cos(this.thirdPersonYaw));
        const right = new THREE.Vector3(Math.cos(this.thirdPersonYaw), 0, -Math.sin(this.thirdPersonYaw));

        const moveDir = new THREE.Vector3();
        if (this.moveState.forward) moveDir.add(forward);
        if (this.moveState.backward) moveDir.sub(forward);
        if (this.moveState.right) moveDir.add(right);
        if (this.moveState.left) moveDir.sub(right);

        if (moveDir.lengthSq() > 0.001) {
          moveDir.normalize();
        }

        // Update character model and animation
        this.character.update(delta, moveDir, this.moveState.sprint);

        // Smooth follow camera
        const charHead = this.character.getHeadPosition();
        this.camTargetSmooth.lerp(charHead, Math.min(1.0, 10 * delta));

        const targetCamX = this.camTargetSmooth.x + this.thirdPersonDistance * Math.cos(this.thirdPersonPitch) * Math.sin(this.thirdPersonYaw);
        const targetCamY = Math.max(0.4, this.camTargetSmooth.y + this.thirdPersonDistance * Math.sin(this.thirdPersonPitch));
        const targetCamZ = this.camTargetSmooth.z + this.thirdPersonDistance * Math.cos(this.thirdPersonPitch) * Math.cos(this.thirdPersonYaw);
        const desiredCamPos = new THREE.Vector3(targetCamX, targetCamY, targetCamZ);

        this.camera.position.lerp(desiredCamPos, Math.min(1.0, 12 * delta));
        this.camera.lookAt(this.camTargetSmooth);
      }
    }
  }
}
