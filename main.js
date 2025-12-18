// imports 
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

import {
  EffectComposer,
  RenderPass,
  UnrealBloomPass
} from "three/examples/jsm/Addons.js";


// global variables
let scene, camera, renderer;
let composer;
let clock;
let currentModel = "cube";

const cubes = [];
let baseModels = { cube: null, maxwell: null };

const params = { float: true, floatAmplitude: 0.15, floatSpeed: 2 };


// weather table
//coloring cube
const weatherColors = {
  0:0xffff69, 1:0xbaba00, 2:0xffb72c, 3:0xdf8000,
  45:0x80fa93, 48:0x009918,
  51:0x79fff2, 53:0x27bdaf, 55:0x008578,
  61:0x8687ff, 63:0x2c2d9c, 65:0x00016f,
  71:0xb95eff, 73:0x68239c, 75:0x370061,
  80:0xfc70ff, 81:0x912494, 82:0x5f0061,
  95:0xff4545, 99:0x830000
};

const weatherText = {
  0:"Clear sky", 1:"Mainly clear", 2:"Partly cloudy", 3:"Overcast",
  45:"Fog", 48:"Rime fog",
  51:"Drizzle (Light)", 53:"Drizzle (Moderate)", 55:"Drizzle (Heavy)",
  61:"Rain (Light)", 63:"Rain (Moderate)", 65:"Rain (Heavy)",
  71:"Snow (Light)", 73:"Snow (Moderate)", 75:"Snow (Heavy)",
  80:"Showers (Light)", 81:"Showers (Moderate)", 82:"Showers (Violent)",
  95:"Thunderstorm", 99:"Severe Thunderstorm"
};

// setting cities via lat/long
const citiesList = [
  { name:"Berlin, Germany", lat:52.52, lon:13.41 },
  { name:"College Park, MD", lat:39.0, lon:-76.9 },
  { name:"Tokyo, Japan", lat:35.68, lon:139.69 },
  { name:"Kuwait City, Kuwait", lat:29.3759, lon:47.9774 },
  { name:"Sydney, Australia", lat:-33.87, lon:151.21 },
  { name:"Moscow, Russia", lat:55.75, lon:37.62 },
  { name:"Cairo, Egypt", lat:30.04, lon:31.23 },
  { name:"Reykjavik, Iceland", lat:64.13, lon:-21.82 },
  { name:"Dubai, UAE", lat:25.20, lon:55.27 },
  { name:"Anchorage, Alaska", lat:61.22, lon:-149.90 }
];

//resize camera for cubes so that they fit if the screen is narrow enough
function fitCameraToCubes(camera, cubes, padding = 1.3) {
  if (!cubes.length) return;

  const box = new THREE.Box3();

  cubes.forEach(cube => {
    cube.traverse(obj => {
      if (obj.isMesh) box.expandByObject(obj);
    });
  });

  const size = new THREE.Vector3();
  box.getSize(size);

  // extra vertical headroom for animation
  size.y += 3;

  const center = new THREE.Vector3();
  box.getCenter(center);

  const aspect = camera.aspect;
  const vFOV = THREE.MathUtils.degToRad(camera.fov);
  const hFOV = 2 * Math.atan(Math.tan(vFOV / 2) * aspect);

  const width  = size.x * padding;
  const height = size.y * padding;

  const distW = (width  / 2) / Math.tan(hFOV / 2);
  const distH = (height / 2) / Math.tan(vFOV / 2);

  const distance = Math.max(distW, distH);

  camera.position.set(center.x, center.y, center.z + distance);
  camera.lookAt(center);
}

//start animation
init();
animate();

//prepare rendering in the scene
function init() {

  clock = new THREE.Clock();
  scene = new THREE.Scene();

  // create camera and position it
  camera = new THREE.PerspectiveCamera(
    60, window.innerWidth / window.innerHeight, 0.1, 100
  );
  camera.position.set(0, 0, 20);

  // reender!
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  // renderer.shadowMap.enabled = true;
  document.body.appendChild(renderer.domElement);

  // post processing to add bloom effect (haha my eyes)
  composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  composer.addPass(new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.3,0,0
  ));
  // composer.addPass(bloom);

  // lighting w/ a sun , nvmno more sun
  // const sun = 
  scene.add(new THREE.DirectionalLight(0xffffff, 1));
  // sun.position.set(5, 10, 5);
  // scene.add(sun);
  scene.add(new THREE.AmbientLight(0xffffff, 0.3));
  scene.add(new THREE.HemisphereLight(0x00fffd, 0x404040, 0.7));

  //background
  addGradientBackground();

  // load models
  loadModels();

  window.addEventListener("resize", onWindowResize);
}

