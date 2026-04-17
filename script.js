"use strict";

/* =========================================
   NERO — 湾岸レーサー（FULL BUILD）
   Part 1 : 基盤 + 環境 + 車 + 入力
========================================= */

// ===== シーン =====
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x020408, 0.012);

const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.1, 1000);

const renderer = new THREE.WebGLRenderer({ antialias:true });
renderer.setSize(innerWidth, innerHeight);
renderer.setClearColor(0x000000);
document.body.appendChild(renderer.domElement);

// ===== リサイズ =====
window.addEventListener("resize", ()=>{
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
});

// ===== ライト =====
scene.add(new THREE.AmbientLight(0x404040,1.5));

const light = new THREE.PointLight(0xffcc88,2,100);
light.position.set(0,10,0);
scene.add(light);

// ===== 道路（湾岸風）=====
const roadGroup = new THREE.Group();
scene.add(roadGroup);

const ROAD_WIDTH = 20;
const TILE_LENGTH = 60;
const TILES = 20;

const roadMat = new THREE.MeshStandardMaterial({
  color:0x111111,
  roughness:0.4
});

for(let i=0;i<TILES;i++){
  const tile = new THREE.Mesh(
    new THREE.PlaneGeometry(ROAD_WIDTH, TILE_LENGTH),
    roadMat
  );
  tile.rotation.x = -Math.PI/2;
  tile.position.z = i * TILE_LENGTH;
  roadGroup.add(tile);
}

// ===== 車（簡易 → 後で本格に統合）=====
const car = new THREE.Group();
scene.add(car);

const body = new THREE.Mesh(
  new THREE.BoxGeometry(2,1,4),
  new THREE.MeshStandardMaterial({color:0x111111})
);
car.add(body);

// ===== カメラ位置 =====
camera.position.set(0,5,-10);

// ===== 入力 =====
const keys = {};
window.addEventListener("keydown", e=>{
  keys[e.code] = true;
});
window.addEventListener("keyup", e=>{
  keys[e.code] = false;
});

// ===== WASD固定 =====
function getInput(){
  return {
    fwd: keys["KeyW"],
    rev: keys["KeyS"],
    left: keys["KeyA"],
    right: keys["KeyD"],
    hb: keys["Space"]
  };
}

// ===== 仮ステータス =====
let speed = 0;
let yaw = 0;

// ===== ループ =====
function loop(){

  const inp = getInput();

  // 仮移動（Part2で置き換え）
  if(inp.fwd) speed += 0.1;
  if(inp.rev) speed -= 0.1;

  if(inp.left) yaw += 0.02;
  if(inp.right) yaw -= 0.02;

  speed *= 0.98;

  car.position.x += Math.sin(yaw) * speed;
  car.position.z += Math.cos(yaw) * speed;
  car.rotation.y = yaw;

  // カメラ追従
  camera.position.x = car.position.x;
  camera.position.z = car.position.z - 10;
  camera.lookAt(car.position);

  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}

loop();
/* =========================================
   Part 2 : 物理 + トランスミッション
========================================= */

// ===== トランスミッション =====
const transmission = {
  mode: "AT", // AT or MT
  gear: 0,
  maxGear: 6,
  gearRatio: [0, 3.2, 2.2, 1.6, 1.3, 1.1, 0.9]
};

// UI用
window.setAT = () => transmission.mode = "AT";
window.setMT = () => transmission.mode = "MT";

// ギアボタン生成
const gearContainer = document.getElementById("gear-buttons");
for(let i=1;i<=6;i++){
  const btn = document.createElement("button");
  btn.innerText = i;
  btn.onclick = ()=>{
    if(transmission.mode === "MT"){
      transmission.gear = i;
    }
  };
  gearContainer.appendChild(btn);
}

// ===== 定数 =====
const MAX_SPEED = 89; // 約320km/h
const ACCEL = 0.4;
const BRAKE = 0.6;
const FRICTION = 0.985;
const STEER_POWER = 0.04;

