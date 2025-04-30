import nlp from 'https://esm.sh/compromise';


let fontStyles = {};
export async function loadFontStyles(src = "assets/word-styles.json") {
	const response = await fetch(src);
	fontStyles = await response.json();
}

export let wordBuffers = [];

export async function loadWordBuffers(src = "assets/word-buffers.json", scene) {
	const response = await fetch(src);
	wordBuffers = await response.json();

	const bufferNames = Object.keys(wordBuffers).sort((a, b) => wordBuffers[a].order - wordBuffers[b].order);

	if (!scene) {
		return;
	}

	for (let i = 0; i < bufferNames.length; i++) {
		// main buffer
		const bufferName = bufferNames[i];
		const canvasName = wordBuffers[bufferName]["canvas"];
		scene[canvasName] = document.createElement("canvas");
		scene[canvasName].width = scene.width * 5;
		scene[canvasName].height = scene.height;
		scene[bufferName] = scene[canvasName].getContext("2d", { willReadFrequently: true });
		// bounding box buffer
		const bbName = wordBuffers[bufferName]["boundingBox"];
		scene[bbName + "Canvas"] = document.createElement("canvas");
		// console.log("Creating canvas:", bbName + "Canvas");
		scene[bbName + "Canvas"].width = scene[canvasName].width;
		scene[bbName + "Canvas"].height = scene[canvasName].height;
		scene[bbName + "Ctx"] = scene[bbName + "Canvas"].getContext("2d", { willReadFrequently: true });
	}

}

export let customQuestions = [];
export async function loadCustomQuestions(src = "assets/cusotm-questions.json") {
	const response = await fetch(src);
	customQuestions = await response.json();
}

