import { Dot } from "./dot.js"
import { loadFontStyles, addWordToCanvas, loadWordBuffers, wordBuffers } from "./words.js"
import { playDotSound } from "./audio.js";
import { loadIntsruments, instruments, metroSynth } from "./audio.js";

let scales = {};  // where all scales will be stored
let currentScale = [];  // active scale during playback

export class ScrollingScene {
	constructor(canvas, inputElement) {
		this.mainCtx = canvas.getContext("2d");
		this.width = canvas.width;
		this.height = canvas.height;
		this.simHeight = 2;
		this.simWidth = 5;
		this.bgCanvas = document.createElement("canvas");
		this.bgCanvas.width = this.width;
		this.bgCanvas.height = this.height;
		this.bgCtx = this.bgCanvas.getContext("2d", { willReadFrequently: true });
		this.bgCtx.fillStyle = "pink";
		this.bgCtx.fillRect(0, 0, this.width, this.height);
		this.wordsCanvas = document.createElement("canvas");
		this.wordsCanvas.width = this.width * 5;
		this.wordsCanvas.height = this.height;
		this.wordsCtx = this.wordsCanvas.getContext("2d", { willReadFrequently: true });
		this.inputElement = inputElement;
		this.dot = new Dot(1, 5);
		this.dotXTarget = this.dot.x; // where the dot should be
		this.clearSentenceBuffer = false;
		this.updateScene = false;
	}

	simulate(deltaTime) {
		if (this.wordNeedsUpdate) {
			addWordToCanvas(this);
			this.wordBuffer = "";
			this.wordNeedsUpdate = false;
		}
		this.wordsCtx.clearRect(0, 0,
			this.wordsCtx.canvas.width, this.wordsCtx.canvas.height);

		for (let i = 0; i < this.wordBufferNames.length; i++) {
			const canvasName = wordBuffers[this.wordBufferNames[i]]["canvas"];
			this.wordsCtx.drawImage(this[canvasName], 0, 0);
		}

		const wordsImgBuffer = this.wordsCtx.getImageData(0, 0, this.width, this.height);
		this.dot.update(deltaTime, wordsImgBuffer);

		const scrollLi = Math.round(
			(this.dot.x - this.dotXTarget) * this.dot.xScale);
		const scrollL = scrollLi / this.dot.xScale;
		scrollCanvas(this.wordsCtx, scrollLi, this.periodic);
		this.dot.x -= scrollL;
		this.dot.xPrev -= scrollL;

		for (let i = 0; i < this.wordBufferNames.length; i++) {
			const cursorName = wordBuffers[this.wordBufferNames[i]]["cursor"][0];
			const scrollFactor = wordBuffers[this.wordBufferNames[i]]["scrollSpeed"] || 1.0;
			const sctollLengthLayeri = Math.round(scrollLi * scrollFactor);
			scrollCanvas(this[this.wordBufferNames[i]], sctollLengthLayeri, this.periodic);
			this[cursorName] -= sctollLengthLayeri;
			this[cursorName] = Math.max(this[cursorName], this.width / 2);
		}
	}

	draw() {
		// Draw background
		this.mainCtx.putImageData(this.bgCtx.getImageData(0, 0, this.width, this.height), 0, 0);
		this.mainCtx.drawImage(this.wordsCanvas, 0, 0);

		// Handle dot effects
		if (this.dot.hasCollidedWithGround) {
			// Ground bounce
			this.dot.colour = "red";
		} else if (this.dot.inSlowMo) {
			// Floating mode
			this.dot.colour = "green";
		} else if (this.dot.inFloatingMode) {
			// Floating mode
			this.dot.colour = "orange";
		} else if (this.dot.hasCollided) {
			// Collision
			this.dot.colour = "red";
		} else {
			// Normal mode
			this.dot.colour = "black";
		}
		// }
		this.dot.draw(this.mainCtx);
		// drawCursor(this.mainCtx, this.cursorX, this.cursorY, "black");
		// drawCursor(this.mainCtx, this.adjCursorX, this.adjCursorY, "red");
	}

	play() {
		if (this.dot.hasCollidedWithGround) {
			// Ground bounce
			try {
				playDotSound(this.dot, "piano", "C2", "2n", -10, "4n");
			} catch (e) {
				console.warning("Error playing sound:", e);
			}
		} else if (this.dot.inSlowMo) {
			// Slow falling mode
			playDotSound(this.dot, new Tone.MembraneSynth().toDestination(),
				currentScale, "4n", -20, "8n");
		} else if (this.dot.inFloatingMode) {
			// Floating mode
			playDotSound(this.dot, new Tone.MembraneSynth().toDestination(),
				"all", "16n", -20, "16n");
		} else if (this.dot.hasCollided) {
			// Collision
			playDotSound(this.dot, "piano", currentScale, "8n", 0, "8n");
		}
	}
}

function drawCursor(ctx, x, y, colour = "black") {
	ctx.strokeStyle = colour;
	ctx.beginPath();
	ctx.arc(x, y, 10, 0, Math.PI * 2);
	ctx.stroke();
}