// ===== 物理ステート =====
let velocity = 0;

// ===== メイン更新（上書きする）=====
function updatePhysics(){

  const inp = getInput();

  // ===== ギア倍率 =====
  let ratio = 1;

  if(transmission.mode === "MT"){
    ratio = transmission.gearRatio[transmission.gear] || 0;
  } else {
    const s = Math.abs(velocity);

    if(s < 10) transmission.gear = 1;
    else if(s < 25) transmission.gear = 2;
    else if(s < 45) transmission.gear = 3;
    else if(s < 65) transmission.gear = 4;
    else if(s < 80) transmission.gear = 5;
    else transmission.gear = 6;

    ratio = transmission.gearRatio[transmission.gear];
  }

  // ===== 加速 =====
  if(inp.fwd) velocity += ACCEL * ratio;
  if(inp.rev) velocity -= BRAKE;

  // ハンドブレーキ
  if(inp.hb) velocity *= 0.95;

  // 減衰
  velocity *= FRICTION;

  // 制限
  velocity = Math.max(-20, Math.min(MAX_SPEED, velocity));

  // ===== ステア =====
  let steer = 0;
  if(inp.left) steer += STEER_POWER;
  if(inp.right) steer -= STEER_POWER;

  yaw += steer * (velocity / 20);

  // ===== 移動 =====
  car.position.x += Math.sin(yaw) * velocity * 0.05;
  car.position.z += Math.cos(yaw) * velocity * 0.05;
  car.rotation.y = yaw;

  // ===== UI =====
  document.getElementById("speed").innerText = Math.floor(Math.abs(velocity)*3.6);
  document.getElementById("gear").innerText =
    transmission.mode === "AT"
      ? "D" + transmission.gear
      : transmission.gear || "N";
}

// ===== loopを書き換え =====
function loop(){

  updatePhysics();

  // カメラ
  camera.position.x = car.position.x;
  camera.position.z = car.position.z - 10;
  camera.lookAt(car.position);

  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}
/* =========================================
   Part 3 : 湾岸化 + 敵車 + ループ + ゲーム化
========================================= */

// ===== 湾岸カーブ =====
function applyWanganCurve(){
  const curve = Math.sin(car.position.z * 0.002) * 25;

  roadGroup.children.forEach((tile,i)=>{
    tile.position.x = curve;
    tile.rotation.y = curve * 0.01;
  });
}

// ===== 道路ループ =====
function updateRoad(){

  roadGroup.children.forEach(tile=>{
    if(tile.position.z + TILE_LENGTH < car.position.z - 100){
      tile.position.z += TILE_LENGTH * roadGroup.children.length;
    }
  });

}

// ===== 敵車 =====
const enemies = [];

function spawnEnemy(zOffset){
  const enemy = new THREE.Mesh(
    new THREE.BoxGeometry(2,1,4),
    new THREE.MeshStandardMaterial({color:0xff2222})
  );

  enemy.position.set(
    (Math.random()-0.5)*10,
    0,
    car.position.z + zOffset
  );

  scene.add(enemy);
  enemies.push(enemy);
}

// 初期スポーン
for(let i=0;i<10;i++){
  spawnEnemy(i*80 + 100);
}

// ===== 敵更新 =====
function updateEnemies(){

  enemies.forEach(enemy=>{
    enemy.position.z -= velocity * 0.5;

    // 追い越したら前に再配置
    if(enemy.position.z < car.position.z - 50){
      enemy.position.z = car.position.z + 300;
      enemy.position.x = (Math.random()-0.5)*10;
    }

    // 当たり判定（簡易）
    const dx = enemy.position.x - car.position.x;
    const dz = enemy.position.z - car.position.z;

    if(Math.abs(dx) < 2 && Math.abs(dz) < 4){
      velocity *= 0.7;
    }
  });

}

// ===== スコア =====
let score = 0;
let time = 0;