//maxwell is to much of a unit, so i gotta autosize them so everything is nice and uniform
function normalizeModelSize(model, targetSize = 1.3) {
  const box = new THREE.Box3().setFromObject(model);
  const size = new THREE.Vector3();
  box.getSize(size);

  const maxDim = Math.max(size.x, size.y, size.z);
  const scale = targetSize / maxDim;

  model.scale.set(scale, scale, scale);

  return targetSize; // store for matching maxwell
}


//load both models
function loadModels() {
  const loader = new GLTFLoader();

  // load ROUNDED CUBE first
  loader.load("rounded_cube.glb", (gltf) => {
    baseModels.cube = gltf.scene;

    // normalize cube exactly like prev system 
    baseModels.cube.userData.normalizedSize = 
      normalizeModelSize(baseModels.cube, 3);

    //texturez
    baseModels.cube.traverse(child => {
      if (child.isMesh) {
        child.material = new THREE.MeshStandardMaterial({
          color: 0xffffff,
          roughness: 0.2,
          metalness: 0,
          emissive: 0xffffff,
          emissiveIntensity: 0.35
        });
      }
    });

    // load MAXWELL afterwards
    loader.load("maxwell_the_cat_dingus.glb", (cat) => {
      baseModels.maxwell = cat.scene;

      // apply same visual size as original cube
      normalizeModelSize(
        baseModels.maxwell,
        baseModels.cube.userData.normalizedSize
      );

      // create cubes only after both models loaded
      createInitialCubes();
      setupUI();
      setupModelToggle();
    });
  });
}



//create the initial 5 cubes
function createInitialCubes() {
  const spacing = 4;

  for (let i = 0; i < 5; i++) {
    const cube = baseModels.cube.clone(true);

    cube.traverse(child => {
      if (child.isMesh) child.material = child.material.clone();
    });

    cube.position.x = (i - 2) * spacing;
    cube.position.y = 0.5;

    cube.userData.city = { ...citiesList[i] };
    cube.userData.weatherData = null;

    scene.add(cube);
    cubes.push(cube);

    // make the labels float with the models
    const label = document.createElement("div");
    label.className = "cubeLabel";
    label.textContent = cube.userData.city.name;
    document.body.appendChild(label);

    cube.userData.labelElement = label;

    fetchWeatherForCube(cube);
  }
  if (window.innerWidth <= 1000) {
    fitCameraToCubes(camera, cubes);
  }
}



// the toggle button to toggle between the two models
function setupModelToggle() {
  const btn = document.getElementById("toggleModelBtn");

  btn.onclick = () => {
    currentModel = currentModel === "cube" ? "maxwell" : "cube";
    switchModel(currentModel);
  };
}

//the function to actually switch between the models
function switchModel(type) {
  const base = baseModels[type];

  cubes.forEach((oldCube, i) => {

    scene.remove(oldCube);

    const newCube = base.clone(true);
    newCube.traverse(child => {
      if (child.isMesh) child.material = child.material.clone();
    });

    // copy transform + data
    newCube.position.copy(oldCube.position);
    newCube.rotation.copy(oldCube.rotation);
    newCube.userData = oldCube.userData;

    cubes[i] = newCube;
    scene.add(newCube);
  });
}



