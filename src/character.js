import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

export class CharacterController {
  constructor(scene, onLoaded = null) {
    this.scene = scene;
    this.onLoaded = onLoaded;

    this.model = null;
    this.mixer = null;
    this.walkAction = null;
    this.spineBone = null;
    this.headBone = null;

    this.isLoaded = false;
    this.visible = true;

    // Transform & Physics
    this.scale = 2.0; // Scaled 2x per user request
    this.groundY = 0.185; // Calibrated to limestone courtyard paving height (18cm above origin)
    this.position = new THREE.Vector3(0, this.groundY, -4.5);
    this.rotationY = 0; // facing direction in radians
    this.targetRotationY = 0;
    this.turnSpeed = 10.0; // rad/s smoothing

    this.walkSpeed = 3.6; // m/s (calibrated for 2x scale stride)
    this.sprintSpeed = 5.8; // m/s
    this.currentSpeed = 0;
    this.isMoving = false;
    this.isSprinting = false;

    // Movement bounds matching courtyard limits
    this.bounds = {
      minX: -14.0,
      maxX: 14.0,
      minZ: -28.0,
      maxZ: 28.0
    };

    this.idleTime = 0;

    this.loadModel();
  }

  loadModel() {
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('./draco/gltf/');

    const loader = new GLTFLoader();
    loader.setDRACOLoader(dracoLoader);

    loader.load(
      'safadi.glb',
      (gltf) => {
        this.model = gltf.scene;
        this.model.scale.set(this.scale, this.scale, this.scale);
        this.model.position.copy(this.position);
        this.model.rotation.y = this.rotationY;

        // Ensure proper shadow casting and material settings
        this.model.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            child.frustumCulled = false; // Prevent clipping glitches during animation

            if (child.material) {
              const materials = Array.isArray(child.material) ? child.material : [child.material];
              materials.forEach((mat) => {
                mat.roughness = Math.max(0.3, mat.roughness ?? 0.6);
                mat.metalness = Math.min(0.2, mat.metalness ?? 0.05);
                mat.envMapIntensity = 1.0;
              });
            }
          }

          if (child.isBone) {
            if (child.name === 'DEF-spine.002' || child.name === 'DEF-spine') {
              this.spineBone = child;
            }
            if (child.name === 'DEF-spine.006' || child.name.includes('head')) {
              this.headBone = child;
            }
          }
        });

        // Set up Animation Mixer
        if (gltf.animations && gltf.animations.length > 0) {
          this.mixer = new THREE.AnimationMixer(this.model);
          const walkClip = gltf.animations.find((a) => a.name.includes('Walk')) || gltf.animations[0];

          if (walkClip) {
            this.walkAction = this.mixer.clipAction(walkClip);
            this.walkAction.setLoop(THREE.LoopRepeat);
            this.walkAction.clampWhenFinished = false;
            this.walkAction.play();
            // Start at zero weight for smooth idle start
            this.walkAction.setEffectiveWeight(0);
          }
        }

        this.scene.add(this.model);
        this.isLoaded = true;

        if (this.onLoaded) {
          this.onLoaded(this);
        }
      },
      undefined,
      (error) => {
        console.error('Error loading Safadi character:', error);
      }
    );
  }

  setVisible(visible) {
    this.visible = visible;
    if (this.model) {
      this.model.visible = visible;
    }
  }

  spawnAt(x, z, rotationY = 0) {
    this.position.set(x, this.groundY, z);
    this.clampPosition(this.position);
    this.rotationY = rotationY;
    this.targetRotationY = rotationY;
    if (this.model) {
      this.model.position.copy(this.position);
      this.model.rotation.y = rotationY;
    }
  }

  clampPosition(pos) {
    pos.x = Math.max(this.bounds.minX, Math.min(this.bounds.maxX, pos.x));
    pos.z = Math.max(this.bounds.minZ, Math.min(this.bounds.maxZ, pos.z));
    pos.y = this.groundY; // locked to courtyard limestone surface
  }

  update(delta, inputDir = null, isSprinting = false) {
    if (!this.isLoaded || !this.model) return;

    this.idleTime += delta;
    this.isSprinting = isSprinting;

    // Movement calculation
    if (inputDir && inputDir.lengthSq() > 0.001) {
      this.isMoving = true;
      const targetSpeed = isSprinting ? this.sprintSpeed : this.walkSpeed;
      this.currentSpeed = THREE.MathUtils.lerp(this.currentSpeed, targetSpeed, 12 * delta);

      // Desired facing direction
      this.targetRotationY = Math.atan2(inputDir.x, inputDir.z);

      // Smooth angular interpolation
      let angleDiff = this.targetRotationY - this.rotationY;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      this.rotationY += angleDiff * Math.min(1.0, this.turnSpeed * delta);

      // Advance position
      this.position.addScaledVector(inputDir, this.currentSpeed * delta);
      this.clampPosition(this.position);
    } else {
      this.isMoving = false;
      this.currentSpeed = THREE.MathUtils.lerp(this.currentSpeed, 0, 14 * delta);
    }

    // Apply transform to model
    this.model.position.copy(this.position);
    this.model.rotation.y = this.rotationY;

    // Blend Walk animation weight
    if (this.walkAction) {
      const targetWeight = this.isMoving ? 1.0 : 0.0;
      const currentWeight = this.walkAction.getEffectiveWeight();
      const newWeight = THREE.MathUtils.lerp(currentWeight, targetWeight, 10 * delta);
      this.walkAction.setEffectiveWeight(newWeight);

      // Adjust animation playback speed to match stride frequency
      const animSpeed = this.isSprinting ? 1.35 : 1.0;
      this.walkAction.timeScale = animSpeed;
    }

    // Update animation mixer
    if (this.mixer) {
      this.mixer.update(delta);
    }

    // Procedural idle breathing and posture sway when standing
    if (!this.isMoving && this.spineBone) {
      const breath = Math.sin(this.idleTime * 2.2) * 0.018;
      this.spineBone.rotation.x = breath;
    }
  }

  getHeadPosition() {
    return new THREE.Vector3(this.position.x, this.position.y + 1.05 * this.scale, this.position.z);
  }
}