function updateGame(){

  score += Math.floor(Math.abs(velocity));
  time += 1/60;

  document.getElementById("score").innerText = score;
  document.getElementById("time").innerText = time.toFixed(1);
}

// ===== loop 完全版 =====
function loop(){

  updatePhysics();
  applyWanganCurve();
  updateRoad();
  updateEnemies();
  updateGame();

  // カメラ（湾岸風）
  camera.position.x = car.position.x;
  camera.position.z = car.position.z - 12;
  camera.position.y = 5;
  camera.lookAt(car.position);

  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}

// 再スタート
loop();
/* =========================================
   Part 4 : 首都高ビジュアル強化
   ネオン / ガードレール / ビル
========================================= */

// ===== マテリアル =====
const neonBlue = new THREE.MeshBasicMaterial({ color: 0x00ccff });
const neonYellow = new THREE.MeshBasicMaterial({ color: 0xffcc00 });
const guardMat = new THREE.MeshStandardMaterial({ color: 0x888888 });
const buildingMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a });

// ===== ガードレール =====
const guardRails = [];

function createGuardRail(z){
  const geo = new THREE.BoxGeometry(0.5,1,60);

  const left = new THREE.Mesh(geo, guardMat);
  const right = new THREE.Mesh(geo, guardMat);

  left.position.set(-ROAD_WIDTH/2 - 1, 0.5, z);
  right.position.set(ROAD_WIDTH/2 + 1, 0.5, z);

  scene.add(left, right);
  guardRails.push(left, right);
}

// 初期生成
for(let i=0;i<20;i++){
  createGuardRail(i * TILE_LENGTH);
}

// ===== ネオンライン =====
const neonLines = [];

function createNeon(z){
  const geo = new THREE.BoxGeometry(0.2,0.1,60);
  const neon = new THREE.Mesh(geo, neonBlue);

  neon.position.set(0, 0.05, z);
  scene.add(neon);
  neonLines.push(neon);
}

for(let i=0;i<20;i++){
  createNeon(i * TILE_LENGTH);
}

// ===== ビル =====
const buildings = [];

function createBuilding(z){
  const h = Math.random()*20 + 10;

  const geo = new THREE.BoxGeometry(10,h,10);
  const b = new THREE.Mesh(geo, buildingMat);

  b.position.set(
    (Math.random() > 0.5 ? -1 : 1) * (ROAD_WIDTH + 15 + Math.random()*20),
    h/2,
    z
  );

  scene.add(b);
  buildings.push(b);
}

// 初期生成
for(let i=0;i<30;i++){
  createBuilding(i * 40);
}

// ===== 夜っぽい環境光 =====
scene.background = new THREE.Color(0x01030a);

// ===== ライト追加 =====
const streetLights = [];

function createStreetLight(z){
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1,0.1,5),
    guardMat
  );

  const lamp = new THREE.PointLight(0xffddaa,1,20);

  pole.position.set(-ROAD_WIDTH/2 - 2, 2.5, z);
  lamp.position.set(-ROAD_WIDTH/2 - 2, 5, z);

  scene.add(pole);
  scene.add(lamp);

  streetLights.push(pole, lamp);
}

for(let i=0;i<15;i++){
  createStreetLight(i * 80);
}

// ===== 更新 =====
function updateEnvironment(){

  const baseZ = car.position.z;

  // ガードレール
  guardRails.forEach(obj=>{
    if(obj.position.z < baseZ - 100){
      obj.position.z += 1200;
    }
  });

  // ネオン
  neonLines.forEach(obj=>{
    if(obj.position.z < baseZ - 100){
      obj.position.z += 1200;
    }
  });

  // ビル
  buildings.forEach(obj=>{
    if(obj.position.z < baseZ - 100){
      obj.position.z += 1200;
      obj.position.x = (Math.random()>0.5?-1:1)*(ROAD_WIDTH+15+Math.random()*20);
    }
  });

  // 街灯
  streetLights.forEach(obj=>{
    if(obj.position.z && obj.position.z < baseZ - 100){
      obj.position.z += 1200;
    }
  });
}

