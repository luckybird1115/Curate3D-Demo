// Remove the old onOpenCvReady definition
// async function onOpenCvReady() { window.cv = await window.cv }

// We'll keep references to some DOM elements
const imageLoader = document.getElementById('imageLoader');
const imageCanvas = document.getElementById('imageCanvas');

const ctx = imageCanvas.getContext('2d');

let img = new Image();
let imgLoaded = false;
let artworkLoaded = false;
let clickCount = 0;
const srcPoints = []; // will store [{x, y}, ...]

// Add these variables at the top with other global variables
let isDragging = false;
let selectedPoint = null;
const dragRadius = 10; // Distance within which clicking will select a point
let artworkScale = 1.0;
let artworkMesh = null;
let isDragging3D = false;
let previousMousePosition = { x: 0, y: 0 };
let isArtworkDragging = false;
let artworkPosition = { x: 0, y: 0 };
let lastMousePos = { x: 0, y: 0 };
let warpedArtwork = null; // To store the warped artwork image
let isWarpedArtworkDragging = false;
let warpedLastMousePos = { x: 0, y: 0 };
let warpedArtworkPosition = { x: 0, y: 0 };
let Minv = null;
let dstMat = null;
let M = null;

// Add these variables at the top to track temporary matrices
let tempSrcPoint = null;
let tempDstPoint = null;

// Add these variables at the top to track matrices used in dragging
let dragSrcPoint = null;
let dragDstPoint = null;
let dragTransformMatrix = null;

// Add this variable at the top of your file
let lastDragOperation = null;

// Add these variables at the top with other global variables
let dragOffset = { x: 0, y: 0 }; // Store the offset between click point and artwork top-left

// Add these variables at the top with other global variables
let scene, camera, renderer;
let planeMesh;
let threeContainer;

// Add this variable at the top with other global variables
let controls;

// --- Load the image when user selects it ---
imageLoader.addEventListener('change', function (e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (evt) {
    img.src = evt.target.result;
  };
  reader.readAsDataURL(file);
});


// Once the image is loaded, draw it on imageCanvas
img.onload = function () {
  imgLoaded = true;
  imageCanvas.width = img.width;
  imageCanvas.height = img.height;

  // Hide the 2D canvas since we're using Three.js
  // imageCanvas.style.display = 'none';

  // Initialize Three.js scene
  initThreeJS();
};

// Add these new functions
function initThreeJS() {
  // Create scene
  scene = new THREE.Scene();

  // Create camera with specific FOV
  const fov = 65.5;
  const aspect = imageCanvas.width / imageCanvas.height;
  camera = new THREE.PerspectiveCamera(fov, aspect, 0.1, 1000);
  
  // Set initial camera position and rotation
  camera.position.set(0, 0, 50);
  camera.rotation.set(0, 0, 0);

  // Create renderer with alpha for transparency
  renderer = new THREE.WebGLRenderer({ alpha: true });
  renderer.setSize(imageCanvas.width, imageCanvas.height);

  // Set the background texture directly from the uploaded image
  const bgTexture = new THREE.TextureLoader().load(img.src);
  scene.background = bgTexture;

  // Get the existing threeContainer element
  threeContainer = document.getElementById('threeContainer');

  // Set position to match imageCanvas
  const rect = imageCanvas.getBoundingClientRect();
  threeContainer.style.position = 'absolute';
  threeContainer.style.top = rect.top + 'px';
  threeContainer.style.left = rect.left + 'px';
  threeContainer.style.width = rect.width + 'px';
  threeContainer.style.height = rect.height + 'px';

  threeContainer.appendChild(renderer.domElement);

  // Create plane geometry
  const geometry = new THREE.PlaneGeometry(
    88,
    44
  );

  // Create material with the texture
  const material = new THREE.MeshBasicMaterial({
    color: 0x00ff00,
    opacity: 0.5,
    transparent: true,
    side: THREE.DoubleSide
  });

  // Create mesh
  planeMesh = new THREE.Mesh(geometry, material);
  scene.add(planeMesh);

  // // Add OrbitControls
  // controls = new THREE.OrbitControls(camera, renderer.domElement);
  // controls.enableDamping = true;
  // controls.dampingFactor = 0.05;
  // controls.screenSpacePanning = true;

  // Add camera controls
  setupCameraControls();

  // Setup plane controls
  setupPlaneControls(planeMesh);

  // Start animation loop
  animate();
}

function setupCameraControls() {
  const camX = document.getElementById('camX');
  const camY = document.getElementById('camY');
  const camZ = document.getElementById('camZ');

  // Update inputs with initial camera position
  camX.value = camera.position.x;
  camY.value = camera.position.y;
  camZ.value = camera.position.z;

  // Add event listeners for position changes
  camX.addEventListener('change', () => {
    camera.position.x = parseFloat(camX.value);
    camera.updateProjectionMatrix();
  });

  camY.addEventListener('change', () => {
    camera.position.y = parseFloat(camY.value);
    camera.updateProjectionMatrix();
  });

  camZ.addEventListener('change', () => {
    camera.position.z = parseFloat(camZ.value);
    camera.updateProjectionMatrix();
  });

}

function setupPlaneControls(planeMesh) {

    const planeRotX = document.getElementById('planeRotX');
    const planeRotY = document.getElementById('planeRotY');
    const planeRotZ = document.getElementById('planeRotZ');


    planeRotX.value = planeMesh.rotation.x;
    planeRotY.value = planeMesh.rotation.y;
    planeRotZ.value = planeMesh.rotation.z;

    // Rotation controls
    planeRotX.addEventListener('change', () => {
        planeMesh.rotation.x = parseFloat(planeRotX.value);
    });

    planeRotY.addEventListener('change', () => {
        planeMesh.rotation.y = parseFloat(planeRotY.value);
    });

    planeRotZ.addEventListener('change', () => {
        planeMesh.rotation.z = parseFloat(planeRotZ.value);
    });
}

function animate() {
  requestAnimationFrame(animate);
  camera.lookAt(new THREE.Vector3(0, 0, 0));
  // controls.update();
  renderer.render(scene, camera);
}
