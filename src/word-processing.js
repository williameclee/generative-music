import nlp from 'https://esm.sh/compromise';

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

// export function addWordToCanvas(ctx, word, scene, fontStyle, randomiseFontSize = true) {
// 	if (word.trim() === "") return;

// 	let fontSize;
// 	if (randomiseFontSize) {
// 		fontSize = fontStyle[2][0] + Math.random() * (fontStyle[2][1] - fontStyle[2][0]);
// 	} else {
// 		fontSize = fontStyle[2];
// 	}

// 	ctx.font = `${fontStyle[0]} ${fontStyle[1]} ${fontSize}px ${fontStyle[3]}`;
// 	ctx.fillStyle = fontStyle[5] || "black";

// 	const wordWidth = ctx.measureText(word).width;
// 	const spaceWidth = ctx.measureText(" ").width;

// 	// Define the bottom line position if not already done
// 	if (scene.startingCursorY === undefined) {
// 		scene.startingCursorY = ctx.canvas.height - 10; // or some bottom margin
// 	}

// 	// Always check: is there enough horizontal space at bottom line?
// 	if (scene.cursorY !== scene.startingCursorY) {
// 		const spaceAtBottom = ctx.canvas.width - (scene.cursorX % ctx.canvas.width);
// 		if (spaceAtBottom >= wordWidth + spaceWidth) {
// 			// Enough room at bottom — go back down
// 			scene.cursorY = scene.startingCursorY;
// 			scene.cursorX = (scene.cursorX % ctx.canvas.width) + 10; // jump to current right edge + padding
// 		}
// 	}

// 	// Check if not enough room even at current line
// 	const spaceAtCurrentLine = ctx.canvas.width - (scene.cursorX % ctx.canvas.width);
// 	if (spaceAtCurrentLine < wordWidth + spaceWidth) {
// 		// Not enough space in current line → move up
// 		scene.cursorX = (scene.cursorX % ctx.canvas.width) + 10;
// 		scene.cursorY -= fontSize * 1.5;
// 	}

// 	// Now draw
// 	ctx.fillText(word, scene.cursorX, scene.cursorY);

// 	// Advance cursor
// 	scene.cursorX += wordWidth + spaceWidth;
// }