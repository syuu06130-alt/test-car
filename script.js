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
/* =========================================
   Part 8 : 分岐 + AIバトル（最終進化）
========================================= */

// ===== 分岐システム =====
let currentLane = 0; // -1 左 / 0 中央 / 1 右
const LANE_WIDTH = 6;

// レーン変更
window.addEventListener("keydown", e=>{
  if(e.code === "ArrowLeft"){
    currentLane = Math.max(-1, currentLane - 1);
  }
  if(e.code === "ArrowRight"){
    currentLane = Math.min(1, currentLane + 1);
  }
});

// 車をレーンに吸着
function applyLane(){
  const targetX = currentLane * LANE_WIDTH;
  car.position.x += (targetX - car.position.x) * 0.1;
}

// ===== 分岐ビジュアル =====
function createLaneMarks(){
  const geo = new THREE.BoxGeometry(0.2,0.05,20);

  for(let i=-1;i<=1;i++){
    if(i===0) continue;

    const line = new THREE.Mesh(geo, neonYellow);
    line.position.set(i * LANE_WIDTH / 2, 0.05, car.position.z + 50);

    scene.add(line);
  }
}

// ===== AIライバル =====
const rivals = [];

function spawnRival(zOffset){
  const r = new THREE.Mesh(
    new THREE.BoxGeometry(2,1,4),
    new THREE.MeshStandardMaterial({color:0x00ffcc})
  );

  r.position.set(
    (Math.floor(Math.random()*3)-1)*LANE_WIDTH,
    0,
    car.position.z + zOffset
  );

  r.userData.speed = 60 + Math.random()*30;

  scene.add(r);
  rivals.push(r);
}

// 初期
for(let i=0;i<5;i++){
  spawnRival(i*120 + 200);
}

// ===== AI更新 =====
function updateRivals(){

  rivals.forEach(r=>{

    // プレイヤー追尾
    if(r.position.z > car.position.z){
      r.position.z -= velocity * 0.6;
    } else {
      r.position.z += r.userData.speed * 0.05;
    }

    // ランダムレーン変更
    if(Math.random() < 0.01){
      r.position.x = (Math.floor(Math.random()*3)-1)*LANE_WIDTH;
    }

    // 再配置
    if(r.position.z < car.position.z - 100){
      r.position.z = car.position.z + 400;
    }

    // 衝突
    const dx = r.position.x - car.position.x;
    const dz = r.position.z - car.position.z;

    if(Math.abs(dx) < 2 && Math.abs(dz) < 4){
      velocity *= 0.6;
      triggerCrash();
    }

  });

}

// ===== バトルスコア =====
let overtake = 0;

function checkOvertake(){
  rivals.forEach(r=>{
    if(r.position.z < car.position.z && !r.userData.passed){
      r.userData.passed = true;
      overtake++;
      score += 500;
    }
  });
}

// ===== HUD強化 =====
const battleUI = document.createElement("div");
battleUI.style.position = "fixed";
battleUI.style.top = "50px";
battleUI.style.right = "20px";
battleUI.style.color = "orange";
battleUI.innerText = "OVERTAKE: 0";
document.body.appendChild(battleUI);

// ===== loop最終版 =====
const oldLoop5 = loop;

function loop(){

  updatePhysics();
  applyLane();          // ←追加（重要）
  applyWanganCurve();
  updateRoad();
  updateEnemies();
  updateRivals();       // ←AI
  checkOvertake();      // ←追い越し
  updateGame();
  updateEnvironment();
  updateEffects();
  updateSound();
  updateSparks();
  checkCollisions();

  const activeCar = carModel || car;

  camera.position.x = activeCar.position.x;
  camera.position.z = activeCar.position.z - 12;
  camera.position.y = 5;

  camera.lookAt(activeCar.position);

  battleUI.innerText = "OVERTAKE: " + overtake;

  composer.render();

  requestAnimationFrame(loop);
}
/* =========================================
   Part 9 : 最終強化（ブラー + HUD + 安定化）
========================================= */