// ===== loopに追加 =====
const oldLoop = loop;

function loop(){
  updatePhysics();
  applyWanganCurve();
  updateRoad();
  updateEnemies();
  updateGame();
  updateEnvironment();

  camera.position.x = car.position.x;
  camera.position.z = car.position.z - 12;
  camera.position.y = 5;
  camera.lookAt(car.position);

  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}
/* =========================================
   Part 5 : エフェクト + ブースト + 臨場感
========================================= */

// ===== ブースト =====
let boost = 100;
let boosting = false;

window.addEventListener("keydown", e=>{
  if(e.code === "ShiftLeft"){
    boosting = true;
  }
});

window.addEventListener("keyup", e=>{
  if(e.code === "ShiftLeft"){
    boosting = false;
  }
});

// ===== スピードエフェクト =====
const speedLines = [];

function createSpeedLine(){
  const geo = new THREE.BoxGeometry(0.05,0.05,5);
  const mat = new THREE.MeshBasicMaterial({color:0xffffff});
  const line = new THREE.Mesh(geo, mat);

  scene.add(line);
  speedLines.push(line);
}

for(let i=0;i<50;i++){
  createSpeedLine();
}

// ===== カメラシェイク =====
function cameraShake(intensity){
  camera.position.x += (Math.random()-0.5)*intensity;
  camera.position.y += (Math.random()-0.5)*intensity;
}

// ===== エフェクト更新 =====
function updateEffects(){

  // ===== ブースト処理 =====
  if(boosting && boost > 0){
    velocity += 1.5;
    boost -= 0.5;
    cameraShake(0.2);
  } else {
    boost += 0.2;
  }

  boost = Math.max(0, Math.min(100, boost));

  // ===== スピードライン =====
  speedLines.forEach(line=>{
    line.position.set(
      car.position.x + (Math.random()-0.5)*5,
      car.position.y + Math.random()*2,
      car.position.z + Math.random()*20
    );

    if(Math.abs(velocity) > 40){
      line.visible = true;
    } else {
      line.visible = false;
    }
  });

  // ===== 視野角変化 =====
  const baseFov = 70;
  camera.fov = baseFov + Math.abs(velocity) * 0.3;
  camera.updateProjectionMatrix();

}

// ===== HUD追加 =====
const boostUI = document.createElement("div");
boostUI.style.position = "fixed";
boostUI.style.bottom = "100px";
boostUI.style.right = "20px";
boostUI.style.color = "cyan";
boostUI.innerText = "BOOST: 100";
document.body.appendChild(boostUI);

// ===== loop拡張 =====
const oldLoop2 = loop;

function loop(){

  updatePhysics();
  applyWanganCurve();
  updateRoad();
  updateEnemies();
  updateGame();
  updateEnvironment();
  updateEffects();

  boostUI.innerText = "BOOST: " + Math.floor(boost);

  camera.position.x = car.position.x;
  camera.position.z = car.position.z - 12;
  camera.position.y = 5;

  camera.lookAt(car.position);

  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}
/* =========================================
   Part 6 : サウンド + クラッシュ + 火花
========================================= */

// ===== サウンド =====
let engineSound, crashSound;

const listener = new THREE.AudioListener();
camera.add(listener);

const audioLoader = new THREE.AudioLoader();

// エンジン音（フリー素材想定）
engineSound = new THREE.Audio(listener);
audioLoader.load(
  'https://cdn.jsdelivr.net/gh/matthewmain/sfx/engine.wav',
  buffer => {
    engineSound.setBuffer(buffer);
    engineSound.setLoop(true);
    engineSound.setVolume(0.3);
    engineSound.play();
  }
);

// クラッシュ音
crashSound = new THREE.Audio(listener);
audioLoader.load(
  'https://cdn.jsdelivr.net/gh/matthewmain/sfx/crash.wav',
  buffer => {
    crashSound.setBuffer(buffer);
    crashSound.setVolume(0.5);
  }
);

