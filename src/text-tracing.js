import { ScrollingScene } from "./scrolling-scene.js"

const inputBox = document.getElementById("input");
const updateButton = document.getElementById("updateScene");
const updateFrameButton = document.getElementById("updateSceneFrame");
const canvas = document.getElementById("canvas");

var scene = new ScrollingScene(canvas, 0.1, inputBox, updateButton);


var lastTimestamp = null;
var deltaTime = null;

function update(timestamp) {
	if (lastTimestamp == null) {
		lastTimestamp = timestamp;
	}

	deltaTime = Math.min(100, (timestamp - lastTimestamp)); // seconds
	lastTimestamp = timestamp;

	scene.simulate(deltaTime);
	scene.draw();

	if (!scene.updateScene) {
		return;
	}

	requestAnimationFrame(update);
}

// Start
requestAnimationFrame(update);

updateButton.addEventListener("click", () => {
	scene.updateScene = !scene.updateScene;
	if (scene.updateScene) {
		updateButton.innerText = "Pause";
		requestAnimationFrame(update);
	} else {
		updateButton.innerText = "Resume";
	}
});

updateFrameButton.addEventListener("click", () => {
	scene.updateScene = false;
	scene.simulate(1e3 / 20);
	scene.draw();
});