// ===== 疑似モーションブラー =====
const blurPlaneGeo = new THREE.PlaneGeometry(2,2);
const blurMat = new THREE.MeshBasicMaterial({
  color: 0x000000,
  transparent: true,
  opacity: 0.0
});

const blurPlane = new THREE.Mesh(blurPlaneGeo, blurMat);
blurPlane.position.z = -1;
camera.add(blurPlane);
scene.add(camera);

// ===== HUD強化 =====
const hudExtra = document.createElement("div");
hudExtra.style.position = "fixed";
hudExtra.style.bottom = "140px";
hudExtra.style.right = "20px";
hudExtra.style.color = "#00ffff";
hudExtra.innerHTML = "MODE: AT<br>GEAR: 0";
document.body.appendChild(hudExtra);

// ===== 安定化パラメータ =====
let delta = 0;
let lastTime = performance.now();

// ===== 更新 =====
function updatePro(){

  // Δ時間
  const now = performance.now();
  delta = (now - lastTime) / 16.666;
  lastTime = now;

  // ===== ブラー強度 =====
  blurMat.opacity = Math.min(0.4, Math.abs(velocity)/120);

  // ===== HUD =====
  hudExtra.innerHTML =
    "MODE: " + transmission.mode +
    "<br>GEAR: " + transmission.gear;

}

// ===== loop最終最終 =====
const oldLoop6 = loop;

function loop(){

  updatePro();

  updatePhysics();
  applyLane();
  applyWanganCurve();
  updateRoad();
  updateEnemies();
  updateRivals();
  checkOvertake();
  updateGame();
  updateEnvironment();
  updateEffects();
  updateSound();
  updateSparks();
  checkCollisions();

  const activeCar = carModel || car;

  // カメラ（少し滑らかに）
  camera.position.x += (activeCar.position.x - camera.position.x) * 0.15;
  camera.position.z += (activeCar.position.z - 12 - camera.position.z) * 0.15;
  camera.position.y += (5 - camera.position.y) * 0.1;

  camera.lookAt(activeCar.position);

  composer.render();

  requestAnimationFrame(loop);
}
/* =========================================
   Part 10 : セーブ + ランキング + 完成化
========================================= */

// ===== ローカルランキング =====
let bestScore = localStorage.getItem("nero_best") || 0;

// UI
const rankUI = document.createElement("div");
rankUI.style.position = "fixed";
rankUI.style.top = "10px";
rankUI.style.left = "50%";
rankUI.style.transform = "translateX(-50%)";
rankUI.style.color = "gold";
rankUI.style.fontSize = "14px";
document.body.appendChild(rankUI);

// ===== セーブ処理 =====
function saveScore(){
  if(score > bestScore){
    bestScore = score;
    localStorage.setItem("nero_best", bestScore);
  }
}

// ===== リセット =====
function resetGame(){
  score = 0;
  overtake = 0;
  velocity = 0;

  car.position.set(0,0,0);
}

// ===== ゲームオーバー条件 =====
let health = 100;

function updateHealth(){
  // 衝突で減る（既存処理と連動）
  if(Math.abs(velocity) < 5){
    health -= 0.05;
  }

  health = Math.max(0, health);

  if(health <= 0){
    saveScore();
    alert("GAME OVER\nSCORE: " + score);
    resetGame();
    health = 100;
  }
}

// ===== HUD =====
const healthUI = document.createElement("div");
healthUI.style.position = "fixed";
healthUI.style.bottom = "60px";
healthUI.style.left = "20px";
healthUI.style.color = "red";
document.body.appendChild(healthUI);

// ===== 追加更新 =====
function updateFinal(){

  updateHealth();

  rankUI.innerText = "BEST: " + bestScore;
  healthUI.innerText = "HP: " + Math.floor(health);

}

// ===== loop完全最終 =====
const oldLoop7 = loop;

