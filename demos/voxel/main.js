import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';


// --- CONFIGURATION ---
const GRID_SIZE = 1;
const PINCH_THRESHOLD = 0.04;

// --- STATE ---
let blocks = [];
let lastPinchTime = 0;
let isPinching = false;
let scene, camera, renderer, ghostBlock, sceneContainer, composer;
let handPosition = new THREE.Vector3();
let gridPosition = new THREE.Vector3();
let targetRotationY = 0;
let currentRotationY = 0;
let lastLeftHandX = null;



// --- UI ELEMENTS ---
const statusText = document.getElementById('status-text');
const blockCountDisplay = document.getElementById('block-count');

// --- INITIALIZATION ---
function init() {
    // 1. Three.js Scene Setup
    scene = new THREE.Scene();

    // Background should be transparent to see video
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 5, 10);
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({
        canvas: document.getElementById('output-canvas'),
        alpha: true,
        antialias: true
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Post Processing (Bloom)
    const renderScene = new RenderPass(scene, camera);
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
    bloomPass.threshold = 0;
    bloomPass.strength = 1.2;
    bloomPass.radius = 0.5;

    composer = new EffectComposer(renderer);
    composer.addPass(renderScene);
    composer.addPass(bloomPass);

    // Scene Container for Rotation
    sceneContainer = new THREE.Group();
    scene.add(sceneContainer);

    // Grid Helper
    const gridHelper = new THREE.GridHelper(20, 20, 0x00f2ff, 0x052222);
    gridHelper.position.y = -0.51;
    sceneContainer.add(gridHelper);

    // Ground for shadows
    const groundGeo = new THREE.PlaneGeometry(20, 20);
    const groundMat = new THREE.ShadowMaterial({ opacity: 0.2 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.52;
    ground.receiveShadow = true;
    sceneContainer.add(ground);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
    directionalLight.position.set(5, 10, 7.5);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    // Ghost/Preview Block
    const ghostGeo = new THREE.BoxGeometry(GRID_SIZE * 0.95, GRID_SIZE * 0.95, GRID_SIZE * 0.95);
    const ghostMat = new THREE.MeshStandardMaterial({
        color: 0x00f2ff,
        transparent: true,
        opacity: 0.3,
        emissive: 0x00f2ff,
        emissiveIntensity: 1.0,
        metalness: 0.8,
        roughness: 0.2
    });
    ghostBlock = new THREE.Mesh(ghostGeo, ghostMat);
    sceneContainer.add(ghostBlock);


    window.addEventListener('resize', onWindowResize);
    window.addEventListener('keydown', onKeyDown);

    initMediaPipe();
    animate();
}

function onKeyDown(event) {
    if (event.key === 'ArrowLeft') targetRotationY += Math.PI / 4;
    if (event.key === 'ArrowRight') targetRotationY -= Math.PI / 4;
    if (event.key === 'c' || event.key === 'C') clearBlocks();
}

function clearBlocks() {
    blocks.forEach(b => sceneContainer.remove(b));
    blocks = [];
    blockCountDisplay.innerText = '0';
}


function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// --- MEDIAPIPE HANDS SETUP ---
function initMediaPipe() {
    const videoElement = document.getElementById('input-video');
    const hands = new Hands({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
    });

    hands.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.7,
        minTrackingConfidence: 0.7
    });

    hands.onResults(onResults);


    const cameraProvider = new Camera(videoElement, {
        onFrame: async () => {
            await hands.send({ image: videoElement });
        },
        width: 1280,
        height: 720
    });

    // Without this the status stayed on "INITIALIZING..." forever whenever the
    // camera was denied, busy or missing, with no explanation anywhere in the
    // page.
    cameraProvider.start().catch((err) => {
        statusText.innerText = 'CAMERA UNAVAILABLE';
        showError(
            err && err.name === 'NotAllowedError'
                ? 'Camera permission was denied. Allow it and reload.'
                : `Cannot start the camera: ${err && err.message ? err.message : err}`
        );
    });
}

function showError(message) {
    let box = document.getElementById('error-box');
    if (!box) {
        box = document.createElement('div');
        box.id = 'error-box';
        box.style.cssText =
            'position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);' +
            'max-width:min(90vw,440px);padding:20px 24px;z-index:99;' +
            'background:rgba(10,12,18,.94);border:1px solid #ff4d4d;border-radius:10px;' +
            'color:#ffd9d9;font:14px/1.5 monospace;text-align:center';
        document.body.appendChild(box);
    }
    box.textContent = message;
}

function onResults(results) {
    let rightHandVisible = false;
    let leftHandVisible = false;

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        statusText.innerText = 'HANDS TRACKING';

        results.multiHandLandmarks.forEach((landmarks, index) => {
            const handedness = results.multiHandedness[index].label;

            // MediaPipe labels hands as seen in the (un-mirrored) camera
            // image, so a label of 'Left' is the hand that appears on the left
            // of the frame -- which is the user's PHYSICAL RIGHT hand when
            // they face the camera. That is the building hand.
            if (handedness === 'Left') {
                rightHandVisible = true;
                ghostBlock.visible = true;

                const indexTip = landmarks[8];
                const thumbTip = landmarks[4];

                const targetX = (1 - indexTip.x - 0.5) * 20;
                const targetY = (1 - indexTip.y - 0.5) * 15;
                const targetZ = indexTip.z * -20;

                handPosition.set(targetX, targetY, targetZ);

                // ghostBlock is a CHILD of sceneContainer, which is rotated.
                // The original snapped the ghost in world space but placed the
                // real block in rotation-compensated local space, so once you
                // rotated the scene the preview and the block it created
                // appeared in completely different places.
                // Snap in local space and use that same value for both.
                gridPosition
                    .copy(handPosition)
                    .applyAxisAngle(new THREE.Vector3(0, 1, 0), -currentRotationY);
                gridPosition.set(
                    Math.round(gridPosition.x / GRID_SIZE) * GRID_SIZE,
                    Math.round(gridPosition.y / GRID_SIZE) * GRID_SIZE,
                    Math.round(gridPosition.z / GRID_SIZE) * GRID_SIZE
                );

                ghostBlock.position.copy(gridPosition);

                const distance = Math.sqrt(
                    Math.pow(indexTip.x - thumbTip.x, 2) +
                    Math.pow(indexTip.y - thumbTip.y, 2) +
                    Math.pow(indexTip.z - thumbTip.z, 2)
                );

                if (distance < PINCH_THRESHOLD) {
                    if (!isPinching) {
                        isPinching = true;
                        const now = Date.now();
                        if (now - lastPinchTime > 500) {
                            // gridPosition is already snapped in local space,
                            // so the block lands exactly where the ghost is.
                            toggleBlock(gridPosition.clone());
                            lastPinchTime = now;
                        }
                    }
                } else {
                    isPinching = false;
                }
            } else { // USER'S PHYSICAL LEFT HAND (Rotation)
                leftHandVisible = true;
                const indexTip = landmarks[8];

                if (lastLeftHandX !== null) {
                    const deltaX = (indexTip.x - lastLeftHandX);
                    targetRotationY += deltaX * 5;
                }
                lastLeftHandX = indexTip.x;
            }
        });
    }

    if (!rightHandVisible) {
        ghostBlock.visible = false;
    }
    if (!leftHandVisible) {
        lastLeftHandX = null;
    }

    if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
        statusText.innerText = 'WAITING FOR HANDS...';
    }
}

