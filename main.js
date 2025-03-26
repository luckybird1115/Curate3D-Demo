let img = new Image();
let imgLoaded = false;
let clickCount = 0;
const srcPoints = []; // store 4 clicked points in image [ {x, y}, ...]
let imageCanvas = document.getElementById('imageCanvas');
const drawButton = document.getElementById('drawButton');
const imageLoader = document.getElementById('imageLoader');
const computeFBtn = document.getElementById('computeFBtn');
let ctx = imageCanvas.getContext('2d');

// Real-world plane dimensions
let planeWidthInput = document.getElementById('planeWidth');
let planeHeightInput = document.getElementById('planeHeight');

// Output displays
let focalLengthDisplay = document.getElementById('focalLengthDisplay');
let fovDisplay = document.getElementById('fovDisplay');

// THREE.js stuff
let scene, camera, renderer;
let planeMesh;   // The plane in 3D
let clock = new THREE.Clock();

// We assume principal point is center of the *image* (not necessarily the canvas)
let principalX = 0.0;
let principalY = 0.0;

let isDragging = false;
let selectedPoint = null;
let lastDragOperation = null;
let dragRadius = 10;


// IMAGE LOAD
imageLoader.addEventListener('change', function (e) {
  const file = e.target.files[0];
  if (!file) return;

  let reader = new FileReader();
  reader.onload = (evt) => {
    img.src = evt.target.result;
  };
  reader.readAsDataURL(file);
});

img.onload = function () {
  imgLoaded = true;
  imageCanvas.width = img.width;
  imageCanvas.height = img.height;
  principalX = img.width * 0.5;
  principalY = img.height * 0.5;

  ctx.drawImage(img, 0, 0);
  clickCount = 0;
  srcPoints.length = 0;

  // Create texture from the loaded image and set as scene background
  const texture = new THREE.Texture(img);
  texture.needsUpdate = true;
  scene.background = texture;
  renderer.render(scene, camera);
};

drawButton.addEventListener('click', function () {
  if (!imgLoaded) return;
  if (clickCount >= 4) {
    alert("You've already selected 4 points. Press 'Warp & Show in 3D' or reload image.");
    return;
  }

  // Calculate center of canvas
  const centerX = imageCanvas.width / 2;
  const centerY = imageCanvas.height / 2;

  // Rectangle dimensions
  const width = 500;
  const height = 300;

  // Calculate corner points
  const points = [
    { x: centerX - width / 2, y: centerY - height / 2 }, // top-left
    { x: centerX + width / 2, y: centerY - height / 2 }, // top-right
    { x: centerX + width / 2, y: centerY + height / 2 }, // bottom-right
    { x: centerX - width / 2, y: centerY + height / 2 }  // bottom-left
  ];

  // Draw rectangle
  ctx.beginPath();
  ctx.strokeStyle = 'black';
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.closePath();
  ctx.stroke();

  // Draw corner points and labels
  points.forEach((point, index) => {
    // Draw the point circle
    ctx.fillStyle = 'red';
    ctx.beginPath();
    ctx.arc(point.x, point.y, 5, 0, 2 * Math.PI);
    ctx.fill();

    // Draw the number label
    ctx.fillStyle = 'blue';
    ctx.font = '16px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText((index + 1).toString(), point.x + 10, point.y + 10);

    // Add point to srcPoints array
    srcPoints.push(point);
    clickCount++;
  });
});

// Modify the existing imageCanvas click listener to this:
imageCanvas.addEventListener('mousedown', function (evt) {
  if (!imgLoaded) return;

  const rect = imageCanvas.getBoundingClientRect();
  const x = evt.clientX - rect.left;
  const y = evt.clientY - rect.top;
  // Check for corner point dragging (existing code)
  for (let i = 0; i < srcPoints.length; i++) {
    const point = srcPoints[i];
    const distance = Math.sqrt((x - point.x) ** 2 + (y - point.y) ** 2);
    if (distance < dragRadius) {
      isDragging = true;
      selectedPoint = i;
      return;
    }
  }
});

