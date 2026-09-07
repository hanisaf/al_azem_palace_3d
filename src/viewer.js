import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { NavigationController } from './controls.js';
import { LANDMARKS } from './landmarks.js';

// Exact calibrated architectural palette from Blender al_azem_palace.blend
const MATERIAL_PALETTE = {
  'AZ | Hauran basalt 0': { color: 0x222525, roughness: 0.72, metalness: 0.02 },
  'AZ | Hauran basalt 1': { color: 0x30322e, roughness: 0.72, metalness: 0.02 },
  'AZ | Hauran basalt 2': { color: 0x3e3c34, roughness: 0.70, metalness: 0.02 },
  'AZ | Warm limestone 0': { color: 0xb59a72, roughness: 0.65, metalness: 0.0 },
  'AZ | Warm limestone 1': { color: 0xc4af88, roughness: 0.65, metalness: 0.0 },
  'AZ | Warm limestone 2': { color: 0xd2be98, roughness: 0.65, metalness: 0.0 },
  'AZ | Warm limestone 3': { color: 0xbfae87, roughness: 0.65, metalness: 0.0 },
  'AZ | Carved walnut': { color: 0x26140b, roughness: 0.52, metalness: 0.0 },
  'AZ | Walnut raised mouldings': { color: 0x3e2210, roughness: 0.48, metalness: 0.0 },
  'AZ | Garden earth': { color: 0x22170f, roughness: 0.95, metalness: 0.0 },
  'AZ | Terracotta': { color: 0x7c3818, roughness: 0.82, metalness: 0.0 },
  'AZ | Ivory marble': { color: 0xd6cbb2, roughness: 0.25, metalness: 0.02 },
  'AZ | Rose marble inlay': { color: 0x6e3522, roughness: 0.35, metalness: 0.0 },
  'AZ | Lime plaster': { color: 0xb3a07b, roughness: 0.88, metalness: 0.0 },
  'AZ | Black marble inlay': { color: 0x121514, roughness: 0.30, metalness: 0.02 },
  'AZ | Painted turquoise': { color: 0x114e4a, roughness: 0.42, metalness: 0.0 },
  'AZ | Aged brass': { color: 0x946b2b, roughness: 0.32, metalness: 0.88 },
  'AZ | Deep window recess': { color: 0x070b0c, roughness: 0.90, metalness: 0.0 },
  'AZ | Bitter oranges': { color: 0xe05008, roughness: 0.45, metalness: 0.0 },
  'AZ | Citrus leaves 0': { color: 0x1a3a0e, roughness: 0.65, metalness: 0.0 },
  'AZ | Citrus leaves 1': { color: 0x264d12, roughness: 0.65, metalness: 0.0 },
  'AZ | Citrus leaves 2': { color: 0x325619, roughness: 0.65, metalness: 0.0 },
  'AZ | Citrus leaves 3': { color: 0x182c0b, roughness: 0.65, metalness: 0.0 },
  'AZ | Cypress foliage': { color: 0x102613, roughness: 0.85, metalness: 0.0 },
  'AZ | Bougainvillea 0': { color: 0x940828, roughness: 0.60, metalness: 0.0 },
  'AZ | Bougainvillea 1': { color: 0xc7154f, roughness: 0.60, metalness: 0.0 },
  'AZ | Bougainvillea 2': { color: 0xde286f, roughness: 0.60, metalness: 0.0 },
  'AZ | Fountain water': { color: 0x20888c, roughness: 0.08, metalness: 0.15, transparent: true, opacity: 0.85 }
};

// Generate procedural subtle stone surface bump map
function createStoneBumpTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const imgData = ctx.createImageData(size, size);
  for (let i = 0; i < imgData.data.length; i += 4) {
    const val = 120 + Math.floor(Math.random() * 35);
    imgData.data[i] = val;
    imgData.data[i + 1] = val;
    imgData.data[i + 2] = val;
    imgData.data[i + 3] = 255;
  }
  ctx.putImageData(imgData, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(16, 16);
  return tex;
}

