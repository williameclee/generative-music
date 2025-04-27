import { Dot } from "./dot-physics.js"
import { ScrollingScene } from "./scrolling-scene.js"

const input = document.getElementById("input");
const canvas = document.getElementById("canvas");

let updateScene = true;

const updateSceneButton = document.getElementById("updateScene");
updateSceneButton.addEventListener("click", () => {
	updateScene = !updateScene;
});


var scene = new ScrollingScene(canvas, 0.1, input);
var dot = new Dot(100, scene.canvasCtx.canvas.height * 1 / 2, 5); // must come after canvasCtx to initialise dot


var lastTimestamp = null;
var deltaTime = null;

function mainLoop(timestamp) {
	if (!updateScene) {
		requestAnimationFrame(mainLoop);
		return;
	}

	if (lastTimestamp == null) {
		lastTimestamp = timestamp;
	}

	deltaTime = (timestamp - lastTimestamp); // seconds
	lastTimestamp = timestamp;

	scene.update(deltaTime);
	dot.update(deltaTime, scene.ghostCtx);
	dot.draw(scene.canvasCtx);

	requestAnimationFrame(mainLoop);
}

// Start
requestAnimationFrame(mainLoop);