// Modify the mousemove event handler
imageCanvas.addEventListener('mousemove', function (evt) {
  if (!imgLoaded) return;

  const rect = imageCanvas.getBoundingClientRect();
  const x = evt.clientX - rect.left;
  const y = evt.clientY - rect.top;

  // Check if we're hovering over any point
  let isOverPoint = false;
  for (let i = 0; i < srcPoints.length; i++) {
    const point = srcPoints[i];
    const distance = Math.sqrt((x - point.x) ** 2 + (y - point.y) ** 2);
    if (distance < dragRadius) {
      isOverPoint = true;
      break;
    }
  }

  // Change cursor style based on hover and drag state
  if (isDragging) {
    imageCanvas.style.cursor = 'grabbing';
  } else if (isOverPoint) {
    imageCanvas.style.cursor = 'grab';
  } else {
    imageCanvas.style.cursor = 'default';
  }

  // If we're dragging, update point position
  if (isDragging && selectedPoint !== null) {
    // Update the point position
    srcPoints[selectedPoint].x = x;
    srcPoints[selectedPoint].y = y;
    // Redraw everything
    redrawCanvas();
  }
});

// Update mouseup event handler
imageCanvas.addEventListener('mouseup', function () {
  if (lastDragOperation) {
    cancelAnimationFrame(lastDragOperation);
    lastDragOperation = null;
  }

  isDragging = false;
  selectedPoint = null;
  imageCanvas.style.cursor = 'default';
});

// Add mouseleave handler to ensure cleanup
imageCanvas.addEventListener('mouseleave', function () {
  if (lastDragOperation) {
    cancelAnimationFrame(lastDragOperation);
    lastDragOperation = null;
  }

  isDragging = false;
  selectedPoint = null;
  imageCanvas.style.cursor = 'default';
});

//////////////////////////////
//  THREE.JS SCENE INIT
//////////////////////////////
initThree();
animate();

function initThree() {
  const container = document.getElementById('threeContainer');
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.appendChild(renderer.domElement);

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xffffff);

  // PerspectiveCamera(fov, aspect, near, far)
  // We'll start with some guessed fov
  camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 1, 10000);
  camera.position.set(0, 0, 500);
  scene.add(camera);

  // Add a light
  let dirLight = new THREE.DirectionalLight(0xffffff, 1);
  dirLight.position.set(0, 0, 1).normalize();
  scene.add(dirLight);

  // Create a plane geometry of some default size (will update later)
  let pw = parseFloat(planeWidthInput.value);
  let ph = parseFloat(planeHeightInput.value);
  let geometry = new THREE.PlaneGeometry(pw, ph);
  let material = new THREE.MeshBasicMaterial({ color: 0x00FF00, opacity: 0.5, transparent: true, side: THREE.DoubleSide });
  planeMesh = new THREE.Mesh(geometry, material);
  scene.add(planeMesh);

  // Add camera controls
  setupCameraControls();

  // Setup plane controls
  setupPlaneControls(planeMesh);

  adjustFocalLength()
}

function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();
  camera.lookAt(new THREE.Vector3(0, 0, 0));
  renderer.render(scene, camera);
}

//////////////////////////////
//  FOCAL LENGTH COMPUTATION
//////////////////////////////
computeFBtn.addEventListener('click', computeFocalLength);

