import { ScrollingScene, setupScene } from "./scene.js"
import { audioCtx } from "./audio.js"

const inputBox = document.getElementById("input");
const canvas = document.getElementById("canvas");
const loadingScreen = document.getElementById("loading-screen");

var bpm = 144;
var scene = new ScrollingScene(canvas, inputBox);
console.log("Scene:", scene);

// Set up the scene
const controlsDiv = document.getElementById("controls");
if (controlsDiv) {
	console.log("Hiding start button");
	controlsDiv.style.display = "none";
	inputBox.style.display = "none";
}
setupScene(scene, bpm).then(() => {
	if (controlsDiv) {
		controlsDiv.style.display = "block";
		if (loadingScreen) {
			loadingScreen.style.display = "none";
		}
	}
});


// Main update loop
var lastTimestamp = null;
var deltaTime = null;

function update(timestamp) {
	if (lastTimestamp == null) {
		lastTimestamp = timestamp;
	}
	if (scene.dot.hasCollidedWithGround && !scene.metronomeStarted) {
		Tone.Transport.start();
		scene.metronomeStarted = true;
	}

	deltaTime = Math.min(100, (timestamp - lastTimestamp)) / 1e3; // seconds
	lastTimestamp = timestamp;

	scene.simulate(deltaTime);
	scene.draw();
	if (soundOn) {
		scene.play();
	}

	// if (Tone.Transport.seconds > 10) {
	// 	Tone.Transport.stop();
	// 	Tone.Transport.start("+0.01");
	// }

	if (!scene.updateScene) {
		return;
	}

	requestAnimationFrame(update);
}

// Start
// Requires the user to press a button to enable audio
// requestAnimationFrame(update);

// Starting and stopping everything 
const startScene = document.getElementById("startScene");
if (startScene) {
	startScene.addEventListener("click", async () => {
		console.log("Starting scene");
		await Tone.start();
		await audioCtx.resume();
		scene.updateScene = !scene.updateScene;
		if (scene.updateScene) {
			// startScene.value = "Pause";
			startScene.style.display = "none";
			inputBox.style.display = "inline-block";
			inputBox.focus();
			requestAnimationFrame(update);
		} else {
			// startScene.value = "Resume";
		}
	});
}


// Toggle sound
var soundOn = true;
const toggleSoundBox = document.getElementById("toggleSound");
if (toggleSoundBox) {
	soundOn = toggleSoundBox.checked;
	toggleSoundBox.addEventListener("click", () => {
		soundOn = toggleSoundBox.checked;
	});
}

// Update a single frame (for debugging)
const updateFrameButton = document.getElementById("updateSceneFrame");
if (updateFrameButton) {
	updateFrameButton.addEventListener("click", () => {
		scene.updateScene = false;
		scene.simulate(1e3 / 20);
		scene.draw();
	});
}