function toggleBlock(pos) {
    const existingIndex = blocks.findIndex(b => b.position.distanceTo(pos) < 0.1);

    if (existingIndex !== -1) {
        const block = blocks[existingIndex];
        sceneContainer.remove(block);
        blocks.splice(existingIndex, 1);
        statusText.innerText = 'BLOCK REMOVED';
    } else {
        const geo = new THREE.BoxGeometry(GRID_SIZE, GRID_SIZE, GRID_SIZE);
        const mat = new THREE.MeshStandardMaterial({
            color: 0x00f2ff,
            transparent: true,
            opacity: 0.9,
            emissive: 0x00f2ff,
            emissiveIntensity: 0.8,
            metalness: 0.5,
            roughness: 0.1
        });
        const block = new THREE.Mesh(geo, mat);
        block.position.copy(pos);
        block.castShadow = true;
        block.receiveShadow = true;

        const edges = new THREE.EdgesGeometry(geo);
        const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 }));
        block.add(line);

        sceneContainer.add(block);
        blocks.push(block);
        statusText.innerText = 'BLOCK ADDED';
    }
    blockCountDisplay.innerText = blocks.length;
}

function animate() {
    requestAnimationFrame(animate);

    currentRotationY += (targetRotationY - currentRotationY) * 0.1;
    sceneContainer.rotation.y = currentRotationY;

    composer.render();
}

init();

