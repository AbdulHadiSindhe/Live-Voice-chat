/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
const vs = `precision highp float;

in vec3 position;

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;

void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
}`;

const fs = `precision highp float;

out vec4 fragmentColor;

uniform vec2 resolution;
uniform float rand;

void main() {
  float aspectRatio = resolution.x / resolution.y; 
  vec2 vUv = gl_FragCoord.xy / resolution;
  float noise = (fract(sin(dot(vUv, vec2(12.9898 + rand,78.233)*2.0)) * 43758.5453));

  vUv -= .5;
  vUv.x *= aspectRatio;

  float factor = 4.; // Gradient spread factor
  float d = factor * length(vUv);
  
  // Blue to Pink gradient
  vec3 fromColor = vec3(0.1, 0.3, 0.8); // A nice blue
  vec3 toColor = vec3(0.9, 0.2, 0.5);   // A vibrant pink

  vec3 mixedColor = mix(fromColor, toColor, clamp(d, 0.0, 1.0)); // Use clamp for smoother transition at edges

  fragmentColor = vec4(mixedColor + .005 * noise, 1.);
}
`;

export {fs, vs};