function loop(){

  updatePro();
  updateFinal();

  updatePhysics();
  applyLane();
  applyWanganCurve();
  updateRoad();
  updateEnemies();
  updateRivals();
  checkOvertake();
  updateGame();
  updateEnvironment();
  updateEffects();
  updateSound();
  updateSparks();
  checkCollisions();

  const activeCar = carModel || car;

  camera.position.x += (activeCar.position.x - camera.position.x) * 0.15;
  camera.position.z += (activeCar.position.z - 12 - camera.position.z) * 0.15;
  camera.position.y += (5 - camera.position.y) * 0.1;

  camera.lookAt(activeCar.position);

  composer.render();

  requestAnimationFrame(loop);
}
/* =========================================
   Part 11 : 車カスタム（色・性能）
========================================= */

// ===== カスタム状態 =====
const tuning = {
  color: "#ffffff",
  engine: 1.0,   // 加速倍率
  grip: 1.0,     // ハンドリング
  boostPower: 1.0
};

// ===== UI =====
const customUI = document.createElement("div");
customUI.style.position = "fixed";
customUI.style.left = "20px";
customUI.style.top = "120px";
customUI.style.background = "rgba(0,0,0,0.6)";
customUI.style.padding = "10px";
customUI.style.color = "white";
customUI.innerHTML = `
<b>CAR TUNING</b><br>
Color <input type="color" id="carColor"><br>
Engine <input type="range" id="engine" min="0.5" max="2" step="0.1"><br>
Grip <input type="range" id="grip" min="0.5" max="2" step="0.1"><br>
Boost <input type="range" id="boostP" min="0.5" max="2" step="0.1"><br>
`;
document.body.appendChild(customUI);

// ===== UI取得 =====
const colorInput = document.getElementById("carColor");
const engineInput = document.getElementById("engine");
const gripInput = document.getElementById("grip");
const boostInput = document.getElementById("boostP");

// 初期値
colorInput.value = tuning.color;
engineInput.value = tuning.engine;
gripInput.value = tuning.grip;
boostInput.value = tuning.boostPower;

// ===== カスタム適用 =====
function applyTuning(){

  tuning.color = colorInput.value;
  tuning.engine = parseFloat(engineInput.value);
  tuning.grip = parseFloat(gripInput.value);
  tuning.boostPower = parseFloat(boostInput.value);

  const targetCar = carModel || car;

  targetCar.traverse?.(obj=>{
    if(obj.isMesh){
      obj.material.color.set(tuning.color);
    }
  });

}

// ===== 物理へ反映 =====
const oldPhysics = updatePhysics;

function updatePhysics(){

  const inp = getInput();

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

  // エンジン強化
  if(inp.fwd) velocity += ACCEL * ratio * tuning.engine;

  if(inp.rev) velocity -= BRAKE;

  if(inp.hb) velocity *= 0.95;

  velocity *= FRICTION;

  velocity = Math.max(-20, Math.min(MAX_SPEED, velocity));

  // グリップ反映
  let steer = 0;
  if(inp.left) steer += STEER_POWER * tuning.grip;
  if(inp.right) steer -= STEER_POWER * tuning.grip;

  yaw += steer * (velocity / 20);

  car.position.x += Math.sin(yaw) * velocity * 0.05;
  car.position.z += Math.cos(yaw) * velocity * 0.05;
  car.rotation.y = yaw;

  document.getElementById("speed").innerText =
    Math.floor(Math.abs(velocity)*3.6);

  document.getElementById("gear").innerText =
    transmission.mode === "AT"
      ? "D" + transmission.gear
      : transmission.gear || "N";
}

// ===== ブースト強化反映 =====
const oldEffects = updateEffects;

function updateEffects(){

  if(boosting && boost > 0){
    velocity += 1.5 * tuning.boostPower;
    boost -= 0.5;
    cameraShake(0.2);
  } else {
    boost += 0.2;
  }

  boost = Math.max(0, Math.min(100, boost));

  speedLines.forEach(line=>{
    line.position.set(
      car.position.x + (Math.random()-0.5)*5,
      car.position.y + Math.random()*2,
      car.position.z + Math.random()*20
    );

    line.visible = Math.abs(velocity) > 40;
  });

  const baseFov = 70;
  camera.fov = baseFov + Math.abs(velocity) * 0.3;
  camera.updateProjectionMatrix();
}

// ===== 保存 =====
function saveTuning(){
  localStorage.setItem("nero_tuning", JSON.stringify(tuning));
}

