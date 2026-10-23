// Post stack: RenderPass -> Bokeh DOF (only during cinematic cuts) -> soft UnrealBloom -> OutputPass.
// Low quality (weak phones) renders directly: no DOF, no bloom; glows still read via emissive + tone mapping.
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import * as THREE from 'three';

export class Post {
  constructor(stage, { bloom = 0.35, bloomRadius = 0.5, threshold = 0.85 } = {}) {
    this.s = stage; this.dofOn = false; this.focus = new THREE.Vector3(); this.enabled = stage.quality === 'high';
    if (this.enabled) this.build(bloom, bloomRadius, threshold);
    stage.onResize((w, h) => this.composer && (this.composer.setPixelRatio(stage.renderer.getPixelRatio()), this.composer.setSize(w, h)));
  }
  build(bloom, r, th) { const { renderer, scene, camera } = this.s;
    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, camera));
    this.bokeh = new BokehPass(scene, camera, { focus: 5, aperture: 0.006, maxblur: 0.012 }); this.bokeh.enabled = false; this.composer.addPass(this.bokeh);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), bloom, r, th); this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass()); }
  /** depth of field on/off; focus = world point to keep sharp (e.g. the payoff) */
  dof(on, focus) { this.dofOn = on; if (focus) this.focus.copy(focus); if (this.bokeh) this.bokeh.enabled = on; }
  /** drop to the fast path at runtime (fpsMeter onLow) */
  downgrade() { this.enabled = false; const r = this.s.renderer; r.setPixelRatio(1); r.shadowMap.type = THREE.PCFShadowMap;
    this.s.sun.shadow.mapSize.set(1024, 1024); this.s.sun.shadow.map?.dispose(); this.s.sun.shadow.map = null; this.s.quality = 'low'; dispatchEvent(new Event('resize')); }
  render() { const { renderer, scene, camera } = this.s;
    if (!this.enabled) return renderer.render(scene, camera);
    if (this.dofOn) this.bokeh.uniforms.focus.value = camera.position.distanceTo(this.focus);
    this.composer.render(); }
}