//background
function addGradientBackground() {
  const geo = new THREE.PlaneGeometry(100, 100);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      topColor: { value: new THREE.Color(0x17ffff) },
      bottomColor: { value: new THREE.Color(0xa3ffff) }
    },
    vertexShader:`varying vec2 vUv; void main(){vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader:`varying vec2 vUv; uniform vec3 topColor; uniform vec3 bottomColor;
      void main(){ gl_FragColor = vec4( mix(bottomColor, topColor, vUv.y), 1.0 ); }`,
    depthWrite:false,
    depthTest:false
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.z = -50;
  scene.add(mesh);
}


//creatomg the weather cards
function setupUI() {
  const ui = document.getElementById("cubeControls");

  cubes.forEach((cube,i)=>{
    const div = document.createElement("div");
    div.className = "cubeColumn";

    div.innerHTML = `
        <label><strong>Cube ${i+1}</strong></label>
        <select id="city${i}"></select>
        <div>Temp: <span id="temp${i}">--</span> °F</div>
        <div>Wind: <span id="wind${i}">--</span> mph</div>
        <div>Weather: <span id="weather${i}">--</span></div>
    `;

    ui.appendChild(div);

    const select = div.querySelector("select");
    select.innerHTML = citiesList.map(c => 
        `<option value="${c.lat},${c.lon}">${c.name}</option>`
    ).join("");

    select.value = `${cube.userData.city.lat},${cube.userData.city.lon}`;

    select.addEventListener("change",()=>{
        const [lat,lon] = select.value.split(",");
        cube.userData.city.lat = parseFloat(lat);
        cube.userData.city.lon = parseFloat(lon);
        const selectedCity = citiesList.find(c => 
            c.lat == lat && c.lon == lon
        );
        cube.userData.labelElement.textContent = selectedCity.name;

        fetchWeatherForCube(cube);
    });
  });
}


// FETCHING THE WEATHER VIA API
async function fetchWeatherForCube(cube){
  const { lat, lon } = cube.userData.city;

  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,windspeed_10m,weathercode&timezone=auto`
    );
    cube.userData.weatherData = (await res.json()).hourly;
  } catch (e) {
    console.error("Weather error:", e);
  }
}

// resizing the window because this somehow helped to resolve the bug idk why but im not touching this with a 39 and a half foot long pole
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);

  if (window.innerWidth <= 1000) {
    fitCameraToCubes(camera, cubes);
  }
  //the background WILL collapse and WILL turn into a black screen when a certain ratio is achieved and i dont know how to fix it please forgive me i tried i really did
  //maybe if i become more experienced i'll understand why it's happening but for now thats all i know
}

// animation loop
function animate() {
  requestAnimationFrame(animate);

  const dt = clock.getDelta();
  const t  = clock.getElapsedTime();

  cubes.forEach((cube,i)=>{
    const data = cube.userData.weatherData;
    if (!data) return;

    const hour = new Date().getHours();
    const temp = data.temperature_2m[hour];
    const wind = data.windspeed_10m[hour];
    const code = data.weathercode[hour];

    const tempF = (temp * 9/5 + 32).toFixed(1);
    const windMph = wind * 2.23694;

    // position and floating affected by nothing
    cube.position.y = 0.5 + temp / 10 + Math.sin(t * 2) * 0.15;

    // rotation affected by wind speed
    cube.rotation.y += Math.pow(Math.min(windMph,70)/70,2) * 2 * dt;

    // color affected by weather condition
    cube.traverse(child=>{
      if(child.isMesh){
        child.material.color.set(weatherColors[code]);
        child.material.emissive.set(weatherColors[code]);
      }
    });

    // update ui
    document.getElementById(`temp${i}`).textContent = tempF;
    document.getElementById(`wind${i}`).textContent = windMph.toFixed(1);
    document.getElementById(`weather${i}`).textContent = weatherText[code];

    // update the label's position above the models
    const label = cube.userData.labelElement;

    const pos = new THREE.Vector3();
    cube.getWorldPosition(pos);
    pos.project(camera);

    const x = ( pos.x * 0.5 + 0.5 ) * window.innerWidth;
    const y = ( -pos.y * 0.5 + 0.5 ) * window.innerHeight;

    label.style.left = `${x}px`;
    label.style.top  = `${y}px`;
  });

  composer.render();
}

// mobile ui toggle
const ui = document.getElementById("ui");
const toggleBtn = document.getElementById("uiToggle");

toggleBtn.addEventListener("click", () => {
  ui.classList.toggle("open");
  toggleBtn.textContent = ui.classList.contains("open")
    ? "Hide Controls"
    : "Show Controls";
});