// ===== 読み込み =====
function loadTuning(){
  const data = localStorage.getItem("nero_tuning");
  if(!data) return;

  const t = JSON.parse(data);
  Object.assign(tuning, t);

  colorInput.value = tuning.color;
  engineInput.value = tuning.engine;
  gripInput.value = tuning.grip;
  boostInput.value = tuning.boostPower;
}

// 初期ロード
loadTuning();

// 定期保存
setInterval(()=>{
  applyTuning();
  saveTuning();
}, 500);
/* =========================================
   Part 12 : 擬似オンライン対戦（ローカル共有）
========================================= */

// ===== 他プレイヤー =====
const ghostPlayers = [];

// ===== ゴースト生成 =====
function createGhost(){
  const g = new THREE.Mesh(
    new THREE.BoxGeometry(2,1,4),
    new THREE.MeshStandardMaterial({color:0x00ffff})
  );

  scene.add(g);
  ghostPlayers.push(g);
  return g;
}

// 1体生成
const ghost = createGhost();

// ===== データ送信（localStorage共有）=====
function sendData(){

  const data = {
    x: car.position.x,
    z: car.position.z,
    yaw: yaw,
    time: Date.now()
  };

  localStorage.setItem("nero_online", JSON.stringify(data));
}

// ===== データ受信 =====
function receiveData(){

  const raw = localStorage.getItem("nero_online");
  if(!raw) return;

  const data = JSON.parse(raw);

  // 自分との差が小さければ無視
  if(Math.abs(data.x - car.position.x) < 0.1 &&
     Math.abs(data.z - car.position.z) < 0.1) return;

  ghost.position.x += (data.x - ghost.position.x) * 0.2;
  ghost.position.z += (data.z - ghost.position.z) * 0.2;
  ghost.rotation.y = data.yaw;

}

// ===== UI =====
const onlineUI = document.createElement("div");
onlineUI.style.position = "fixed";
onlineUI.style.top = "80px";
onlineUI.style.left = "50%";
onlineUI.style.transform = "translateX(-50%)";
onlineUI.style.color = "#00ffff";
onlineUI.innerText = "ONLINE: OFF";
document.body.appendChild(onlineUI);

// ===== ON/OFF =====
let onlineMode = false;

window.addEventListener("keydown", e=>{
  if(e.code === "KeyO"){
    onlineMode = !onlineMode;
    onlineUI.innerText = "ONLINE: " + (onlineMode ? "ON" : "OFF");
  }
});

// ===== loop拡張 =====
const oldLoop8 = loop;

function loop(){

  updatePro();
  updateFinal();

  updatePhysics();
  applyLane();
  applyWanganCurve();
  updateRoad();
  updateEnemies();
  updateRivals();
  checkOvertake();
  updateGame();
  updateEnvironment();
  updateEffects();
  updateSound();
  updateSparks();
  checkCollisions();

  // ===== 擬似オンライン =====
  if(onlineMode){
    sendData();
    receiveData();
  }

  const activeCar = carModel || car;

  camera.position.x += (activeCar.position.x - camera.position.x) * 0.15;
  camera.position.z += (activeCar.position.z - 12 - camera.position.z) * 0.15;
  camera.position.y += (5 - camera.position.y) * 0.1;

  camera.lookAt(activeCar.position);

  composer.render();

  requestAnimationFrame(loop);
}
/* =========================================
   Part 13 : 最適化（FPS改善・軽量化）
========================================= */

// ===== 描画負荷制御 =====
let quality = "HIGH"; // HIGH / MEDIUM / LOW

const qualityUI = document.createElement("div");
qualityUI.style.position = "fixed";
qualityUI.style.bottom = "180px";
qualityUI.style.right = "20px";
qualityUI.style.color = "#0f0";
qualityUI.innerText = "QUALITY: HIGH";
document.body.appendChild(qualityUI);

// 切替
window.addEventListener("keydown", e=>{
  if(e.code === "KeyP"){
    if(quality === "HIGH") quality = "MEDIUM";
    else if(quality === "MEDIUM") quality = "LOW";
    else quality = "HIGH";

    qualityUI.innerText = "QUALITY: " + quality;
    applyQuality();
  }
});