export class PalaceViewer {
  constructor(canvasContainer, onProgress, onLoadComplete, onError) {
    this.container = canvasContainer;
    this.onProgress = onProgress;
    this.onLoadComplete = onLoadComplete;
    this.onError = onError;

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controller = null;
    this.clock = new THREE.Clock();

    this.model = null;
    this.waterMeshes = [];
    this.lanternLights = [];
    this.dirLight = null;
    this.hemiLight = null;
    this.iwanBounceLight = null;
    this.ambientLight = null;
    this.currentAtmosphere = 'day';
    this.stoneBumpTex = null;

    this.init();
  }

  init() {
    this.stoneBumpTex = createStoneBumpTexture();

    // 1. Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#cce2f2');
    this.scene.fog = new THREE.FogExp2('#cce2f2', 0.0055);

    // 2. Camera
    const aspect = this.container.clientWidth / this.container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(50, aspect, 0.2, 500);
    this.camera.position.set(-28.0, 22.0, -32.0);

    // 3. Renderer with AgX Tone Mapping (matches Blender 5.x AgX color management)
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
      logarithmicDepthBuffer: true // Prevents Z-fighting on fine architectural details
    });
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.AgXToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.container.appendChild(this.renderer.domElement);

    // 4. Controller
    this.controller = new NavigationController(this.camera, this.renderer.domElement);
    this.controller.orbit.target.set(0, 3.5, 0);

    // 5. Lighting Setup (calibrated to Blender's Late afternoon sun and bounce fill)
    this.setupLighting();

    // 6. Sky & Ground plane
    this.setupEnvironment();

    // 7. Load GLB Model
    this.loadModel();

    // 8. Event listeners
    window.addEventListener('resize', this.onWindowResize.bind(this));

    // 9. Start render loop
    this.animate();
  }

  setupLighting() {
    // 1. Sun light: angled vector matches Blender "Late afternoon sun"
    this.dirLight = new THREE.DirectionalLight(0xffeedb, 2.5);
    this.dirLight.position.set(-35, 46, 15.5);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.width = 2048;
    this.dirLight.shadow.mapSize.height = 2048;
    this.dirLight.shadow.camera.near = 5;
    this.dirLight.shadow.camera.far = 130;
    this.dirLight.shadow.bias = -0.00015;
    this.dirLight.shadow.radius = 1.4;
    const d = 42;
    this.dirLight.shadow.camera.left = -d;
    this.dirLight.shadow.camera.right = d;
    this.dirLight.shadow.camera.top = d;
    this.dirLight.shadow.camera.bottom = -d;
    this.scene.add(this.dirLight);

    // 2. Sky and courtyard bounce radiance (HemisphereLight)
    this.hemiLight = new THREE.HemisphereLight(0x9fc4e8, 0x917f69, 0.75);
    this.scene.add(this.hemiLight);

    // 3. Iwan soft bounce light (matches Blender's "Iwan soft bounce" area light)
    this.iwanBounceLight = new THREE.PointLight(0xffecd6, 1.8, 28, 1.2);
    this.iwanBounceLight.position.set(0.0, 4.5, 17.0);
    this.iwanBounceLight.castShadow = false;
    this.scene.add(this.iwanBounceLight);

    // 4. Soft ambient fill
    this.ambientLight = new THREE.AmbientLight(0xfff3e5, 0.35);
    this.scene.add(this.ambientLight);

    // 5. Authentic Night Lanterns
    const lanternCoords = [
      { x: 0.0, y: 6.2, z: 29.1, intensity: 6.5, dist: 26, color: 0xffb347 }, // Great Iwan
      { x: -7.8, y: 5.4, z: -27.2, intensity: 4.8, dist: 18, color: 0xffa033 }, // Riwaq Left
      { x: 0.0, y: 5.4, z: -27.2, intensity: 4.8, dist: 18, color: 0xffa033 },  // Riwaq Center
      { x: 7.8, y: 5.4, z: -27.2, intensity: 4.8, dist: 18, color: 0xffa033 },  // Riwaq Right
      { x: 0.0, y: 1.2, z: -17.0, intensity: 3.8, dist: 15, color: 0xffb84d }   // North Fountain
    ];

    lanternCoords.forEach((coord) => {
      const light = new THREE.PointLight(coord.color, 0, coord.dist, 1.8);
      light.position.set(coord.x, coord.y, coord.z);
      light.castShadow = false;
      this.scene.add(light);
      this.lanternLights.push({ light, maxIntensity: coord.intensity });
    });
  }

  setupEnvironment() {
    // Ground plane matching Syrian limestone sand
    const groundGeo = new THREE.PlaneGeometry(400, 400);
    this.groundMat = new THREE.MeshStandardMaterial({
      color: 0x9c8e7b,
      roughness: 0.95,
      metalness: 0.02
    });
    const ground = new THREE.Mesh(groundGeo, this.groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.01;
    ground.receiveShadow = true;
    this.scene.add(ground);
  }

  loadModel() {
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('./draco/gltf/');

    const loader = new GLTFLoader();
    loader.setDRACOLoader(dracoLoader);

    const modelUrl = 'palace.glb';
    this.lanternMeshes = [];

    loader.load(
      modelUrl,
      (gltf) => {
        this.model = gltf.scene;

        this.model.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;

            const isMortarBacking = child.name && child.name.includes('Mortar backing');
            if (child.name && child.name.toLowerCase().includes('lantern')) {
              this.lanternMeshes.push(child);
            }

            const materials = Array.isArray(child.material) ? child.material : [child.material];
            materials.forEach((mat) => {
              if (!mat) return;
              const name = mat.name || '';

              // Apply calibrated Damascus palette
              const pal = MATERIAL_PALETTE[name];
              if (pal) {
                mat.color.setHex(pal.color);
                mat.roughness = pal.roughness;
                mat.metalness = pal.metalness;

                // Subtle bump on stone surfaces
                if (name.includes('basalt') || name.includes('limestone') || name.includes('plaster')) {
                  mat.bumpMap = this.stoneBumpTex;
                  mat.bumpScale = 0.003;
                }

                if (pal.transparent) {
                  mat.transparent = true;
                  mat.opacity = pal.opacity || 0.85;
                  this.waterMeshes.push(child);
                }
              }

              // Double-sided foliage
              if (name.includes('Bougainvillea') || name.includes('Citrus leaves') || name.includes('Cypress')) {
                mat.side = THREE.DoubleSide;
                mat.shadowSide = THREE.DoubleSide;
              }

              // Prevent Z-fighting between mortar backing and facade ablaq stones
              if (isMortarBacking) {
                mat.polygonOffset = true;
                mat.polygonOffsetFactor = 1.5;
                mat.polygonOffsetUnits = 1.5;
              }
            });
          }
        });

        this.scene.add(this.model);

        if (this.onLoadComplete) {
          this.onLoadComplete();
        }
      },
      (xhr) => {
        if (xhr.lengthComputable && this.onProgress) {
          const percent = (xhr.loaded / xhr.total) * 100;
          this.onProgress(percent);
        }
      },
      (error) => {
        console.error('An error happened loading the palace model:', error);
        if (this.onError) {
          this.onError(error);
        }
      }
    );
  }

  setAtmosphere(mode) {
    this.currentAtmosphere = mode;

    if (mode === 'day') {
      this.scene.background.set(0xcce2f2);
      this.scene.fog.color.set(0xcce2f2);
      this.renderer.toneMappingExposure = 1.0;

      this.dirLight.color.setHex(0xffeedb);
      this.dirLight.intensity = 2.5;
      this.dirLight.position.set(-35, 46, 15.5);

      this.hemiLight.color.setHex(0x9fc4e8);
      this.hemiLight.groundColor.setHex(0x917f69);
      this.hemiLight.intensity = 0.75;

      if (this.iwanBounceLight) this.iwanBounceLight.intensity = 1.8;
      if (this.ambientLight) this.ambientLight.intensity = 0.35;
      if (this.groundMat) this.groundMat.color.setHex(0x9c8e7b);

      this.lanternLights.forEach(({ light }) => {
        light.intensity = 0;
      });
      this.lanternMeshes.forEach((mesh) => {
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        mats.forEach((m) => {
          m.emissive?.setHex(0x000000);
          m.emissiveIntensity = 0;
        });
      });
    } else if (mode === 'sunset') {
      // Golden Hour
      this.scene.background.set(0xe88a48);
      this.scene.fog.color.set(0xdc7d3d);
      this.renderer.toneMappingExposure = 1.15;

      this.dirLight.color.setHex(0xff8030);
      this.dirLight.intensity = 3.2;
      this.dirLight.position.set(-45, 18, 10);

      this.hemiLight.color.setHex(0xffa873);
      this.hemiLight.groundColor.setHex(0x754020);
      this.hemiLight.intensity = 0.95;

      if (this.iwanBounceLight) this.iwanBounceLight.intensity = 2.4;
      if (this.ambientLight) this.ambientLight.intensity = 0.4;
      if (this.groundMat) this.groundMat.color.setHex(0x7a4e28);

      this.lanternLights.forEach(({ light, maxIntensity }) => {
        light.intensity = maxIntensity * 0.5;
      });
      this.lanternMeshes.forEach((mesh) => {
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        mats.forEach((m) => {
          m.emissive?.setHex(0xff8822);
          m.emissiveIntensity = 1.2;
        });
      });
    } else if (mode === 'night') {
      // Ottoman Night
      this.scene.background.set(0x0a111a);
      this.scene.fog.color.set(0x0a111a);
      this.renderer.toneMappingExposure = 1.35;

      this.dirLight.color.setHex(0x5a7694);
      this.dirLight.intensity = 0.35;
      this.dirLight.position.set(-25, 40, -25);

      this.hemiLight.color.setHex(0x1a2638);
      this.hemiLight.groundColor.setHex(0x0c1016);
      this.hemiLight.intensity = 0.25;

      if (this.iwanBounceLight) this.iwanBounceLight.intensity = 0.3;
      if (this.ambientLight) this.ambientLight.intensity = 0.15;
      if (this.groundMat) this.groundMat.color.setHex(0x10151c);

      this.lanternLights.forEach(({ light, maxIntensity }) => {
        light.intensity = maxIntensity * 1.5;
      });
      this.lanternMeshes.forEach((mesh) => {
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        mats.forEach((m) => {
          m.emissive?.setHex(0xffaa33);
          m.emissiveIntensity = 3.5;
        });
      });
    }
  }

  jumpToLandmark(landmarkId) {
    const landmark = LANDMARKS.find((l) => l.id === landmarkId);
    if (!landmark) return;

    const pos = new THREE.Vector3(landmark.position.x, landmark.position.y, landmark.position.z);
    const target = new THREE.Vector3(landmark.target.x, landmark.target.y, landmark.target.z);

    this.controller.flyTo(pos, target);
  }

  captureScreenshot() {
    this.renderer.render(this.scene, this.camera);
    const dataURL = this.renderer.domElement.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `Al-Azm-Palace-${this.currentAtmosphere}-${Date.now()}.png`;
    link.href = dataURL;
    link.click();
  }

  onWindowResize() {
    if (!this.container || !this.renderer || !this.camera) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  animate() {
    requestAnimationFrame(this.animate.bind(this));

    const delta = Math.min(this.clock.getDelta(), 0.1);
    const elapsedTime = this.clock.getElapsedTime();

    if (this.controller) {
      this.controller.update(delta);
    }

    // Subtle gentle motion on water surface
    if (this.waterMeshes.length > 0) {
      const wave = Math.sin(elapsedTime * 2.2) * 0.003;
      this.waterMeshes.forEach((mesh) => {
        mesh.position.y = wave;
      });
    }

    this.renderer.render(this.scene, this.camera);
  }
}
