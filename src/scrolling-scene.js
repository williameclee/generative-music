export class ScrollingScene {
	constructor(canvas, scrollSpeed, inputElement) {
		this.canvasCtx = canvas.getContext("2d");
		this.canvasCtx.font = "64px sans-serif";
		this.canvasCtx.fillStyle = "white";
		this.canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
		this.canvasCtx.fillStyle = "black";
		this.canvasCtx.textBaseline = "bottom";
		this.scrollSpeed = scrollSpeed;
		this.ghostCanvas = document.createElement('canvas');
		this.ghostCtx = this.ghostCanvas.getContext('2d');
		this.ghostCanvas.width = canvas.width;
		this.ghostCanvas.height = canvas.height;
		this.backgroundImage = null;
		this.inputElement = inputElement;
		this.wordNeedsUpdate = false;
		this.wordBuffer = "";
		this.cursorX = 0;
		this.cursorY = canvas.height;

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
	}

	update(deltaTime) {
		if (this.backgroundImage) {
			this.canvasCtx.putImageData(this.backgroundImage, 0, 0);
		}
		if (this.wordNeedsUpdate) {
			addWordToCanvas(this.wordBuffer, this.canvasCtx, this.cursorX, this.cursorY);
			this.wordBuffer = "";
			this.wordNeedsUpdate = false;
		}
		scrollCanvasLeft(deltaTime, this.canvasCtx, this.scrollSpeed, this.cursorX);
		this.backgroundImage = this.canvasCtx.getImageData(0, 0, this.canvasCtx.canvas.width, this.canvasCtx.canvas.height);
		this.ghostCtx.putImageData(this.backgroundImage, 0, 0);
	}

	addWordToCanvas(word, canvasCtx, cursorX = 0, cursorY = canvasCtx.canvas.height) {
		if (word.trim() === "") return;

		// Choose a font dynamically — here's a simple alternating scheme
		// const isEvenWord = wordCounter % 2 === 0;
		// canvasCtx.font = isEvenWord ? "64px serif" : "64px monospace";

		const wordWidth = canvasCtx.measureText(word).width;
		const lineHeight = parseInt(canvasCtx.font, 10) * 1.2; // Adjust line height based on font size

		const maxWidth = canvasCtx.canvas.width - 10;
		if (cursorX + wordWidth > maxWidth) {
			cursorX = 0;
			cursorY += lineHeight;
		}

		canvasCtx.fillStyle = "black";
		canvasCtx.fillText(word, cursorX, cursorY);

		cursorX += wordWidth + canvasCtx.measureText(" ").width;
	}
}

function addWordToCanvas(word, canvasCtx, cursorX = 0, cursorY = canvasCtx.canvas.height) {
	if (word.trim() === "") return;

	// Choose a font dynamically — here's a simple alternating scheme
	// const isEvenWord = wordCounter % 2 === 0;
	// canvasCtx.font = isEvenWord ? "64px serif" : "64px monospace";

	const wordWidth = canvasCtx.measureText(word).width;
	const lineHeight = parseInt(canvasCtx.font, 10) * 1.2; // Adjust line height based on font size

	const maxWidth = canvasCtx.canvas.width - 10;
	if (cursorX + wordWidth > maxWidth) {
		cursorX = 0;
		cursorY += lineHeight;
	}

	canvasCtx.fillStyle = "black";
	canvasCtx.fillText(word, cursorX, cursorY);

	cursorX += wordWidth + canvasCtx.measureText(" ").width;
}

function scrollCanvasLeft(deltaTime, canvasCtx, scrollSpeed = 1, cursorX = 0) {
	const scrollLength = Math.round(scrollSpeed * deltaTime);
	if (scrollLength < 1) {
		return;
	}
	// Save the current canvas
	const imageDataLeft = canvasCtx.getImageData(scrollLength, 0, canvas.width - scrollLength, canvas.height);
	const imageDataScrolled = canvasCtx.getImageData(0, 0, scrollLength, canvas.height);

	// Clear the canvas
	canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

	// Draw the saved content shifted left
	canvasCtx.putImageData(imageDataLeft, 0, 0);
	// Make the background periodic
	canvasCtx.putImageData(imageDataScrolled, canvas.width - scrollLength, 0);

	// Move cursorX backwards too, so new words stay in sync
	cursorX -= scrollLength;

	// If cursor moves too far left, reset it
	if (cursorX < 10) {
		cursorX = 10;
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
