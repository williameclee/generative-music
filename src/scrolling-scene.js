import { Dot } from "./dot-physics.js"

export class ScrollingScene {
	constructor(canvas, scrollSpeed, inputElement, updateElement) {
		this.mainCtx = canvas.getContext("2d");
		this.width = canvas.width;
		this.height = canvas.height;
		this.mainCtx.textBaseline = "base";
		this.scrollSpeed = scrollSpeed;
		this.bgCanvas = document.createElement('canvas');
		this.bgCanvas.width = this.width;
		this.bgCanvas.height = this.height;
		this.bgCtx = this.bgCanvas.getContext('2d');
		this.bgCtx.fillStyle = "pink";
		this.bgCtx.fillRect(0, 0, this.width, this.height);
		this.wordsCanvas = document.createElement('canvas');
		this.wordsCanvas.width = this.width;
		this.wordsCanvas.height = this.height;
		this.wordsCtx = this.wordsCanvas.getContext('2d', { willReadFrequently: true });
		this.wordsCtx.font = "128px sans-serif";
		this.wordsCtx.fillStyle = "black";
		// document.body.appendChild(this.wordsCanvas);
		this.inputElement = inputElement;
		this.wordNeedsUpdate = false;
		this.wordBuffer = "";
		this.cursorX = 0;
		this.cursorY = canvas.height;
		this.dot = new Dot(100, this.height * 1 / 2, 5);
		this.dotXTarget = this.dot.x;
		this.lastTimestamp = null;
		this.deltaTime = null;

		this.inputElement.addEventListener("input", e => {
			const value = e.target.value;
			const lastChar = value[value.length - 1];

			if ((lastChar === " " || lastChar === "\n") && this.wordNeedsUpdate === false) {
				this.wordNeedsUpdate = true;
				input.value = "";
			} else {
				this.wordBuffer = value;
			}
		});

		this.updateScene = true;
	}

	simulate(deltaTime) {
		if (this.wordNeedsUpdate) {
			addWordToCanvas(this.wordsCtx, this.wordBuffer, this.cursorX, this.cursorY);
			this.wordBuffer = "";
			this.wordNeedsUpdate = false;
		}

		this.dot.update(deltaTime, this.wordsCtx);

		const scrollLength = Math.round(this.dot.x - this.dotXTarget);
		scrollCanvas(this.wordsCtx, scrollLength);
		this.dot.x -= scrollLength;
		this.dot.xPrev -= scrollLength;
	}

	draw() {
		// Draw background
		this.mainCtx.putImageData(this.bgCtx.getImageData(0, 0, this.width, this.height), 0, 0);
		this.mainCtx.drawImage(this.wordsCanvas, 0, 0);

		// Handle dot effects
		const soundOn = document.getElementById("toggleSound").checked;
		if (soundOn) {
			if (this.dot.inFloatingMode) {
				// Floating mode
				this.dot.colour = "green";
				this.dot.playSound(this.dot.y, true);
			} else if (this.dot.hasCollided) {
				// Collision
				this.dot.colour = "red";
				this.dot.playSound(this.dot.y, false);
			} else {
				// Normal mode
				this.dot.colour = "blue";
			}
		}
		this.dot.draw(this.mainCtx);

	}
}

function scrollCanvas(ctx, scrollLength) {
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
		const imgOob = ctx.getImageData(
			0, 0,
			scrollLength, canvas.height);

		ctx.putImageData(imgRemaining, 0, 0);
		ctx.putImageData(imgOob, ctx.canvas.width - scrollLength, 0);

		// // Move cursorX backwards too, so new words stay in sync
		// this.cursorX -= scrollLength;

		// // If cursor moves too far left, reset it
		// if (this.cursorX < 10) {
		// 	this.cursorX = 10;
		// }
	} else {
		// Scroll right
		const imgRemaining = ctx.getImageData(
			0, 0,
			ctx.canvas.width - Math.abs(scrollLength), ctx.canvas.height);
		const imgOob = ctx.getImageData(
			ctx.canvas.width - Math.abs(scrollLength), 0,
			Math.abs(scrollLength), ctx.canvas.height);

		ctx.putImageData(imgOob, 0, 0);
		ctx.putImageData(imgRemaining, Math.abs(scrollLength), 0);
		// this.cursorX -= scrollLength;
		// if (this.cursorX > this.width - 10) {
		// 	this.cursorX = this.width - 10;
		// }
	}
}

function addWordToCanvas(ctx, word, cursorX = 0, cursorY = ctx.canvas.height) {
	if (word.trim() === "") return;

	// Choose a font dynamically — here's a simple alternating scheme
	// const isEvenWord = wordCounter % 2 === 0;
	// canvasCtx.font = isEvenWord ? "64px serif" : "64px monospace";

	const wordWidth = ctx.measureText(word).width;
	const lineHeight = parseInt(ctx.font, 10) * 1.2; // Adjust line height based on font size

	const maxWidth = ctx.canvas.width - 10;
	if (cursorX + wordWidth > maxWidth) {
		cursorX = 0;
		cursorY += lineHeight;
	}

	ctx.fillStyle = "black";
	ctx.fillText(word, cursorX, cursorY);

	cursorX += wordWidth + ctx.measureText(" ").width;
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
