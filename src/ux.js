// display the log on the page
const log = (...args) => document.getElementById("log").textContent += args.join(" ") + "\n";

// const lastInputWords = document.getElementById("textInput").value.trim()
// 	.split(/[\s.,!?]+/).filter(word => word.length > 0);

var iWord = 0;

let iNote = 0;

let transportStarted = false; // whether the metronome is started

async function handleKey(event) {
	if (!(event.key === " " || event.key === "Enter")) return;

	if (audioCtx.state !== "running") {
		await audioCtx.resume();
		Tone.start();
		console.log("AudioContext resumed");
	}

	const melody = await loadMelody("assets/caledonia.json");

	setTimeout(async () => {
		const inputWords = document.getElementById("textInput").value.trim()
			.split(/[\s.,!?]+/).filter(word => word.length > 0);
		if (inputWords.length === lastInputWords.length) return;

		const lastWord = inputWords[inputWords.length - 1];

		lastInputWords.push(lastWord);

		if (iWord == 0) {
			if (!transportStarted) {
				transportStarted = true;
				startMetronomeDisplay();
				const accompaniment = await loadMIDI("assets/caledonia-accompaniment.mid");
				await scheduleMelody(accompaniment);
				console.log("Accompaniment scheduled", accompaniment);
				await scheduleMelody(melody, false);
				console.log("Melody scheduled");
				Tone.start();
				Tone.Transport.start();
			}
		}

		// var buffer = await espeakTTS2buffer(lastWord);
		// var pitch = detectPitch(buffer, [40, 140]);
		// if (pitch === null) {
		// 	buffer = await espeakTTS2buffer(lastWord);
		// 	pitch = detectPitch(buffer, [40, 140]);

		// 	if (pitch === null) {
		// 		pitch = 72;
		// 	}
		// }
		// const target_pitch = melody[iWord % melody.length].pitch - 18; // shift by 2 octaves
		// // const semitoneShift = target_pitch - 12 * Math.log2(72 / 261.626);
		// const semitoneShift = target_pitch - 12 * Math.log2(pitch / 261.626);
		// // const delay = melody[iWord % melody.length].time - (audioCtx.currentTime - startTime);
		// playAudio(buffer, { semitoneShift: semitoneShift });
		// log(`Playing ${lastWord}, with pitch ${pitch.toFixed(2)} Hz -> ${semitoneShift} semitones shift`);

		iWord++;
	});

}

async function playMelody() {
	if (audioCtx.state !== "running") {
		audioCtx.resume();
		Tone.start();
		console.log("AudioContext resumed");
	}

	const melody = await loadMelody("assets/caledonia.json");
	const accompaniment = await loadMIDI("assets/caledonia-accompaniment.mid");

	if (!transportStarted) {
		transportStarted = true;
	}
	startMetronomeDisplay();
	await scheduleMelody(accompaniment);
	console.log("Accompaniment scheduled", accompaniment);
	await scheduleMelody(melody, true, null, null, true);
	console.log("Melody scheduled");
	Tone.start();
	Tone.Transport.start();
}

const syllableRegex = /[^aeiouy]*[aeiouy]+(?:[^aeiouy]*$|[^aeiouy](?=[^aeiouy]))?/gi;

function syllabify(words) {
	return words.match(syllableRegex);
}

function startMetronomeDisplay() {
	Tone.Transport.scheduleRepeat((time) => {
		const pos = Tone.Transport.position.split('.')[0];  // just "1:2", ignore 3rd subdivision
		document.getElementById('meter').textContent = `Now at: ${pos}`;
	}, "8n");  // update every eighth note
}

async function loadMelody(url) {
	const res = await fetch(url);
	if (!res.ok) throw new Error("Failed to load melody file");
	const melody = await res.json();
	return melody;
}