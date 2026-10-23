// Stylized materials: toon banding (cozy low-poly look), soft matte, glow, and stylized water
// (depth gradient + animated caustics + edge foam + ripple rings), all cheap enough for phones.
import * as THREE from 'three';

let _ramp;
function ramp() { if (_ramp) return _ramp; const d = new Uint8Array([90, 170, 235, 255]);
  _ramp = new THREE.DataTexture(d, 4, 1, THREE.RedFormat); _ramp.minFilter = _ramp.magFilter = THREE.NearestFilter; _ramp.needsUpdate = true; return _ramp; }
/** 4-band toon; flatShading gives the faceted low-poly read */
export const toon = (color, o = {}) => new THREE.MeshToonMaterial({ color, gradientMap: ramp(), ...o });
export const lowpoly = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0, flatShading: true, ...o });
export const matte = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.02, ...o });
export const glow = (color, k = 1.5, o = {}) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: k, roughness: 0.4, ...o });
export const PALETTE = { cream: 0xf3e6cf, paper: 0xfbf3e2, brown: 0x6b4426, wood: 0xb98a5e, sage: 0x9fbf9a, teal: 0x4fb3b3,
  deep: 0x1d5f73, foam: 0xfdf8ee, amber: 0xffb867, coral: 0xff7a5c, ink: 0x3b2417 };

/** Stylized water on a plane (or circle). Edge foam uses distance to the uv edge (rect) or radius (round).
 *  Call water.userData.tick(t) every frame; water.userData.ripple(x,z) pushes a ring (up to 6). */
export function stylizedWater({ shallow = PALETTE.teal, deep = PALETTE.deep, foam = PALETTE.foam, round = true } = {}) {
  const N = 6, rip = Array.from({ length: N }, () => new THREE.Vector4(0, 0, -99, 0));
  const m = new THREE.ShaderMaterial({ transparent: true, fog: false,
    uniforms: { uT: { value: 0 }, uShallow: { value: new THREE.Color(shallow) }, uDeep: { value: new THREE.Color(deep) },
      uFoam: { value: new THREE.Color(foam) }, uRound: { value: round ? 1 : 0 }, uRip: { value: rip }, uGlow: { value: 0 } },
    vertexShader: `varying vec2 vUv; varying vec3 vW; void main(){ vUv=uv; vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `uniform float uT,uRound,uGlow; uniform vec3 uShallow,uDeep,uFoam; uniform vec4 uRip[${N}]; varying vec2 vUv; varying vec3 vW;
      float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+1.),f.x),f.y);}
      float cell(vec2 p){vec2 i=floor(p),f=fract(p);float d=1.;for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 g=vec2(x,y);vec2 o=vec2(h(i+g),h(i+g+7.));o=.5+.5*sin(uT*.8+6.28*o);d=min(d,length(g+o-f));}return d;}
      void main(){ vec2 c=vUv-.5; float edge = uRound>.5 ? (0.5-length(c))*2. : min(min(vUv.x,1.-vUv.x),min(vUv.y,1.-vUv.y))*2.;
        float depth=smoothstep(0.,.7,edge); vec3 col=mix(uShallow,uDeep,depth);
        vec2 p=vW.xz*1.6; float ca=pow(1.-cell(p+vec2(uT*.15,uT*.1)),6.)*.55+pow(1.-cell(p*1.7-uT*.12),8.)*.35;
        col+=ca*(1.-depth*.6)*vec3(.9,1.,.95);
        float fn=vn(vW.xz*6.+uT*.6); float foam=smoothstep(.12+.06*sin(uT*2.+fn*6.),.0,edge-.04*fn);
        float ring=0.; for(int i=0;i<${N};i++){ vec4 r=uRip[i]; float age=uT-r.z; if(age<0.||age>2.2)continue; float rad=age*1.3*r.w+.05;
          float d=abs(length(vW.xz-r.xy)-rad); ring+=smoothstep(.07,0.,d)*(1.-age/2.2)*r.w; }
        col=mix(col,uFoam,clamp(foam+ring*.8,0.,1.)); col+=uGlow*vec3(.4,.9,1.)*(1.-depth*.5);
        gl_FragColor=vec4(col,.92); }` });
  const g = new THREE.Mesh(round ? new THREE.CircleGeometry(1, 64) : new THREE.PlaneGeometry(1, 1), m); g.rotation.x = -Math.PI / 2; g.receiveShadow = false;
  let k = 0; g.userData.tick = t => { m.uniforms.uT.value = t; };
  g.userData.ripple = (x, z, strength = 1) => { rip[k++ % N].set(x, z, m.uniforms.uT.value, strength); };
  g.userData.glow = v => { m.uniforms.uGlow.value = v; };
  return g;
}
