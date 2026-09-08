import './style.css'
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { movePosition } from './navigation.mjs'

type Zone = 'north' | 'west' | 'east' | 'reception'
interface Artwork { id: string; title: string; zone: Zone; image: string; position: [number, number, number]; rotation: number; width: number; height: number; description: string; medium: string }
interface GalleryData { artworks: Artwork[]; colliders: {x:number;z:number;width:number;depth:number}[]; bounds: {minX:number;maxX:number;minZ:number;maxZ:number} }
const $ = <T extends HTMLElement = HTMLElement>(selector: string) => document.querySelector<T>(selector)!
const canvas = $<HTMLCanvasElement>('#scene')
const artDialog = $<HTMLDialogElement>('#art-dialog')
const catalogDialog = $<HTMLDialogElement>('#catalog-dialog')
const aboutDialog = $<HTMLDialogElement>('#about-dialog')
const zoneNames: Record<Zone,string> = {north:'主展牆',west:'西側展區',east:'東側展區',reception:'接待區'}
const base = import.meta.env.BASE_URL
const scene = new THREE.Scene()
scene.background = new THREE.Color('#bcb8aa')
const camera = new THREE.PerspectiveCamera(65, 1, .05, 45)
camera.rotation.order = 'YXZ'
let renderer: THREE.WebGLRenderer | undefined
let data: GalleryData
let selected = 0
let yaw = .16, pitch = 0
let ready = false
let sceneAvailable = false
let highQuality = false
let returnFocus: HTMLElement | null = null
let activeZone: Zone | null = null
const keys = new Set<string>()
const artworks = new Map<string,THREE.Mesh>()
const raycaster = new THREE.Raycaster()
const pointer = new THREE.Vector2()
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches
let transition: {from:THREE.Vector3;to:THREE.Vector3;fromYaw:number;toYaw:number;fromPitch:number;start:number} | null = null
const clock = new THREE.Timer()
const modalOpen = () => !!document.querySelector('dialog[open]')
let toastTimer: ReturnType<typeof setTimeout>
function toast(message:string) {
  $('#toast').textContent=message; $('#toast').hidden=false
  clearTimeout(toastTimer); toastTimer=setTimeout(()=>$('#toast').hidden=true,4000)
}
function dismissIntro() { $('.intro').classList.add('dismissed') }
function resetInput() { keys.clear(); drag=null; canvas.classList.remove('dragging'); $('#hover-label').hidden=true }
function showModal(dialog:HTMLDialogElement) {
  resetInput()
  if (!modalOpen()) returnFocus=document.activeElement as HTMLElement
  document.querySelectorAll<HTMLDialogElement>('dialog[open]').forEach(d=>d.close())
  dialog.showModal()
}
function closeModal(dialog:HTMLDialogElement) { dialog.close() }
for (const dialog of document.querySelectorAll<HTMLDialogElement>('dialog')) {
  dialog.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>closeModal(dialog)))
  dialog.addEventListener('click',e=>{ if(e.target===dialog){ const r=dialog.getBoundingClientRect(); if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom) closeModal(dialog) } })
  dialog.addEventListener('close',()=>{ resetInput(); if(!modalOpen()) returnFocus?.focus({preventScroll:true}) })
}
$('#about-button').addEventListener('click',()=>showModal(aboutDialog))
$('#catalog-button').addEventListener('click',()=>{if(ready)showModal(catalogDialog)})
function renderArt() {
  const a=data.artworks[selected]
  $('#art-title').textContent=a.title
  $<HTMLImageElement>('#art-image').src=base+a.image
  $<HTMLImageElement>('#art-image').alt=`${a.title}：抽象色塊與弧線的示意作品`
  $('#art-index').textContent=a.id
  $('#art-medium').textContent=a.medium
  $('#art-description').textContent=a.description
  $('#art-zone').textContent=zoneNames[a.zone]
  $('#art-page').textContent=`${a.id} / ${data.artworks.length}`
  $<HTMLButtonElement>('#locate-art').disabled=!sceneAvailable
}
function openArt(id:string) { selected=data.artworks.findIndex(a=>a.id===id); if(selected<0)return; renderArt(); showModal(artDialog) }
function stepArt(delta:number) { selected=(selected+delta+data.artworks.length)%data.artworks.length; renderArt() }
$('#prev-art').addEventListener('click',()=>stepArt(-1))
$('#next-art').addEventListener('click',()=>stepArt(1))
function buildCatalog() {
  const frag=document.createDocumentFragment()
  data.artworks.forEach(a=>{
    const b=document.createElement('button'); b.className='catalog-card'; b.dataset.artId=a.id
    const thumb=document.createElement('div');thumb.className='catalog-thumb'
    const img=document.createElement('img');img.src=base+a.image;img.alt='';img.loading='lazy';thumb.append(img)
    const p=document.createElement('p');const num=document.createElement('span');num.textContent=a.id;p.append(num,document.createTextNode(a.title))
    const small=document.createElement('small');small.textContent=`${zoneNames[a.zone]} / 示意作品`
    b.append(thumb,p,small);b.addEventListener('click',()=>openArt(a.id));frag.append(b)
  });$('#catalog-grid').append(frag)
}
function goTo(position:THREE.Vector3,newYaw:number,zone:Zone|null) {
  if(!sceneAvailable)return
  resetInput();dismissIntro(); activeZone=zone
  $('#zone-label').textContent=zone?zoneNames[zone]:'展間全景'
  document.querySelectorAll<HTMLElement>('[data-zone]').forEach(b=>b.classList.toggle('active',b.dataset.zone===zone))
  // Jump between stations; rotating in place is eased, never travel through a wall/pillar.
  camera.position.copy(position)
  const shortest=THREE.MathUtils.euclideanModulo(newYaw-yaw+Math.PI,Math.PI*2)-Math.PI
  transition={from:position.clone(),to:position,fromYaw:yaw,toYaw:yaw+shortest,fromPitch:pitch,start:performance.now()}
  if(reduceMotion){yaw=newYaw;pitch=0;transition=null}
  canvas.focus({preventScroll:true})
}
const stations:Record<Zone,{position:[number,number,number];yaw:number}>={
  north:{position:[.65,1.65,-3.6],yaw:0},
  west:{position:[-2.8,1.65,.8],yaw:Math.PI/2},
  east:{position:[2.5,1.65,-.3],yaw:-Math.PI/2},
  reception:{position:[2.75,1.65,2.9],yaw:Math.PI},
}
document.querySelectorAll<HTMLElement>('[data-zone]').forEach(b=>b.addEventListener('click',()=>{ const z=b.dataset.zone as Zone;goTo(new THREE.Vector3(...stations[z].position),stations[z].yaw,z) }))
$('#reset-button').addEventListener('click',()=>goTo(new THREE.Vector3(1.25,1.65,4.1),.16,null))
$('#explore-button').addEventListener('click',()=>{dismissIntro();canvas.focus();toast('拖曳環視，使用 WASD 或方向鍵移動')})
$('#locate-art').addEventListener('click',()=>{
  const a=data.artworks[selected], angle=THREE.MathUtils.degToRad(a.rotation)
  const pos=new THREE.Vector3(...a.position).add(new THREE.Vector3(Math.sin(angle)*1.65,0,Math.cos(angle)*1.65));pos.y=1.65
  // Reception tabletop needs more clearance than a regular wall artwork.
  if(a.zone==='reception')pos.z=3.3
  artDialog.close();goTo(pos,angle,a.zone)
})
$('#fullscreen-button').addEventListener('click',async()=>{
  try {if(document.fullscreenElement)await document.exitFullscreen();else await $('#gallery').requestFullscreen()} catch {toast('此瀏覽器不支援全螢幕，仍可直接瀏覽展間。')}
})
$('#quality-button').addEventListener('click',()=>{
  highQuality=!highQuality;renderer?.setPixelRatio(Math.min(devicePixelRatio,highQuality?2:1.25))
  $('#quality-button').textContent=`畫質：${highQuality?'高':'標準'}`;$('#quality-button').setAttribute('aria-pressed',String(highQuality));resize()
})
window.addEventListener('keydown',e=>{
  if(artDialog.open&&(e.key==='ArrowLeft'||e.key==='ArrowRight')){e.preventDefault();stepArt(e.key==='ArrowLeft'?-1:1);return}
  if(modalOpen()||!sceneAvailable)return
  if(document.activeElement!==canvas)return
  if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)) {e.preventDefault();keys.add(e.code);transition=null;dismissIntro()}
})
window.addEventListener('keyup',e=>keys.delete(e.code))
window.addEventListener('blur',resetInput)
canvas.addEventListener('blur',()=>keys.clear())
document.addEventListener('visibilitychange',()=>{resetInput();clock.reset()})
const touchMap:Record<string,string>={forward:'KeyW',backward:'KeyS',left:'KeyA',right:'KeyD'}
document.querySelectorAll<HTMLElement>('[data-move]').forEach(b=>{
  b.addEventListener('pointerdown',e=>{e.preventDefault();if(!sceneAvailable||modalOpen())return;b.setPointerCapture(e.pointerId);keys.add(touchMap[b.dataset.move!]);transition=null;dismissIntro()})
  const clear=()=>keys.delete(touchMap[b.dataset.move!]);b.addEventListener('pointerup',clear);b.addEventListener('pointercancel',clear);b.addEventListener('lostpointercapture',clear)
})
let drag:{id:number;x:number;y:number;lastX:number;lastY:number;distance:number}|null=null
canvas.addEventListener('pointerdown',e=>{
  if(!sceneAvailable||modalOpen()||e.button!==0)return
  canvas.focus({preventScroll:true});canvas.setPointerCapture(e.pointerId)
  drag={id:e.pointerId,x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,distance:0};canvas.classList.add('dragging');transition=null
})
function hitAt(x:number,y:number):THREE.Mesh|null {
  const r=canvas.getBoundingClientRect();pointer.set((x-r.left)/r.width*2-1,-(y-r.top)/r.height*2+1);raycaster.setFromCamera(pointer,camera)
  // Intersect architecture too: a column or wall must occlude artwork picking.
  const first=raycaster.intersectObjects(scene.children,true).find(h=>h.object.userData.solid!==false)
  return first?.object.userData.artworkId?first.object as THREE.Mesh:null
}
canvas.addEventListener('pointermove',e=>{
  if(!sceneAvailable||modalOpen())return
  if(drag&&drag.id===e.pointerId){
    const dx=e.clientX-drag.lastX,dy=e.clientY-drag.lastY;drag.distance+=Math.abs(dx)+Math.abs(dy)
    yaw-=dx*.003;pitch=THREE.MathUtils.clamp(pitch-dy*.003,-1.0,.95);drag.lastX=e.clientX;drag.lastY=e.clientY
    if(drag.distance>6)dismissIntro();$('#hover-label').hidden=true
  }else if(e.pointerType==='mouse'){
    const hit=hitAt(e.clientX,e.clientY);canvas.style.cursor=hit?'pointer':'grab'
    const label=$('#hover-label');label.hidden=!hit
    if(hit){const a=data.artworks.find(a=>a.id===hit.userData.artworkId)!;label.textContent=`${a.id} — ${a.title} ↗`;const r=canvas.getBoundingClientRect();label.style.left=`${Math.min(e.clientX-r.left+16,r.width-210)}px`;label.style.top=`${Math.min(e.clientY-r.top+16,r.height-90)}px`}
  }
})
canvas.addEventListener('pointerup',e=>{
  if(!drag||drag.id!==e.pointerId)return
  const isClick=drag.distance<7;drag=null;canvas.classList.remove('dragging');canvas.releasePointerCapture(e.pointerId)
  if(isClick){const hit=hitAt(e.clientX,e.clientY);if(hit)openArt(hit.userData.artworkId)}
})
canvas.addEventListener('pointercancel',resetInput)
canvas.addEventListener('lostpointercapture',()=>{drag=null;canvas.classList.remove('dragging')})
canvas.addEventListener('pointerleave',()=>$('#hover-label').hidden=true)
function resize() {
  const {width,height}=canvas.getBoundingClientRect();camera.aspect=width/height;camera.updateProjectionMatrix();renderer?.setSize(width,height,false)
}
new ResizeObserver(resize).observe($('#gallery'))
function animate() {
  if(!renderer||document.hidden)return
  clock.update();const dt=Math.min(clock.getDelta(),.05)
  if(!modalOpen()){
    if(transition){const t=Math.min((performance.now()-transition.start)/550,1),s=t*t*(3-2*t);yaw=THREE.MathUtils.lerp(transition.fromYaw,transition.toYaw,s);pitch=THREE.MathUtils.lerp(transition.fromPitch,0,s);if(t===1)transition=null}
    const f=Number(keys.has('KeyW')||keys.has('ArrowUp'))-Number(keys.has('KeyS')||keys.has('ArrowDown'))
    const r=Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft'))
    if((f||r)&&sceneAvailable){const speed=dt*2/Math.hypot(f,r);const pos=movePosition(camera.position,(-Math.sin(yaw)*f+Math.cos(yaw)*r)*speed,(-Math.cos(yaw)*f-Math.sin(yaw)*r)*speed,data.bounds,data.colliders);camera.position.x=pos.x;camera.position.z=pos.z}
  }
  camera.rotation.set(pitch,yaw,0,'YXZ')
  const mx=8+(camera.position.x+5)*10.4,mz=8+(camera.position.z+6)*10.5
  $('#map-marker').setAttribute('transform',`translate(${mx} ${mz}) rotate(${-yaw*180/Math.PI})`)
  renderer.render(scene,camera)
}
function addLighting() {
  scene.add(new THREE.HemisphereLight('#fff4df','#817969',2.3))
  scene.add(new THREE.AmbientLight('#fff6e9',.45))
  const key=new THREE.DirectionalLight('#fff3dc',2.1);key.position.set(-3,7,4);scene.add(key)
  // Fixtures are modelled in Blender. Light pools are inexpensive, non-shadowed lights.
  const spots=[[-3.8,2.7,-4.2,-4.8,1.4,-4.2],[-3.8,2.7,0,-4.8,1.4,0],[-3.8,2.7,3.6,-4.8,1.4,3.6],[3.8,2.7,-4.2,4.8,1.4,-4.2],[3.8,2.7,0,4.8,1.4,0],[-3,2.7,-4.8,-3,1.3,-5.9],[0,2.7,-4.8,0,1.3,-5.9],[3,2.7,-4.8,3,1.3,-5.9]]
  spots.forEach(p=>{const light=new THREE.SpotLight('#fff2d8',14,6,.86,.82,2);light.position.set(p[0],p[1],p[2]);light.target.position.set(p[3],p[4],p[5]);scene.add(light,light.target)})
  // Soft contact shading under the columns, baked-style without real-time shadow maps.
  const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d')!;const g=ctx.createRadialGradient(64,64,5,64,64,64);g.addColorStop(0,'rgba(20,16,10,.42)');g.addColorStop(1,'rgba(20,16,10,0)');ctx.fillStyle=g;ctx.fillRect(0,0,128,128)
  const shadowMat=new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c),transparent:true,depthWrite:false})
  data.colliders.forEach(o=>{const m=new THREE.Mesh(new THREE.PlaneGeometry(o.width+1.2,o.depth+1.2),shadowMat);m.rotation.x=-Math.PI/2;m.position.set(o.x,.005,o.z);m.userData.solid=false;scene.add(m)})
}
function failScene(error:unknown) {
  console.error(error);sceneAvailable=false;renderer?.setAnimationLoop(null)
  $('#loading-text').textContent='3D 空間暫時無法開啟，仍可瀏覽作品目錄。'
  $<HTMLProgressElement>('#load-progress').hidden=true
  if(!$('#retry-scene')){const b=document.createElement('button');b.id='retry-scene';b.className='primary-button';b.style.width='180px';b.style.marginTop='20px';b.textContent='重新載入展間';b.onclick=()=>location.reload();$('#loading').append(b)}
  $('#loading').classList.remove('done')
}
async function init() {
  try {
    const response=await fetch(base+'gallery.json');if(!response.ok)throw new Error(`Gallery data: ${response.status}`)
    data=await response.json();buildCatalog();ready=true
    renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'})
    renderer.setPixelRatio(Math.min(devicePixelRatio,1.25));renderer.outputColorSpace=THREE.SRGBColorSpace
    renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05
    camera.position.set(1.25,1.65,4.1);addLighting();resize()
    const loader=new GLTFLoader()
    const gltf=await loader.loadAsync(base+'models/gallery.glb',p=>{if(p.total)$<HTMLProgressElement>('#load-progress').value=p.loaded/p.total*75})
    const textureLoader=new THREE.TextureLoader()
    const images=await Promise.all(data.artworks.map(async a=>{
      const t=await textureLoader.loadAsync(base+a.image);t.colorSpace=THREE.SRGBColorSpace;t.flipY=false;t.anisotropy=Math.min(4,renderer!.capabilities.getMaxAnisotropy());return [a.id,t] as const
    }))
    const textures=new Map(images)
    gltf.scene.traverse(o=>{
      if(!(o instanceof THREE.Mesh))return
      if(o.userData.artworkId){const id=o.userData.artworkId;o.material=new THREE.MeshBasicMaterial({map:textures.get(id)});artworks.set(id,o)}
    })
    scene.add(gltf.scene);sceneAvailable=true
    $<HTMLProgressElement>('#load-progress').value=100
    await renderer.compileAsync(scene,camera)
    renderer.setAnimationLoop(animate);$('#loading').classList.add('done')
    canvas.dataset.loaded='true'
    // Minimal diagnostics useful for model/interaction verification, no personal data.
    if(import.meta.env.DEV)Object.assign(window,{galleryDebug:{scene,camera,renderer,artworks,get state(){return {ready,sceneAvailable,yaw,pitch,activeZone}}}})
  } catch(error){failScene(error)}
}
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();resetInput();failScene(new Error('WebGL context lost'))})
init()
