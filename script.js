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