// ===== 品質適用 =====
function applyQuality(){

  if(quality === "LOW"){
    renderer.setPixelRatio(0.5);
    bloomPass.strength = 0.3;
  }

  if(quality === "MEDIUM"){
    renderer.setPixelRatio(0.75);
    bloomPass.strength = 0.7;
  }

  if(quality === "HIGH"){
    renderer.setPixelRatio(window.devicePixelRatio);
    bloomPass.strength = 1.2;
  }

}

// 初期適用
applyQuality();

// ===== FPSカウンター =====
let fps = 0;
let frames = 0;
let lastFpsTime = performance.now();

const fpsUI = document.createElement("div");
fpsUI.style.position = "fixed";
fpsUI.style.top = "10px";
fpsUI.style.right = "20px";
fpsUI.style.color = "#0f0";
document.body.appendChild(fpsUI);

function updateFPS(){

  frames++;

  const now = performance.now();

  if(now - lastFpsTime >= 1000){
    fps = frames;
    frames = 0;
    lastFpsTime = now;

    fpsUI.innerText = "FPS: " + fps;
  }

}

// ===== オブジェクト削減（遠距離カリング）=====
function cullObjects(){

  const maxDist = 500;

  [...enemies, ...rivals].forEach(obj=>{
    const dz = Math.abs(obj.position.z - car.position.z);

    obj.visible = dz < maxDist;
  });

}

// ===== 軽量モード（自動）=====
function autoOptimize(){

  if(fps < 30 && quality !== "LOW"){
    quality = "LOW";
    applyQuality();
    qualityUI.innerText = "QUALITY: AUTO LOW";
  }

}

// ===== loop最終最適化版 =====
const oldLoop9 = loop;

function loop(){

  updatePro();
  updateFinal();

  updatePhysics();
  applyLane();
  applyWanganCurve();
  updateRoad();
  updateEnemies();
  updateRivals();
  checkOvertake();
  updateGame();
  updateEnvironment();
  updateEffects();
  updateSound();
  updateSparks();
  checkCollisions();

  if(onlineMode){
    sendData();
    receiveData();
  }

  // ===== 最適化処理 =====
  cullObjects();
  updateFPS();
  autoOptimize();

  const activeCar = carModel || car;

  camera.position.x += (activeCar.position.x - camera.position.x) * 0.15;
  camera.position.z += (activeCar.position.z - 12 - camera.position.z) * 0.15;
  camera.position.y += (5 - camera.position.y) * 0.1;

  camera.lookAt(activeCar.position);

  composer.render();

  requestAnimationFrame(loop);
}
/* =========================================
   Part 14 : 公開用仕上げ（スタート/ポーズ/チュートリアル）
========================================= */

// ===== ゲーム状態 =====
let gameState = "MENU"; // MENU / PLAY / PAUSE

// ===== UI =====
const overlay = document.createElement("div");
overlay.style.position = "fixed";
overlay.style.inset = "0";
overlay.style.display = "flex";
overlay.style.alignItems = "center";
overlay.style.justifyContent = "center";
overlay.style.background = "rgba(0,0,0,0.7)";
overlay.style.color = "#fff";
overlay.style.fontFamily = "monospace";
overlay.style.zIndex = "9999";
overlay.innerHTML = `
  <div style="text-align:center">
    <h1>NERO</h1>
    <p>湾岸ストリートレーサー</p>
    <button id="startBtn">START</button><br><br>
    <button id="howBtn">HOW TO PLAY</button>
    <div id="howText" style="display:none; margin-top:10px; font-size:12px;">
      W 前進 / S ブレーキ<br>
      A D ハンドル<br>
      SHIFT ブースト<br>
      ← → レーン変更<br>
      O オンライン<br>
      P 画質変更
    </div>
  </div>
`;
document.body.appendChild(overlay);

// ボタン
document.getElementById("startBtn").onclick = ()=>{
  gameState = "PLAY";
  overlay.style.display = "none";
};

document.getElementById("howBtn").onclick = ()=>{
  const el = document.getElementById("howText");
  el.style.display = el.style.display === "none" ? "block" : "none";
};

