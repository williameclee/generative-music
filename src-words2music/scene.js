import { Dot } from "./dot.js"
import { loadFontStyles, addWord2canvas, addWord2canvasWbb, loadWordBuffers, wordBuffers, loadCustomQuestions, customQuestions, printSentence2canvas } from "./words.js"
import { playDotSound, playChord } from "./audio.js";
import { loadIntsruments, piano, metroSynth, glitchSynth, teleportSynth } from "./audio.js";
import { loadScales, loadScaleNotes, loadTransitionMatrices, loadChordNotes, getNextChord, getChordNotes } from "./markov-chain.js";

let currentScaleNotes = [];
let currentChordNotes = [];
let chordTransId = null;
let chordLoopId = null;

export class ScrollingScene {
	constructor(canvas, inputElement) {
		this.mainCtx = canvas.getContext("2d");
		this.width = window.innerWidth / 2;
		this.height = window.innerHeight / 2;
		canvas.width = this.width;
		canvas.height = this.height;
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
	}

	simulate(deltaTime) {
		if (this.wordNeedsUpdate) {
			addWord2canvasWbb(this);
			this.wordBuffer = "";
			this.wordNeedsUpdate = false;
			// 
			this.lastUpdateTime = Tone.now();
			this.hasPrintedSentence = false;
		}

		const idleTime = Tone.now() - this.lastUpdateTime;
		if ((idleTime > 7 || this.justStarted) && this.dot.u < 0.1 && !this.hasPrintedSentence) {
			switchQuestion(this);
		}
		this.wordsCtx.clearRect(0, 0,
			this.wordsCtx.canvas.width, this.wordsCtx.canvas.height);

		for (let i = 0; i < this.wordBufferNames.length; i++) {
			const canvasName = wordBuffers[this.wordBufferNames[i]]["canvas"];
			this.wordsCtx.drawImage(this[canvasName], 0, 0);
		}

		const wordsImgBuffer = this.wordsCtx.getImageData(0, 0, this.width, this.height);
		this.dot.update(deltaTime, wordsImgBuffer, Tone.now() - this.lastUpdateTime);

		const scrollLi = Math.round(
			(this.dot.x - this.dotXTarget) * this.dot.xScale);
		const scrollL = scrollLi / this.dot.xScale;
		scrollCanvas(this.wordsCtx, scrollLi);
		this.dot.x -= scrollL;
		this.dot.xPrev -= scrollL;

		for (let i = 0; i < this.wordBufferNames.length; i++) {
			const scrollFactor = wordBuffers[this.wordBufferNames[i]]["scrollSpeed"] || 1.0;
			const sctollLengthLayeri = Math.round(scrollLi * scrollFactor);
			scrollCanvas(this[this.wordBufferNames[i]],
				sctollLengthLayeri);
			scrollCanvas(this[wordBuffers[this.wordBufferNames[i]]["boundingBox"] + "Ctx"],
				sctollLengthLayeri);
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
			this.dot.colour = "pink";
		} else if (this.dot.inFloatingMode) {
			// Floating mode
			this.dot.colour = "pink";
		} else if (this.dot.hasCollided) {
			// Collision
			this.dot.colour = "red";
		} else {
			// Normal mode
			this.dot.colour = "black";
		}
		// }
		this.dot.draw(this.mainCtx);
	}

	play() {
		if (this.dot.hasCollidedWithGround) {
			// Ground bounce
			try {
				playDotSound(this.dot, "piano",
					currentChordNotes[0].replace("4", "2").replace("3", "2"),
					"2n", -10, "4n");
			} catch (e) {
				console.warning("Error playing sound:", e);
			}
		} else if (this.dot.inSlowMo) {
			playDotSound(this.dot, teleportSynth,
				currentScaleNotes, "2n", -10, "8n");
			this.lastUpdateTime = Tone.now();
		} else if (this.dot.inFloatingMode) {
			playDotSound(this.dot, glitchSynth,
				"all", "16n", -20, "16n");
			this.lastUpdateTime = Tone.now();
		} else if (this.dot.hasCollided) {
			// Collision
			playDotSound(this.dot, "piano", currentChordNotes, "8n", 0, "8n");
			this.lastUpdateTime = Tone.now();
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
	scrollLength = Math.round(scrollLength);
	if (Math.abs(scrollLength) < 1) {
		return;
	}

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
		scene.lastUpdateTime = Tone.now();
	});

	// Scene & audio
	scene.bpm = bpm;
	scene.lastTimestamp = null;
	scene.deltaTime = null;
	scene.metronomeStarted = false;

	Tone.Transport.bpm.value = scene.bpm;
	Tone.Transport.timeSignature = 4;
	Tone.Transport.loop = false;

	await loadIntsruments();

	// Metronome
	Tone.Transport.clear();
	Tone.start();
	Tone.Transport.scheduleRepeat((time) => {
		metroSynth.volume.value = -10;
		metroSynth.triggerAttackRelease(
			"G2", "8n", time);
	}, "4n");
	Tone.Transport.scheduleRepeat(() => {
		const pos = Tone.Transport.position.split('.')[0];
		// show on screen
		const metronomeContainer = document.getElementById("metronome-container");
		if (metronomeContainer) {
			metronomeContainer.innerText = `Metronome: ${pos}`;
		}
	}, "8n");