export function addWord2canvas(scene, randomiseFontSize = true) {
	if (scene.wordBuffer.trim() === "") return;

	const wordType = getWordType(scene.wordBuffer, scene.sentenceBuffer);

	const fontInfo = fontStyles[wordType] || fontStyles["default"];
	const fontStyle = fontInfo["style"] || fontStyles["default"]["style"];
	if (fontStyle[4] === "uppercase") {
		scene.wordBuffer = scene.wordBuffer.toUpperCase();
	} else if (fontStyle[4] === "lowercase") {
		scene.wordBuffer = scene.wordBuffer.toLowerCase();
	}


	let fontSize;
	if (randomiseFontSize) {
		fontSize = (fontStyle[2][0] + Math.random() * (fontStyle[2][1] - fontStyle[2][0]))
			* scene.width;
	} else {
		fontSize = fontStyle[2] * scene.width;
	}

	const ctx = scene[fontInfo["buffer"]] || scene.wordsCtx;
	ctx.font = `${fontStyle[0]} ${fontStyle[1]} ${fontSize}px ${fontStyle[3]}`;
	ctx.fillStyle = fontStyle[5] || "black";
	ctx.textBaseline = fontStyle[6] || "alphebatic";

	const cursor = wordBuffers[fontInfo["buffer"]]["cursor"];
	const offsetRatio = fontInfo["offsetRatio"] || [1.0, 0.0];

	const wordWidth = ctx.measureText(scene.wordBuffer).width;

	if (scene[cursor[0]] + wordWidth > ctx.canvas.width) {
		console.log("Not enough space for word:", scene.wordBuffer, "at", scene[cursor[0]], scene[cursor[1]]);
		return;
	}

	const metrics = ctx.measureText(scene.wordBuffer);
	const lineHeight = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
	if (wordType !== "plural") {
		ctx.fillText(scene.wordBuffer, scene[cursor[0]], scene[cursor[1]] - lineHeight * offsetRatio[1]);
	} else {
		ctx.fillText(scene.wordBuffer, scene[cursor[0]], scene[cursor[1]]);
		ctx.fillText(
			scene.wordBuffer.replace(/[.,\?\/#!$%\^&\*;:{}=\-_`~()]/g, ''),
			scene[cursor[0]], scene[cursor[1]] - lineHeight);
	}

	scene[cursor[0]] += wordWidth * offsetRatio[0] + ctx.measureText(" ").width;

	// Debugging info
	const wordTypeContainer = document.getElementById("word-type-container");
	if (wordTypeContainer) {
		wordTypeContainer.innerText = wordType;
	}
}

export async function addWord2canvasWbb(scene, randomiseFontSize = true) {
	if (scene.wordBuffer.trim() === "") return;

	const wordType = getWordType(scene.wordBuffer, scene.sentenceBuffer);

	const fontInfo = fontStyles[wordType] || fontStyles["default"];
	const fontStyle = fontInfo["style"] || fontStyles["default"]["style"];
	if (fontStyle[4] === "uppercase") {
		scene.wordBuffer = scene.wordBuffer.toUpperCase();
	} else if (fontStyle[4] === "lowercase") {
		scene.wordBuffer = scene.wordBuffer.toLowerCase();
	}


	let fontSize;
	if (randomiseFontSize) {
		fontSize = (fontStyle[2][0] + Math.random() * (fontStyle[2][1] - fontStyle[2][0])) * scene.width;
	} else {
		fontSize = fontStyle[2] * scene.width;
	}

	const ctx = scene[fontInfo["buffer"]] || scene.wordsCtx;
	const bboxCtx = scene[wordBuffers[fontInfo["buffer"]]["boundingBox"] + "Ctx"];
	ctx.font = `${fontStyle[0]} ${fontStyle[1]} ${fontSize}px ${fontStyle[3]}`;
	ctx.fillStyle = fontStyle[5] || "black";
	ctx.textBaseline = fontStyle[6] || "alphebatic";
	const priority = fontInfo["priority"] || "right";

	const metrics = ctx.measureText(scene.wordBuffer + " ");
	const wordWidth = metrics.width;
	const wordHeight = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;

	const yOffset = wordBuffers[fontInfo["buffer"]]["cursorOffset"][1];

	// Find available space
	if (wordType === "plural") {

		const availableSpace = findAvailableSpace(
			bboxCtx,
			wordWidth,
			wordHeight * 2,
			ctx.canvas.width,
			ctx.canvas.height,
			scene.width,
			yOffset,
			priority
		);

		if (availableSpace) {
			// Place the word
			ctx.fillText(scene.wordBuffer, availableSpace.x, availableSpace.y);
			ctx.fillText(
				scene.wordBuffer.replace(/[.,\?\/#!$%\^&\*;:{}=\-_`~()]/g, ''),
				availableSpace.x, availableSpace.y - wordHeight);

			// Update the collision buffer
			addBoundingBoxToBuffer(
				bboxCtx,
				availableSpace.x,
				availableSpace.y,
				wordWidth,
				wordHeight * 2,
			);
		} else {
			console.warn("No available space for word:", scene.wordBuffer);
		}
	} else {
		const availableSpace = findAvailableSpace(
			bboxCtx,
			wordWidth,
			wordHeight,
			ctx.canvas.width,
			ctx.canvas.height,
			scene.width,
			yOffset,
			priority
		);

		if (availableSpace) {
			// Place the word
			ctx.fillText(scene.wordBuffer, availableSpace.x, availableSpace.y);

			// Update the collision buffer
			addBoundingBoxToBuffer(
				bboxCtx,
				availableSpace.x,
				availableSpace.y,
				wordWidth,
				wordHeight,
			);
		} else {
			console.warn("No available space for word:", scene.wordBuffer);
		}
	}

	// Debugging info
	const wordTypeContainer = document.getElementById("word-type-container");
	if (wordTypeContainer) {
		wordTypeContainer.innerText = wordType;
	}
}

function addBoundingBoxToBuffer(ctx, x, y, width, height) {
	ctx.fillStyle = "black"; // Use black to mark occupied areas
	ctx.fillRect(x, y, width, -height);
}

function isSpaceAvailable(ctx, x, y, width, height) {
	const imageData = ctx.getImageData(x, y, width, -height);
	const pixels = imageData.data;

	// Check if any pixel is not transparent (i.e., already occupied)
	for (let i = 0; i < pixels.length; i += 4) {
		if (pixels[i] !== 0 || pixels[i + 1] !== 0 || pixels[i + 2] !== 0 || pixels[i + 3] !== 0) {
			return false; // Space is occupied
		}
	}
	return true; // Space is available
}

function findAvailableSpace(ctx, wordWidth, wordHeight, canvasWidth, canvasHeight, baseCanvasWidth = 0, yOffset = 0, priority = "right") {
	const step = 20; // Step size for searching
	if (priority === "right" || priority === "up" || priority === "up right") {
		let x = baseCanvasWidth, y = canvasHeight - yOffset;

		while (x < canvasWidth && (wordHeight > canvasHeight || y > wordHeight)) {
			if (isSpaceAvailable(ctx, x, y, wordWidth, wordHeight)) {
				return { x, y }; // Found available space
			}

			// Move based on priority
			if (priority === "right") {
				x += step;
				if (x + wordWidth > canvasWidth) {
					x = baseCanvasWidth;
					y -= step;
				}
			} else if (priority === "up") {
				y -= step;
				if (wordHeight <= canvasHeight && y < wordHeight) {
					y = canvasHeight - yOffset;
					x += step;
				}
			} else if (priority === "up right") {
				x += step;
				if (x + wordWidth > canvasWidth) {
					x = baseCanvasWidth;
					y -= step;
				}
				y -= step;
				if (wordHeight <= canvasHeight && y < wordHeight) {
					y = canvasHeight - yOffset;
					x += step;
				}
			}
		}
	} else if (priority === "down") {
		let x = baseCanvasWidth, y = wordHeight + yOffset;

		while (x < canvasWidth && (wordHeight > canvasHeight || y < canvasHeight - wordHeight)) {
			if (isSpaceAvailable(ctx, x, y, wordWidth, wordHeight)) {
				return { x, y }; // Found available space
			}

			// Move based on priority
			y += step;
			if (wordHeight <= canvasHeight && y > canvasHeight - wordHeight) {
				y = wordHeight + yOffset;
				x += step;
			}
		}
	} else {
		console.error(`Invalid priority: ${priority}`);
	}

	return null; // No available space found
}

export function printSentence2canvas(sentence, scene, wordType = "custom-sentence") {
	const fontInfo = fontStyles[wordType];
	const fontStyle = fontInfo["style"] || fontStyles["default"]["style"];
	// console.log("Font info:", fontInfo, fontStyle);
	if (fontStyle[4] === "uppercase") {
		scene.wordBuffer = scene.wordBuffer.toUpperCase();
	} else if (fontStyle[4] === "lowercase") {
		scene.wordBuffer = scene.wordBuffer.toLowerCase();
	}

	const fontSize = fontStyle[2][0] * scene.width;

	const ctx = scene[fontInfo["buffer"]] || scene.wordsCtx;
	ctx.font = `${fontStyle[0]} ${fontStyle[1]} ${fontSize}px ${fontStyle[3]}`;
	ctx.fillStyle = fontStyle[5] || "black";
	ctx.textBaseline = fontStyle[6] || "alphebatic";

	// const wordWidth = ctx.measureText(scene.wordBuffer).width;

	const metrics = ctx.measureText(sentence[0]);
	const lineHeight = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;

	var cursorY = scene.height * 0.3;
	var maxWidth = 0;
	for (let i = 0; i < sentence.length; i++) {
		const phrase = sentence[i];
		const phraseWidth = ctx.measureText(phrase).width;
		if (phraseWidth > maxWidth) {
			maxWidth = phraseWidth;
		}
	}
	const cursorX = Math.round((scene.width - maxWidth) / 2);

	for (let i = 0; i < sentence.length; i++) {
		const phrase = sentence[i];
		ctx.fillText(phrase, cursorX, cursorY);
		cursorY += lineHeight * 1.1;
	}
}

// Find which word type a word is
export function getWordType(word, sentence = "") {
	if (sentence.length === 0) {
		sentence = word;
	}
	word = word.replace(/[.,\?\/#!$%\^&\*;:{}=\-_`~()]/g, '');
	try {
		const doc = nlp(sentence).document[0];
		for (let i = 0; i < doc.length; i++) {
			const term = doc[i];
			if (term.text === word) {
				const tags = term.tags;
				let tag;
				if (tags.has('Pronoun')) {
					return 'pronoun';
				}
				if (tags.has('Plural')) {
					return 'plural';
				}
				tag = [...tags][0];
				return tag.toLowerCase();
			}
		}
	} catch (error) {
		console.log("Error in getWordType:", error);
		return "error";
	}
}