/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// tslint:disable:organize-imports
// tslint:disable:ban-malformed-import-paths
// tslint:disable:no-new-decorators

import {LitElement, css, html} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import {Analyser} from './analyser';

import * as THREE from 'three';
// import {EXRLoader} from 'three/addons/loaders/EXRLoader.js'; // Removed
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {FXAAShader} from 'three/addons/shaders/FXAAShader.js';
// import {fs as backdropFS, vs as backdropVS} from './backdrop-shader'; // Removed backdrop
import {vs as sphereVS} from './sphere-shader';

/**
 * 3D live audio visual.
 */
@customElement('gdm-live-audio-visuals-3d')
export class GdmLiveAudioVisuals3D extends LitElement {
  private inputAnalyser!: Analyser;
  private outputAnalyser!: Analyser;
  private camera!: THREE.PerspectiveCamera;
  // private backdrop!: THREE.Mesh; // Removed backdrop
  private composer!: EffectComposer;
  private sphere!: THREE.Mesh;
  private prevTime = 0;
  private rotation = new THREE.Vector3(0, 0, 0);

  private _outputNode!: AudioNode;

  @property()
  set outputNode(node: AudioNode) {
    this._outputNode = node;
    this.outputAnalyser = new Analyser(this._outputNode);
  }

  get outputNode() {
    return this._outputNode;
  }

  private _inputNode!: AudioNode;

  @property()
  set inputNode(node: AudioNode) {
    this._inputNode = node;
    this.inputAnalyser = new Analyser(this._inputNode);
  }

  get inputNode() {
    return this._inputNode;
  }

  private canvas!: HTMLCanvasElement;

  static styles = css`
    :host {
      display: block;
      position: fixed; /* Position relative to the viewport */
      top: 0;
      left: 0;
      width: 100vw; /* Corrected typo from heigh100vw */
      height: 100vh;
      z-index: 0; /* Ensure it's behind controls */
    }
    canvas {
      display: block; /* Ensure canvas behaves as a block and fills the host */
      width: 100%;
      height: 100%;
      image-rendering: pixelated; /* Existing stylistic choice */
      /* position: absolute and inset: 0 are no longer needed here */
    }
  `;

  connectedCallback() {
    super.connectedCallback();
  }