function computeFocalLength() {
  if (!imgLoaded || srcPoints.length < 4) {
    alert("Load an image and click 4 corners first.");
    return;
  }
  // Read plane size from user
  let W = parseFloat(planeWidthInput.value);
  let H = parseFloat(planeHeightInput.value);
  if (!W || !H || W <= 0 || H <= 0) {
    alert("Please enter valid plane width/height.");
    return;
  }

  // getFocalLength();

  let newGeo = new THREE.PlaneGeometry(W, H);
  planeMesh.geometry.dispose();
  planeMesh.geometry = newGeo;

  let planeCornersCam = getPlaneCornersInCameraSpace(planeMesh, camera);

  // Now we have planeCornersCam[i] = {Xc, Yc, Zc}
  // and we have srcPoints[i] = {x, y} in image.

  // We do a small least-squares to solve for f:
  //    x_i - c_x = f * (X_c / Z_c)
  //    y_i - c_y = f * (Y_c / Z_c)
  // We'll gather these into a system and solve. In practice, we can do a direct linear solve
  // or use an average of each corner's implied f. Let's do a simple approach:
  let fValues = [];

  for (let i = 0; i < 4; i++) {
    let xi = srcPoints[i].x; // user clicked
    let yi = srcPoints[i].y;
    let Xc = planeCornersCam[i].Xc;
    let Yc = planeCornersCam[i].Yc;
    let Zc = planeCornersCam[i].Zc;
    // skip if close to zero or negative Z, etc.
    if (Math.abs(Zc) < 1e-6) {
      console.warn("Corner has near-zero Z in camera space!");
      continue;
    }
    // principal point offset
    let dx = xi - principalX;
    let dy = yi - principalY;

    let fCandidateX = dx / (Xc / Zc);
    let fCandidateY = dy / (Yc / Zc);

    // They should be consistent if the corner is not noise. In practice, we can average them
    // or do a 2D approach. Let's just store them both.
    if (Math.abs(Xc) > 1e-9) fValues.push(fCandidateX);
    if (Math.abs(Yc) > 1e-9) fValues.push(fCandidateY);
  }

  if (fValues.length === 0) {
    alert("No valid corners for focal length. Check orientation or Z>0, etc.");
    return;
  }

  // Simple average
  let fEstimate = fValues.reduce((a, b) => a + b, 0) / fValues.length;

  // If fEstimate is negative (e.g. if corners behind camera?), that's a sign the plane/camera orientation is reversed.
  // We'll just take absolute. In a real system, we might handle it carefully.
  fEstimate = Math.abs(fEstimate);

  focalLengthDisplay.textContent = fEstimate.toFixed(2);

  // Now let's convert this "f in pixels" to a three.js FOV (vertical) in degrees:
  // 
  // The standard pinhole model says:
  //   f (in px) = (imageHeight/2) / tan(fov/2),
  //   fov = 2 * atan((imageHeight/2) / f)
  //
  // Because three.js uses a vertical FOV, we'll pick "imageHeight" as the sensor size in pixels.
  // If you prefer to treat "imageWidth" as the basis, you'd do a different approach.
  let imageHeight = img.height;
  let fovRad = 2 * Math.atan((imageHeight * 0.5) / fEstimate);
  let fovDeg = THREE.MathUtils.radToDeg(fovRad);
  fovDisplay.textContent = fovDeg.toFixed(2);

  // Update the camera
  camera.fov = fovDeg;
  camera.updateProjectionMatrix();

  adjustFocalLength()

  // Alternatively, if your three.js version supports setFocalLength:
  // camera.setFocalLength(fEstimate);
  // Then you'd also want to specify the camera's filmHeight or filmWidth consistent with your pixel dimension, etc.
}

// Helper: get corners in camera space, matching the same order we used in the image
// We'll define top-left as corner[0], top-right as corner[1], bottom-right corner[2], bottom-left corner[3].
// For a plane lying in XY with normal +/-Z, "top-left" is somewhat arbitrary. Adjust as needed to match user clicking order.
function getPlaneCornersInCameraSpace(mesh, camera) {
  // local corners (assuming plane center at origin). We define them for typical plane geometry:
  // PlaneGeometry sets corners from (-W/2, +H/2) to (+W/2, -H/2) but let's be explicit:
  let geometry = mesh.geometry;
  geometry.computeBoundingBox();
  let bb = geometry.boundingBox;
  // boundingBox min->(x,y,z) and max->(x,y,z)

  // We'll assume top-left = (min.x, max.y)
  let cornersLocal = [
    new THREE.Vector3(bb.min.x, bb.max.y, 0), // top-left
    new THREE.Vector3(bb.max.x, bb.max.y, 0), // top-right
    new THREE.Vector3(bb.max.x, bb.min.y, 0), // bottom-right
    new THREE.Vector3(bb.min.x, bb.min.y, 0)  // bottom-left
  ];

  let planeCornersCam = [];
  for (let i = 0; i < 4; i++) {
    // Transform local -> world
    let worldPos = mesh.localToWorld(cornersLocal[i].clone());
    // Then world -> camera
    let camPos = new THREE.Vector3();
    camPos.copy(worldPos).applyMatrix4(camera.matrixWorldInverse);
    planeCornersCam.push({
      Xc: camPos.x,
      Yc: camPos.y,
      Zc: camPos.z
    });
  }
  return planeCornersCam;
}

