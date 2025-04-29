import nlp from 'https://esm.sh/compromise';


export function addWordToCanvas(ctx, word, scene, fontStyle, randomiseFontSize = true) {
	if (word.trim() === "") return;

	let fontSize;
	if (randomiseFontSize) {
		fontSize = fontStyle[2][0] + Math.random() * (fontStyle[2][1] - fontStyle[2][0]);
	} else {
		fontSize = fontStyle[2];
	}

	ctx.font = `${fontStyle[0]} ${fontStyle[1]} ${fontSize}px ${fontStyle[3]}`;
	ctx.fillStyle = fontStyle[5] || "black";

	console.log("Adding word:", word, "at", scene.cursorX, scene.cursorY, "with font", ctx.font);

	const wordWidth = ctx.measureText(word).width;

	if (scene.cursorX + wordWidth > ctx.canvas.width) {
		console.log("Not enough space for word:", word, "at", scene.cursorX, scene.cursorY);
		return;
		// scene.cursorX = scene.width + 10;
		// scene.cursorY -= fontSize * 1.5; // Move to next line
	}

	ctx.fillStyle = "black";
	ctx.fillText(word, scene.cursorX, scene.cursorY);

	scene.cursorX += wordWidth + ctx.measureText(" ").width;
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
				const firstTag = [...tags][0];
				return firstTag.toLowerCase();
			}
		}
	} catch (error) {
		console.log("Error in getWordType:", error);
		return "error";
	}
}