function scrollCanvas(ctx, scrollLength, periodic = false) {
	if (Math.abs(scrollLength) < 1) {
		return;
	}
	scrollLength = Math.round(scrollLength);

	if (scrollLength > 0) {
		// Scroll left
		// Save the current canvas
		const imgRemaining = ctx.getImageData(
			scrollLength, 0,
			ctx.canvas.width - scrollLength, ctx.canvas.height);
		if (periodic) {
			const imgOob = ctx.getImageData(
				0, 0,
				scrollLength, canvas.height);
			ctx.putImageData(imgOob, ctx.canvas.width - scrollLength, 0);
		}

		ctx.putImageData(imgRemaining, 0, 0);

	} else {
		// Scroll right
		const imgRemaining = ctx.getImageData(
			0, 0,
			ctx.canvas.width - Math.abs(scrollLength), ctx.canvas.height);
		if (periodic) {
			const imgOob = ctx.getImageData(
				ctx.canvas.width - Math.abs(scrollLength), 0,
				Math.abs(scrollLength), ctx.canvas.height);
			ctx.putImageData(imgOob, 0, 0);
		}

		ctx.putImageData(imgRemaining, Math.abs(scrollLength), 0);
	}
}


export async function setupScene(scene, bpm = 120) {
	// User input
	scene.inputElement.addEventListener("input", e => {
		const value = e.target.value;
		const lastChar = value[value.length - 1];

		if (scene.clearSentenceBuffer) {
			scene.sentenceBuffer = "";
			scene.clearSentenceBuffer = false;
		}

		if ((lastChar === " " || lastChar === "\n")) {
			scene.wordNeedsUpdate = true;
			scene.sentenceBuffer = scene.sentenceBuffer + " " + value;
			input.value = "";
			const punctuationRegex = /[.,!?;:]/;
			if (punctuationRegex.test(scene.wordBuffer)) {
				scene.clearSentenceBuffer = true;
			}
		} else {
			scene.wordBuffer = value;
		}

		// Debugging info
		const wordBufferContainer = document.getElementById("word-buffer-container");
		if (wordBufferContainer) {
			wordBufferContainer.innerText = `Word: ${scene.wordBuffer}`;
		}
		const sentenceBufferContainer = document.getElementById("sentence-buffer-container");
		if (sentenceBufferContainer) {
			sentenceBufferContainer.innerText = `Sentence: ${scene.sentenceBuffer}`;
		}
	});

	scene.inputElement.addEventListener("keydown", (e) => {
		if (!(e.key === "Backspace" || e.key === "Delete")) {
			return;
		}
		playDotSound(null, "piano", "C7", "4n", -10, "8n");
	});

	// Scene & audio
	scene.bpm = bpm;
	scene.lastTimestamp = null;
	scene.deltaTime = null;
	scene.metronomeStarted = false;

	Tone.Transport.bpm.value = scene.bpm;
	Tone.Transport.timeSignature = 4;
	Tone.Transport.loop = false;

	const loaded = await SampleLibrary.load({
		instruments: ['piano', 'bass-electric', 'bassoon', 'cello', 'clarinet', 'contrabass', 'french-horn', 'guitar-acoustic', 'guitar-electric', 'guitar-nylon', 'harp', 'organ', 'saxophone', 'trombone', 'trumpet', 'tuba', 'violin'],
		baseUrl: "src/tonejs-instruments/samples/",
	})
	Object.assign(instruments, loaded);
	console.log("SampleLibrary loaded: ", Object.keys(instruments));
	await Tone.loaded();

	// Metronome
	Tone.start();
	Tone.Transport.scheduleRepeat((time) => {
		metroSynth.triggerAttackRelease("G2", "8n", time);
	}, "4n");
	Tone.Transport.scheduleRepeat(() => {
		const pos = Tone.Transport.position.split('.')[0];
		document.getElementById("metronome-container").textContent = `Metronome: ${pos}`;
	}, "8n");

	await loadScales("assets/scales.json");
	Tone.Transport.scheduleRepeat(() => {
		const scaleName = pickRandomScale();
		const scaleContainer = document.getElementById("scale-container");
		scaleContainer.innerText = `Scale: ${scaleName}`;
		console.log("New scale:", currentScale);
	}, "2m");

	// Words
	await loadFontStyles("assets/word-styles.json");
	await loadWordBuffers("assets/word-buffers.json", scene);
	scene.wordBufferNames = Object.keys(wordBuffers).sort((a, b) => wordBuffers[a].order - wordBuffers[b].order);
	scene.sentenceBuffer = "";
	scene.wordBuffer = "";
	scene.wordNeedsUpdate = false;
	scene.clearSentenceBuffer = false;
	// show on screen
	// document.getElementById("canvas-container").appendChild(this.wordsCanvas);

	// Periodic boundary
	scene.periodic = false;

	// Dot
	scene.dot.width = scene.simWidth;
	scene.dot.height = scene.simHeight;
	scene.dot.xScale = scene.width / scene.simWidth;
	scene.dot.yScale = scene.height / scene.simHeight;
	scene.dot.rx = scene.dot.r / scene.dot.xScale; // radius in simulation units
	scene.dot.ry = scene.dot.r / scene.dot.yScale; // radius in simulation units
	const h = (scene.dot.g * 60 ** 2 / (8 * scene.bpm ** 2));
	scene.dot.y = scene.dot.height - h - scene.dot.r / scene.dot.yScale;
	scene.dot.maxSpeed =
		Math.sqrt(2 * Math.abs(scene.dot.g) * (scene.dot.height - scene.dot.y - scene.dot.r / scene.dot.yScale));
}

async function loadScales(src = "assets/scales.json") {
	const response = await fetch(src);
	scales = await response.json();
	console.log("Loaded scales:", Object.keys(scales));
}

function pickRandomScale() {
	const scaleNames = Object.keys(scales);
	const randomName = scaleNames[Math.floor(Math.random() * scaleNames.length)];
	currentScale = scales[randomName];
	return randomName;
	console.log("New scale:", randomName, currentScale);
}