	await loadScales("assets/scales.json");
	await loadTransitionMatrices("assets/chord-transitions.json");
	await loadChordNotes("assets/chord-notes.json");
	scene.scale = {};
	scene.scale.currentScale = "C major";
	scene.scale.currentChord = "I";
	scene.scale.root = "C";
	scene.scale.scaleType = "major";
	scene.scale.refStyle = "Bach";
	currentScaleNotes = loadScaleNotes(scene.currentScale);
	// scheduleChordProgression(scene);

	// Words
	await loadFontStyles("assets/word-styles.json");
	await loadWordBuffers("assets/word-buffers.json", scene);
	scene.wordBufferNames = Object.keys(wordBuffers).sort((a, b) => wordBuffers[a].order - wordBuffers[b].order);
	await loadCustomQuestions("assets/custom-questions.json");
	console.log("Custom questions loaded:", customQuestions);
	scene.sentenceBuffer = "";
	scene.wordBuffer = "";
	scene.wordNeedsUpdate = false;
	scene.clearSentenceBuffer = false;
	scene.updateScene = false;
	scene.hasPrintedSentence = false;

	scene.lastQuickAudioTime = 0;
	scene.lastUpdateTime = 0;
	scene.justStarted = true;
	scene.questionHistory = [];
	// show on screen
	// document.getElementById("canvas-container").appendChild(scene.nounBBCanvas);

	// Dot
	scene.dot.width = scene.simWidth;
	scene.dot.height = scene.simHeight;
	scene.dot.xScale = scene.width / scene.simWidth;
	scene.dot.yScale = scene.height / scene.simHeight;
	scene.dot.rx = scene.dot.r / scene.dot.xScale; // radius in simulation units
	scene.dot.ry = scene.dot.r / scene.dot.yScale; // radius in simulation units
	const h = (scene.dot.g * 60 ** 2 / (8 * scene.bpm ** 2));
	scene.dot.y = scene.dot.height - h - scene.dot.r / scene.dot.yScale;
	calculateMaxSpeed(scene.dot, scene.bpm);
}

function scheduleChordProgression(scene) {
	if (chordTransId !== null) {
		Tone.Transport.clear(chordTransId);
	}
	chordTransId = Tone.Transport.scheduleRepeat(() => {
		// Markov chain chord progression
		scene.scale.currentChord = getNextChord(scene.scale.currentChord, scene.scale.scaleType, scene.scale.refStyle);
		currentChordNotes = getChordNotes(scene.scale.currentChord, scene.scale.scaleType, `${scene.scale.root}4`, true);
		console.log(`New chord: ${scene.scale.currentChord} (${currentChordNotes.join(", ")})`);
		// const scaleContainer = document.getElementById("scale-container");
		// if (scaleContainer) {
		// 	scaleContainer.innerText = `Scale: ${scaleName}`;
		// }
	}, "2m");
}

function getNewQuestion(scene) {
	let questionId;
	do {
		questionId = Math.floor(Math.random() * customQuestions.length);
	} while (scene.questionHistory.includes(questionId));

	// Update the history buffer
	scene.questionHistory.push(questionId);
	if (scene.questionHistory.length > 3) {
		scene.questionHistory.shift(); // Remove the oldest question
	}

	return questionId;
}

function switchQuestion(scene) {
	const questionId = getNewQuestion(scene);
	printSentence2canvas(customQuestions[questionId]["content"], scene);
	scene.scale.root = customQuestions[questionId]["root"];
	scene.scale.scaleType = customQuestions[questionId]["scale"];
	scene.scale.refStyle = customQuestions[questionId]["style"];
	scene.scale.currentScale = `${scene.scale.root} ${scene.scale.scaleType}`;
	scene.scale.instrument = customQuestions[questionId]["instrument"];

	currentScaleNotes = loadScaleNotes(scene.scale.currentScale);
	currentChordNotes = getChordNotes(
		scene.scale.currentChord, scene.scale.scaleType, `${scene.scale.root}4`, true);
	const bpm = customQuestions[questionId]["bpm"];
	if (bpm) {
		Tone.Transport.bpm.value = bpm;
		scene.bpm = bpm;
		calculateMaxSpeed(scene.dot, scene.bpm);
	}

	Tone.Transport.clear();
	const timeSig = customQuestions[questionId]["time signature"];
	if (timeSig) {
		scene.timeSig = timeSig;
		Tone.Transport.timeSignature = timeSig;
		scheduleChordProgression(scene);
	}

	if (chordLoopId !== null) {
		Tone.Transport.clear(chordLoopId);
	}
	chordLoopId = Tone.Transport.scheduleRepeat((time) => {
		// Update the chord using the Markov chain
		const baseChordNotes = getChordNotes(scene.scale.currentChord, scene.scale.scaleType, `${scene.scale.root}2`, false);

		// Play the chord with the selected instrument
		playChord(baseChordNotes, time, scene.scale.instrument);
	}, "1m"); // Trigger every measure

	console.log(`New question (BPM: ${bpm}, ${timeSig}/4): scale ${scene.scale.currentScale} (${currentScaleNotes.join(", ")}), chord: ${scene.scale.currentChord} (${currentChordNotes.join(", ")})`);
	scene.inputElement.focus();
	scene.hasPrintedSentence = true;
	scene.justStarted = false;
}

function calculateMaxSpeed(dot, bpm) {
	const h = (dot.g * 60 ** 2 / (8 * bpm ** 2));
	const y = dot.height - h - dot.r / dot.yScale;
	dot.maxSpeed = Math.sqrt(2 * Math.abs(dot.g) * (dot.height - y - dot.r / dot.yScale));
}