  private init() {
    const scene = new THREE.Scene();
    // Set scene background to null for transparency, allowing CSS background to show.
    scene.background = null;

    // Add Ambient Light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8); // Soft white light
    scene.add(ambientLight);

    // Add Directional Light
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0); // White light
    directionalLight.position.set(2, 3, 4); // Position the light
    scene.add(directionalLight);


    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000,
    );
    camera.position.set(2, -2, 5);
    this.camera = camera;

    const renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true, // Enable antialias for smoother sphere
      alpha: true, // Enable alpha for transparent background
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setClearColor(0x000000, 0); // Explicitly set clear color to transparent

    const geometry = new THREE.IcosahedronGeometry(1, 10);

    const sphereMaterial = new THREE.MeshStandardMaterial({
      metalness: 0.6,
      roughness: 0.2,
    });

    sphereMaterial.onBeforeCompile = (shader) => {
      // Ensure USE_UV is defined so vUv is available in the fragment shader
      shader.defines = shader.defines || {};
      shader.defines.USE_UV = "";

      shader.uniforms.time = {value: 0};
      shader.uniforms.inputData = {value: new THREE.Vector4()};
      shader.uniforms.outputData = {value: new THREE.Vector4()};

      sphereMaterial.userData.shader = shader; // Store shader for uniform updates if needed later

      shader.vertexShader = sphereVS; // Apply custom vertex shader
      
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <color_fragment>', // This is the placeholder for diffuse color calculation
        `
        // The original #include <color_fragment> is now replaced by this code.
        // We need to set 'diffuseColor.rgb'.
        // vUv should be available because we defined USE_UV.

        vec3 blueColor = vec3(0.0, 0.47, 1.0); // A nice blue (0x007bff)
        vec3 pinkColor = vec3(1.0, 0.0, 0.5);   // A vibrant pink (0xff007f)
        
        // Use vUv.y for a vertical gradient.
        // vUv.y ranges from 0.0 to 1.0 across the texture/geometry.
        float mixFactor = clamp(vUv.y, 0.0, 1.0); 
        
        vec3 gradient = mix(blueColor, pinkColor, mixFactor);
        
        // diffuseColor is a vec4 (RGBA). We set its RGB. Alpha comes from material.opacity.
        // It's declared in <color_pars_fragment> as 'vec4 diffuseColor = vec4( 1.0 );'
        diffuseColor.rgb = gradient;
        `
      );
    };

    const sphere = new THREE.Mesh(geometry, sphereMaterial);
    scene.add(sphere);
    sphere.visible = true;

    this.sphere = sphere;

    const renderPass = new RenderPass(scene, camera);

    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      1.2, // strength
      0.5, // radius
      0.8, // threshold
    );

    const fxaaPass = new ShaderPass(FXAAShader);
    
    const composer = new EffectComposer(renderer);
    composer.addPass(renderPass);
    composer.addPass(bloomPass); // Bloom before FXAA for better effect
    // composer.addPass(fxaaPass); // FXAA can be re-enabled if needed

    this.composer = composer;

    const onWindowResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      const dPR = renderer.getPixelRatio();
      const w = window.innerWidth;
      const h = window.innerHeight;

      renderer.setSize(w, h);
      composer.setSize(w, h);
      if (fxaaPass.material.uniforms['resolution']) {
        fxaaPass.material.uniforms['resolution'].value.set(
            1 / (w * dPR),
            1 / (h * dPR),
        );
      }
    }

    window.addEventListener('resize', onWindowResize);
    onWindowResize();

    this.animation();
  }

  private animation() {
    requestAnimationFrame(() => this.animation());

    if (!this.inputAnalyser || !this.outputAnalyser || !this.sphere || !this.camera) return;

    this.inputAnalyser.update();
    this.outputAnalyser.update();

    const t = performance.now();
    const dt = (t - this.prevTime) / (1000 / 60);
    this.prevTime = t;
    
    const sphereMaterial = this.sphere.material as THREE.MeshStandardMaterial;
    if (sphereMaterial.userData.shader) {
      this.sphere.scale.setScalar(
        1 + (0.2 * this.outputAnalyser.data[1]) / 255,
      );

      const f = 0.001;
      this.rotation.x += (dt * f * 0.5 * this.outputAnalyser.data[1]) / 255;
      this.rotation.z += (dt * f * 0.5 * this.inputAnalyser.data[1]) / 255;
      this.rotation.y += (dt * f * 0.25 * this.inputAnalyser.data[2]) / 255;
      this.rotation.y += (dt * f * 0.25 * this.outputAnalyser.data[2]) / 255;

      const euler = new THREE.Euler(
        this.rotation.x,
        this.rotation.y,
        this.rotation.z,
      );
      const quaternion = new THREE.Quaternion().setFromEuler(euler);
      const vector = new THREE.Vector3(0, 0, 5);
      vector.applyQuaternion(quaternion);
      this.camera.position.copy(vector);
      this.camera.lookAt(this.sphere.position);

      // These uniforms are for the vertex shader (sphereVS)
      sphereMaterial.userData.shader.uniforms.time.value +=
        (dt * 0.1 * this.outputAnalyser.data[0]) / 255;
      sphereMaterial.userData.shader.uniforms.inputData.value.set(
        (1 * this.inputAnalyser.data[0]) / 255,
        (0.1 * this.inputAnalyser.data[1]) / 255,
        (10 * this.inputAnalyser.data[2]) / 255,
        0,
      );
      sphereMaterial.userData.shader.uniforms.outputData.value.set(
        (2 * this.outputAnalyser.data[0]) / 255,
        (0.1 * this.outputAnalyser.data[1]) / 255,
        (10 * this.outputAnalyser.data[2]) / 255,
        0,
      );
    }

    this.composer.render();
  }

  protected firstUpdated() {
    this.canvas = this.shadowRoot!.querySelector('canvas') as HTMLCanvasElement;
  }

  protected updated(changedProperties: Map<string | number | symbol, unknown>) {
    super.updated(changedProperties);
    if ((changedProperties.has('inputNode') || changedProperties.has('outputNode')) && this.inputNode && this.outputNode && !this.camera) {
      this.init();
    }
  }

  protected render() {
    return html`<canvas></canvas>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'gdm-live-audio-visuals-3d': GdmLiveAudioVisuals3D;
  }
}