// ===== ポーズ =====
window.addEventListener("keydown", e=>{
  if(e.code === "Escape"){
    if(gameState === "PLAY"){
      gameState = "PAUSE";
      overlay.style.display = "flex";
      overlay.innerHTML = "<h1>PAUSED</h1><p>ESCで戻る</p>";
    } else if(gameState === "PAUSE"){
      gameState = "PLAY";
      overlay.style.display = "none";
    }
  }
});

// ===== クリックで音解禁対策 =====
window.addEventListener("click", ()=>{
  if(engineSound && !engineSound.isPlaying){
    engineSound.play();
  }
});

// ===== loop最終制御 =====
const oldLoop10 = loop;

function loop(){

  if(gameState !== "PLAY"){
    requestAnimationFrame(loop);
    return;
  }

  updatePro();
  updateFinal();

  updatePhysics();
  applyLane();
  applyWanganCurve();
  updateRoad();
  updateEnemies();
  updateRivals();
  checkOvertake();
  updateGame();
  updateEnvironment();
  updateEffects();
  updateSound();
  updateSparks();
  checkCollisions();

  if(onlineMode){
    sendData();
    receiveData();
  }

  cullObjects();
  updateFPS();
  autoOptimize();

  const activeCar = carModel || car;

  camera.position.x += (activeCar.position.x - camera.position.x) * 0.15;
  camera.position.z += (activeCar.position.z - 12 - camera.position.z) * 0.15;
  camera.position.y += (5 - camera.position.y) * 0.1;

  camera.lookAt(activeCar.position);

  composer.render();

  requestAnimationFrame(loop);
}
/* =========================================
   Part 15 : 最終仕上げ（難易度 + 軽量化固定）
========================================= */

// ===== 難易度 =====
let difficulty = "NORMAL"; // EASY / NORMAL / HARD

const diffUI = document.createElement("div");
diffUI.style.position = "fixed";
diffUI.style.top = "120px";
diffUI.style.left = "50%";
diffUI.style.transform = "translateX(-50%)";
diffUI.style.color = "#fff";
diffUI.innerText = "DIFFICULTY: NORMAL";
document.body.appendChild(diffUI);

// 切替
window.addEventListener("keydown", e=>{
  if(e.code === "KeyL"){
    if(difficulty === "EASY") difficulty = "NORMAL";
    else if(difficulty === "NORMAL") difficulty = "HARD";
    else difficulty = "EASY";

    diffUI.innerText = "DIFFICULTY: " + difficulty;
  }
});

// ===== 難易度適用 =====
function applyDifficulty(){

  if(difficulty === "EASY"){
    ACCEL = 0.6;
    BRAKE = 0.4;
  }

  if(difficulty === "NORMAL"){
    ACCEL = 0.4;
    BRAKE = 0.6;
  }

  if(difficulty === "HARD"){
    ACCEL = 0.3;
    BRAKE = 0.8;
  }

}

// ===== 初期固定（軽量設定）=====
function finalOptimize(){
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1));
  bloomPass.strength = 0.8;
}

finalOptimize();

// ===== loop完全最終 =====
const oldLoop11 = loop;

function loop(){

  if(gameState !== "PLAY"){
    requestAnimationFrame(loop);
    return;
  }

  applyDifficulty();

  updatePro();
  updateFinal();

  updatePhysics();
  applyLane();
  applyWanganCurve();
  updateRoad();
  updateEnemies();
  updateRivals();
  checkOvertake();
  updateGame();
  updateEnvironment();
  updateEffects();
  updateSound();
  updateSparks();
  checkCollisions();

  if(onlineMode){
    sendData();
    receiveData();
  }

  cullObjects();
  updateFPS();
  autoOptimize();

  const activeCar = carModel || car;

  camera.position.x += (activeCar.position.x - camera.position.x) * 0.15;
  camera.position.z += (activeCar.position.z - 12 - camera.position.z) * 0.15;
  camera.position.y += (5 - camera.position.y) * 0.1;

  camera.lookAt(activeCar.position);

  composer.render();

  requestAnimationFrame(loop);
}
