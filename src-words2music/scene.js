import { Dot } from "./dot.js"
import { getWordType, addWordToCanvas } from "./words.js"
import { playDotSound, playBaseSound } from "./audio.js";
import { loadIntsruments, instruments, metroSynth } from "./audio.js";

let fontStyles = {};
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
			const wordType = getWordType(this.wordBuffer, this.sentenceBuffer);
			this.fontStyle = fontStyles[wordType] || fontStyles["default"];
			if (this.fontStyle[4] === "uppercase") {
				this.wordBuffer = this.wordBuffer.toUpperCase();
			} else if (this.fontStyle[4] === "lowercase") {
				this.wordBuffer = this.wordBuffer.toLowerCase();
			}

			addWordToCanvas(this.wordsCtx, this.wordBuffer, this, this.fontStyle);
			this.wordBuffer = "";
			this.wordNeedsUpdate = false;

			// Debugging info
			const wordTypeContainer = document.getElementById("word-type-container");
			if (wordTypeContainer) {
				wordTypeContainer.innerText = wordType;
			}
		}

		const wordsImgBuffer = this.wordsCtx.getImageData(0, 0, this.width, this.height);
		this.dot.update(deltaTime, wordsImgBuffer);

		const scrollL = (this.dot.x - this.dotXTarget);
		const scrollLi = Math.round(scrollL * this.dot.xScale);
		scrollCanvas(this.wordsCtx, scrollLi, this);
		this.dot.x -= scrollL;
		this.dot.xPrev -= scrollL;
		this.cursorX = Math.max(this.cursorX, this.dot.x * this.dot.xScale);
	}

	draw() {
		// Draw background
		this.mainCtx.putImageData(this.bgCtx.getImageData(0, 0, this.width, this.height), 0, 0);
		this.mainCtx.drawImage(this.wordsCanvas, 0, 0);

		if (this.dot.hasCollidedWithGround && !this.metronomeStarted) {
			Tone.start();
			Tone.Transport.start();
			this.metronomeStarted = true;
		}

		// Handle dot effects
		if (this.dot.hasCollidedWithGround) {
			// Ground bounce
			this.dot.colour = "red";
		} else if (this.dot.inFloatingMode) {
			// Floating mode
			this.dot.colour = "green";
		} else if (this.dot.hasCollided) {
			// Collision
			this.dot.colour = "red";
		} else {
			// Normal mode
			this.dot.colour = "blue";
		}
		// }
		this.dot.draw(this.mainCtx);
		this.mainCtx.fillStyle = "black";
		// drawCursor(this.mainCtx, this.cursorX, this.cursorY);
	}

	play() {
		if (this.dot.hasCollidedWithGround) {
			// Ground bounce
			try {
				playDotSound(this.dot, "piano", "C2", "2n", -10, "4n");
			} catch (e) {
				console.warning("Error playing sound:", e);
			}
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

function drawCursor(ctx, cursorX, cursorY) {
	ctx.beginPath();
	ctx.arc(cursorX, cursorY, 10, 0, Math.PI * 2);
	ctx.stroke();
}

function scrollCanvas(ctx, scrollLength, scene, periodic = false) {
	if (Math.abs(scrollLength) < 1) {
		return;
	}
	scrollLength = Math.round(scrollLength);

	if (scrollLength > 0) {
		// Scroll left
		// Save the current canvas
		const imgRemaining = ctx.getImageData(
			scrollLength, 0,
			ctx.canvas.width - scrollLength + 1, ctx.canvas.height);
		if (periodic) {
			const imgOob = ctx.getImageData(
				0, 0,
				scrollLength, canvas.height);
			ctx.putImageData(imgOob, ctx.canvas.width - scrollLength, 0);
		}

		ctx.putImageData(imgRemaining, 0, 0);

		// Move cursorX backwards too, so new words stay in sync
		scene.cursorX -= scrollLength;

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
		this.cursorX -= scrollLength;
	}
}

function traceWordOutline(startX, startY, word) {
	const tempCanvas = document.createElement('canvas');
	tempCanvas.width = canvas.width;
	tempCanvas.height = canvas.height;
	const tempCtx = tempCanvas.getContext('2d');

	tempCtx.font = canvasCtx.font;
	tempCtx.textBaseline = "top";
	tempCtx.fillStyle = "black";

	// Important: draw word at (0, 0) on temp canvas!
	tempCtx.fillText(word, 0, 0);

	const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
	const data = imageData.data;

	canvasCtx.fillStyle = "red";

	// Now trace based on the word drawn at (0,0), but plot at (startX, startY)
	const wordWidth = canvasCtx.measureText(word).width;

	for (let x = 0; x < wordWidth; x += 6) { // sample across the word width
		for (let y = 0; y < 50; y++) { // reasonable height to check
			const i = (y * tempCanvas.width + x) * 4;
			const r = data[i];
			const g = data[i + 1];
			const b = data[i + 2];
			const alpha = data[i + 3];

			if ((r + g + b) / 3 < 200 && alpha > 0) {
				canvasCtx.beginPath();
				canvasCtx.arc(startX + x, startY + y, 2, 0, Math.PI * 2);
				canvasCtx.fill();
				break; // only first dark pixel vertically
			}
		}
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

	Tone.Transport.scheduleRepeat((time) => {
		metroSynth.triggerAttackRelease("G2", "8n", time);
		// metroSynth.triggerAttackRelease(currentScale[0], "8n", time);
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
	}, "1m");

	// Words
	scene.sentenceBuffer = "";
	scene.wordBuffer = "";
	scene.wordNeedsUpdate = false;
	scene.clearSentenceBuffer = false;

	await loadFontStyles("assets/word-styles.json");
	scene.wordStyles = fontStyles;
	scene.fontStyle = scene.wordStyles["default"];
	const fontSize = scene.fontStyle[2][0] + Math.random() * (scene.fontStyle[2][1] - scene.fontStyle[2][0]);
	scene.wordsCtx.font = `${scene.fontStyle[0]} ${scene.fontStyle[1]} ${fontSize}px ${scene.fontStyle[3]}`;
	scene.wordsCtx.fillStyle = scene.fontStyle[5] || "black";
	scene.wordsCtx.textBaseline = "alphabetic";

	scene.cursorX = scene.width / 2;
	scene.cursorY = scene.height - 20;

	// Dot
	scene.dot.g = 12;
	scene.dot.width = scene.simWidth;
	scene.dot.height = scene.simHeight;
	scene.dot.xScale = scene.width / scene.simWidth;
	scene.dot.yScale = scene.height / scene.simHeight;
	scene.dot.rx = scene.dot.r / scene.dot.xScale; // radius in simulation units
	scene.dot.ry = scene.dot.r / scene.dot.yScale; // radius in simulation units
	const h = (scene.dot.g * 60 ** 2 / (8 * scene.bpm ** 2));
	console.log(scene.height, scene.dot.g, h, scene.bpm);
	scene.dot.y = scene.dot.height - h - scene.dot.r / scene.dot.yScale;
	console.log("y:", scene.dot.y);
	console.log("max y:", scene.dot.height - scene.dot.r / scene.dot.yScale);
	scene.dot.maxSpeed =
		Math.sqrt(2 * Math.abs(scene.dot.g) * (scene.dot.height - scene.dot.y - scene.dot.r / scene.dot.yScale));
	console.log("max speed:", scene.dot.maxSpeed);
}

async function loadFontStyles(src) {
	const response = await fetch(src);
	fontStyles = await response.json();
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