function redrawCanvas() {
  // Clear canvas with white background first to remove any artifacts
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, imageCanvas.width, imageCanvas.height);

  // Draw the background image
  ctx.drawImage(img, 0, 0);

  // Draw rectangle
  if (srcPoints.length === 4) {
    ctx.beginPath();
    ctx.strokeStyle = 'black';
    ctx.moveTo(srcPoints[0].x, srcPoints[0].y);
    for (let i = 1; i < srcPoints.length; i++) {
      ctx.lineTo(srcPoints[i].x, srcPoints[i].y);
    }
    ctx.closePath();
    ctx.stroke();

    // Draw corner points and labels
    srcPoints.forEach((point, index) => {
      // Draw the point circle
      ctx.fillStyle = selectedPoint === index ? 'yellow' : 'red';
      ctx.beginPath();
      ctx.arc(point.x, point.y, 5, 0, 2 * Math.PI);
      ctx.fill();

      // Draw the number label - changed color to blue and position follows point
      ctx.fillStyle = 'blue';
      ctx.font = '16px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText((index + 1).toString(), point.x + 10, point.y + 10);
    });
  }
}

function adjustFocalLength() {
  const focalLengthXInput = document.getElementById('focalLengthX');
  const focalLengthYInput = document.getElementById('focalLengthY');
  const cameraFovInput = document.getElementById('cameraFov');

  // Standard full-frame sensor dimensions in mm
  const SENSOR_HEIGHT = 24; // mm

  // Convert initial camera FOV to focal length
  // f = (sensorHeight/2) / tan(FOV/2)
  const initialFocalLength = (SENSOR_HEIGHT / 2) / Math.tan((camera.fov * Math.PI / 180) / 2);

  focalLengthXInput.value = initialFocalLength.toFixed(2);
  focalLengthYInput.value = initialFocalLength.toFixed(2);
  cameraFovInput.value = camera.fov;

  focalLengthXInput.addEventListener('change', () => {
    const focalLength = parseFloat(focalLengthXInput.value);
    if (focalLength <= 0) return;

    // Calculate FOV in degrees
    // FOV = 2 * arctan(sensorSize / (2 * focalLength))
    const fovDegrees = 2 * Math.atan(SENSOR_HEIGHT / (2 * focalLength)) * (180 / Math.PI);

    cameraFovInput.value = fovDegrees;
    camera.fov = fovDegrees;
    camera.updateProjectionMatrix();
  });

  focalLengthYInput.addEventListener('change', () => {
    const focalLength = parseFloat(focalLengthYInput.value);
    if (focalLength <= 0) return;

    const fovDegrees = 2 * Math.atan(SENSOR_HEIGHT / (2 * focalLength)) * (180 / Math.PI);

    cameraFovInput.value = fovDegrees;
    camera.fov = fovDegrees;
    camera.updateProjectionMatrix();
  });
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

  const planeX = document.getElementById('planeX');
  const planeY = document.getElementById('planeY');
  const planeZ = document.getElementById('planeZ');

  const planeRotX = document.getElementById('planeRotX');
  const planeRotY = document.getElementById('planeRotY');
  const planeRotZ = document.getElementById('planeRotZ');

  // Set initial values

  planeX.value = planeMesh.position.x;
  planeY.value = planeMesh.position.y;
  planeZ.value = planeMesh.position.z;

  planeRotX.value = planeMesh.rotation.x;
  planeRotY.value = planeMesh.rotation.y;
  planeRotZ.value = planeMesh.rotation.z;



  // Position controls
  planeX.addEventListener('change', () => {
    planeMesh.position.x = parseFloat(planeX.value);
  });

  planeY.addEventListener('change', () => {
    planeMesh.position.y = parseFloat(planeY.value);
  });

  planeZ.addEventListener('change', () => {
    planeMesh.position.z = parseFloat(planeZ.value);
  });

  // Rotaton controls
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


async function getFocalLength() {

  // Read plane size from user
  let W = parseFloat(planeWidthInput.value);
  let H = parseFloat(planeHeightInput.value);

  // Define the 4 corners of the wall in the image (pixel coordinates)
  const corners = [
    new cv.Point(srcPoints[0].x, srcPoints[0].y),
    new cv.Point(srcPoints[1].x, srcPoints[1].y),
    new cv.Point(srcPoints[2].x, srcPoints[2].y),
    new cv.Point(srcPoints[3].x, srcPoints[3].y),
  ];

  const objectPoints = cv.matFromArray(4, 1, cv.CV_32FC3, [
    -W / 2, H / 2, 0,
    W / 2, H / 2, 0,
    W / 2, -H / 2, 0,
    -W / 2, -H / 2, 0
  ]);

  // Estimate focal length
  await createThreeJSCamera(img.width, img.height, corners, objectPoints);
}

// Function to estimate focal length using OpenCV.js
async function estimateFocalLength(imageWidth, imageHeight, corners, objectPoints) {
  return new Promise((resolve, reject) => {
    try {
      // Initialize camera matrix with reasonable defaults
      let cameraMatrix = new cv.Mat(3, 3, cv.CV_64F);
      let data = new Float64Array([
        imageWidth, 0, imageWidth / 2,  // Initial fx = imageWidth, cx = width/2
        0, imageWidth, imageHeight / 2,  // Initial fy = imageWidth, cy = height/2
        0, 0, 1
      ]);
      cameraMatrix.data64F.set(data);

      let distCoeffs = cv.Mat.zeros(5, 1, cv.CV_64F);
      let rvec = new cv.Mat();
      let tvec = new cv.Mat();

      // Convert to OpenCV matrices
      let imagePointsMat = cv.matFromArray(4, 1, cv.CV_32FC2, [].concat(...corners.map(p => [p.x, p.y])));

      // Set flags to estimate camera matrix
      let flags = cv.SOLVEPNP_ITERATIVE;
      let useExtrinsicGuess = false;

      // Solve PnP to get rotation & translation vectors
      let success = cv.solvePnP(objectPoints, imagePointsMat, cameraMatrix, distCoeffs, rvec, tvec, useExtrinsicGuess, flags);

      if (!success) {
        reject("solvePnP failed to find a solution.");
        return;
      }

      // Extract focal lengths from camera intrinsic matrix
      let fx = cameraMatrix.doublePtr(0, 0)[0];
      let fy = cameraMatrix.doublePtr(1, 1)[0];

      console.log("Estimated Focal Lengths (pixels):", fx, fy);
      console.log("Camera Matrix:", cameraMatrix.data64F);

      // Clean up
      imagePointsMat.delete();
      cameraMatrix.delete();
      distCoeffs.delete();
      rvec.delete();
      tvec.delete();

      resolve({ fx, fy, rvec, tvec });
    } catch (error) {
      reject(`Error in estimateFocalLength: ${error.message}`);
    }
  });
}

// Function to create a PerspectiveCamera in Three.js
async function createThreeJSCamera(imageWidth, imageHeight, corners, objectPoints) {
  try {
    const { fx, fy, rvec, tvec } = await estimateFocalLength(imageWidth, imageHeight, corners, objectPoints);

    // Compute Field of View (FOV)
    const fov = (2 * Math.atan(imageHeight / (2 * fy))) * (180 / Math.PI); // Convert to degrees
    const aspect = imageWidth / imageHeight;
    const near = 0.1;
    const far = 1000;

    console.log("Three.js Camera FOV:", fov);

    return null;
  } catch (error) {
    console.error("Error creating Three.js camera:", error);
    return null;
  }
}