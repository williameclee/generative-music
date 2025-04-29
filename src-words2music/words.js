import nlp from 'https://esm.sh/compromise';


let fontStyles = {};
export async function loadFontStyles(src = "assets/word-styles.json") {
	const response = await fetch(src);
	fontStyles = await response.json();
}

export let wordBuffers = [];
export let cursors = [];

export async function loadWordBuffers(src = "assets/word-buffers.json", scene) {
	const response = await fetch(src);
	wordBuffers = await response.json();

	const bufferNames = Object.keys(wordBuffers).sort((a, b) => wordBuffers[a].order - wordBuffers[b].order);

	for (let i = 0; i < bufferNames.length; i++) {
		const cursorName = wordBuffers[bufferNames[i]]["cursor"];
		cursors.push(...cursorName);
	}

	if (!scene) {
		return;
	}

	for (let i = 0; i < bufferNames.length; i++) {
		const bufferName = bufferNames[i];
		const canvasName = wordBuffers[bufferName]["canvas"];
		scene[canvasName] = document.createElement("canvas");
		scene[canvasName].width = scene.width * 5;
		scene[canvasName].height = scene.height;
		scene[bufferName] = scene[canvasName].getContext("2d", { willReadFrequently: true });

		const cursorNames = wordBuffers[bufferName]["cursor"];
		scene[cursorNames[0]] = scene.width + wordBuffers[bufferName]["cursorOffset"][0];
		scene[cursorNames[1]] = scene.height + wordBuffers[bufferName]["cursorOffset"][1];
	}

}

export function addWordToCanvas(scene, randomiseFontSize = true) {
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
		fontSize = fontStyle[2][0] + Math.random() * (fontStyle[2][1] - fontStyle[2][0]);
	} else {
		fontSize = fontStyle[2];
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

	// console.log(`Adding word: ${scene.wordBuffer} at (${scene[cursor[0]]}, ${scene[cursor[1]]}) with font ${ctx.font}/colour ${ctx.fillStyle}, alignment ${ctx.textBaseline}`);

	scene[cursor[0]] += wordWidth * offsetRatio[0] + ctx.measureText(" ").width;

	// Debugging info
	const wordTypeContainer = document.getElementById("word-type-container");
	if (wordTypeContainer) {
		wordTypeContainer.innerText = wordType;
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