// ===== エンジン音更新 =====
function updateSound(){
  if(engineSound){
    engineSound.setPlaybackRate(0.5 + Math.abs(velocity)/50);
    engineSound.setVolume(0.2 + Math.abs(velocity)/200);
  }
}

// ===== 火花エフェクト =====
const sparks = [];

function createSpark(){
  const geo = new THREE.SphereGeometry(0.05);
  const mat = new THREE.MeshBasicMaterial({color:0xffaa00});
  const s = new THREE.Mesh(geo, mat);

  s.visible = false;
  scene.add(s);
  sparks.push(s);
}

for(let i=0;i<30;i++){
  createSpark();
}

// ===== 衝突エフェクト =====
function triggerCrash(){

  if(crashSound && crashSound.buffer){
    crashSound.play();
  }

  for(let i=0;i<10;i++){
    const s = sparks[i];
    s.visible = true;

    s.position.copy(car.position);

    s.userData.vx = (Math.random()-0.5)*2;
    s.userData.vy = Math.random()*2;
    s.userData.vz = (Math.random()-0.5)*2;
  }

  cameraShake(1.0);
}

// ===== 火花更新 =====
function updateSparks(){
  sparks.forEach(s=>{
    if(!s.visible) return;

    s.position.x += s.userData.vx;
    s.position.y += s.userData.vy;
    s.position.z += s.userData.vz;

    s.userData.vy -= 0.05;

    if(s.position.y < 0){
      s.visible = false;
    }
  });
}

// ===== 衝突判定強化 =====
function checkCollisions(){

  enemies.forEach(enemy=>{
    const dx = enemy.position.x - car.position.x;
    const dz = enemy.position.z - car.position.z;

    if(Math.abs(dx) < 2 && Math.abs(dz) < 4){
      velocity *= 0.5;
      triggerCrash();
    }
  });

}

// ===== loop拡張 =====
const oldLoop3 = loop;

function loop(){

  updatePhysics();
  applyWanganCurve();
  updateRoad();
  updateEnemies();
  updateGame();
  updateEnvironment();
  updateEffects();
  updateSound();
  updateSparks();
  checkCollisions();

  camera.position.x = car.position.x;
  camera.position.z = car.position.z - 12;
  camera.position.y = 5;

  camera.lookAt(car.position);

  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}
/* =========================================
   Part 7 : GLTF車 + ブルーム（神グラ）
========================================= */

// ===== GLTF 車 =====
let carModel;

const loader = new THREE.GLTFLoader();

// フリーのスポーツカー（差し替えOK）
loader.load(
  "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Supercar/glTF/Supercar.gltf",
  gltf => {

    carModel = gltf.scene;

    carModel.scale.set(1.5,1.5,1.5);
    carModel.position.set(0,0,0);

    scene.remove(car); // 元の箱削除
    scene.add(carModel);

  }
);

// ===== ブルーム =====
const composer = new THREE.EffectComposer(renderer);

const renderPass = new THREE.RenderPass(scene, camera);
composer.addPass(renderPass);

const bloomPass = new THREE.UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  1.2, // 強さ
  0.4,
  0.85
);

composer.addPass(bloomPass);

// ===== 車参照統一 =====
function getCarObject(){
  return carModel || car;
}

// ===== loop上書き =====
const oldLoop4 = loop;

function loop(){

  updatePhysics();
  applyWanganCurve();
  updateRoad();
  updateEnemies();
  updateGame();
  updateEnvironment();
  updateEffects();
  updateSound();
  updateSparks();
  checkCollisions();

  const activeCar = getCarObject();

  // カメラ
  camera.position.x = activeCar.position.x;
  camera.position.z = activeCar.position.z - 12;
  camera.position.y = 5;

  camera.lookAt(activeCar.position);

  // ブルーム描画
  composer.render();

  requestAnimationFrame(loop);
}
