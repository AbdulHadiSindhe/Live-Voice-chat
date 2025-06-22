/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
/* tslint:disable */

import {LitElement, css, html} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import {Analyser} from './analyser';

@customElement('gdm-live-audio-visuals')
export class GdmLiveAudioVisuals extends LitElement {
  private inputAnalyser: Analyser;
  private outputAnalyser: Analyser;

  private _outputNode: AudioNode;

  @property()
  set outputNode(node: AudioNode) {
    this._outputNode = node;
    this.outputAnalyser = new Analyser(this._outputNode);
  }

  get outputNode() {
    return this._outputNode;
  }

  private _inputNode: AudioNode;

  @property()
  set inputNode(node: AudioNode) {
    this._inputNode = node;
    this.inputAnalyser = new Analyser(this._inputNode);
  }

  get inputNode() {
    return this._inputNode;
  }

  private canvas: HTMLCanvasElement;
  private canvasCtx: CanvasRenderingContext2D;

  static styles = css`
    canvas {
      width: 400px;
      aspect-ratio: 1 / 1;
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    // Defer visualization until canvas is ready and analysers are initialized.
  }

  private visualize() {
    if (this.canvas && this.canvasCtx && this.outputAnalyser && this.inputAnalyser) { // Ensure canvasCtx is also initialized
      const canvas = this.canvas;
      const canvasCtx = this.canvasCtx;

      const WIDTH = canvas.width;
      const HEIGHT = canvas.height;

      canvasCtx.clearRect(0, 0, WIDTH, HEIGHT);
      canvasCtx.fillStyle = '#f0f0f0'; // Light gray background for light theme
      canvasCtx.fillRect(0, 0, WIDTH, HEIGHT);

      const barWidth = WIDTH / this.outputAnalyser.data.length;
      let x = 0;

      const inputGradient = canvasCtx.createLinearGradient(0, 0, 0, HEIGHT);
      inputGradient.addColorStop(1, '#D16BA5');
      inputGradient.addColorStop(0.5, '#E78686');
      inputGradient.addColorStop(0, '#FB5F5F');
      canvasCtx.fillStyle = inputGradient;

      this.inputAnalyser.update();

      for (let i = 0; i < this.inputAnalyser.data.length; i++) {
        const barHeight = this.inputAnalyser.data[i] * (HEIGHT / 255);
        canvasCtx.fillRect(x, HEIGHT - barHeight, barWidth, barHeight);
        x += barWidth;
      }

      canvasCtx.globalCompositeOperation = 'lighter';

      const outputGradient = canvasCtx.createLinearGradient(0, 0, 0, HEIGHT);
      outputGradient.addColorStop(1, '#3b82f6');
      outputGradient.addColorStop(0.5, '#10b981');
      outputGradient.addColorStop(0, '#ef4444');
      canvasCtx.fillStyle = outputGradient;

      x = 0;
      this.outputAnalyser.update();

      for (let i = 0; i < this.outputAnalyser.data.length; i++) {
        const barHeight = this.outputAnalyser.data[i] * (HEIGHT / 255);
        canvasCtx.fillRect(x, HEIGHT - barHeight, barWidth, barHeight);
        x += barWidth;
      }
      canvasCtx.globalCompositeOperation = 'source-over'; // Reset composite operation
    }
    requestAnimationFrame(() => this.visualize());
  }

  protected firstUpdated() {
    this.canvas = this.shadowRoot!.querySelector('canvas');
    this.canvas.width = 400;
    this.canvas.height = 400;
    this.canvasCtx = this.canvas.getContext('2d');
    // Start visualization once everything is set up
    if (this.inputNode && this.outputNode) {
        this.visualize();
    }
  }
  
  protected updated(changedProperties: Map<string | number | symbol, unknown>) {
    super.updated(changedProperties);
    if ((changedProperties.has('inputNode') || changedProperties.has('outputNode')) && this.inputNode && this.outputNode && this.canvasCtx) {
        // If analysers are set up after firstUpdated, start visualizing
        // Check if visualize loop is already running to prevent multiple loops
        if (!this.outputAnalyser?.data) { // A simple check, could be more robust
            this.visualize();
        }
    }
  }

  protected render() {
    return html`<canvas></canvas>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'gdm-live-audio-visuals': GdmLiveAudioVisuals;
  }
}
