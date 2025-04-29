import { ScrollingScene, setupScene } from "./scene.js"

const inputBox = document.getElementById("input");
const canvas = document.getElementById("canvas");

var bpm = 144;
var scene = new ScrollingScene(canvas, inputBox);
console.log("Scene:", scene);

// Set up the scene
const startButton = document.getElementById("startScene");
console.log("Start button:", startButton);
if (startButton) {
	console.log("Hiding start button");
	startButton.style.display = "none";
}
setupScene(scene, bpm).then(() => {
	if (startButton) {
		startButton.style.display = "inline";
	}
});


// Main update loop
var lastTimestamp = null;
var deltaTime = null;

function update(timestamp) {
	if (lastTimestamp == null) {
		lastTimestamp = timestamp;
	}

	deltaTime = Math.min(100, (timestamp - lastTimestamp)) / 1e3; // seconds
	lastTimestamp = timestamp;

	scene.simulate(deltaTime);
	scene.play();
	scene.draw();

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
if (startButton) {
	startButton.addEventListener("click", () => {
		Tone.start();
		scene.updateScene = !scene.updateScene;
		if (scene.updateScene) {
			startButton.innerText = "Pause";
			requestAnimationFrame(update);
		} else {
			startButton.innerText = "Resume";
		}
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
