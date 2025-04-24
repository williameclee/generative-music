// display the log on the page
const log = (...args) => document.getElementById("log").textContent += args.join(" ") + "\n";

const bpmSlider = document.getElementById("bpmSlider");
const bpmValue = document.getElementById("bpmValue");

// Set initial BPM
bpmSlider.addEventListener("input", () => {
	const bpm = parseInt(bpmSlider.value);
	Tone.Transport.bpm.rampTo(bpm, 0.2); // Smooth transition
	bpmValue.textContent = bpm;
});

// Set whether to use TTS
const ttsToggle = document.getElementById("ttsToggle");

const playToggle = document.getElementById("playToggle");
let melodyIsPlaying = false;

// Melody playback demo
async function playMelody() {
	// Make sure initialisation is complete
	if (!initialisationIsComplete) {
		alert("Please wait for the initialisation to complete.");
		return;
	}

	// If melody is already playing, stop it
	Tone.Transport.stop();
	if (melodyIsPlaying) {
		melodyIsPlaying = false;
		playToggle.textContent = "Play";
		return;
	}

	melodyIsPlaying = true;
	playToggle.textContent = "Stop";
	document.getElementById("log").textContent = "";

	if (audioCtx.state !== "running") {
		audioCtx.resume();
		Tone.start();
		console.log("AudioContext resumed");
	}
	console.log("Loading melody and accompaniment");
	const melody = await loadMIDI("assets/daisy-bell-chorus-Voice.mid", true);
	console.log("Melody loaded", melody);
	const accompaniment = await loadMIDI("assets/daisy-bell-chorus-Piano.mid");
	console.log("Accompaniment loaded", accompaniment);
	startMetronomeDisplay();
	await scheduleMelody(accompaniment, instrumentSelect.value);
	console.log("Accompaniment scheduled", accompaniment);
	await scheduleMelody(melody, "piano", false, null, true, true);
	console.log("Melody scheduled", melody);
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
		document.getElementById('meter').textContent = `Metronome: ${pos}`;
	}, "8n");  // update every eighth note
}

async function loadMelody(url) {
	const res = await fetch(url);
	if (!res.ok) throw new Error("Failed to load melody file");
	const melody = await res.json();
	return melody;
}

// Typing related stuff, disabled for now
var wordQueue = [];
var previousInputLength = 0;
var previousLastWord = "";

async function handleKey(event) {
	const allowedKeys = [" ", "Enter", "!", ",", "."];
	if (!allowedKeys.includes(event.key)) return;

	if (!melodyIsPlaying) {
		if (audioCtx.state !== "running") {
			audioCtx.resume();
			console.log("AudioContext resumed");
		}

		const melody = await loadMIDI("assets/daisy-bell-chorus-Voice.mid");
		const accompaniment = await loadMIDI("assets/daisy-bell-chorus-Piano.mid");

		startMetronomeDisplay();
		await scheduleMelody(accompaniment, instrumentSelect.value);
		console.log("Accompaniment scheduled", accompaniment);
		await scheduleMelody(melody, "piano", false, null, true, true);
		console.log("Melody scheduled", melody);
		Tone.start();
		Tone.Transport.start();

		melodyIsPlaying = true;
		const loadingIndicator = document.getElementById("loadingIndicator");
		loadingIndicator.textContent = "Melody playing";
	}

	const inputWords = document.getElementById("textInput").value.trim()
		.split(/[\s.,!?]+/).filter(word => word.length > 0);
	const inputLength = inputWords.length;
	const lastWord = inputWords[inputLength - 1];
	if (inputLength === previousInputLength && lastWord === previousLastWord) return;

	previousInputLength = inputLength;
	previousLastWord = lastWord;
	wordQueue.push(lastWord);
	// console.log("Words: ", wordQueue);
	// console.log("Notes: ", ttsNoteQueue);

	// Check both buffers are not empty
	let nextWord, nextNote;
	if (wordQueue.length == 0) {
		console.log("No words available");
		return;
	} else {
		nextWord = wordQueue[0];
		wordQueue.shift();
	}

	pruneUsedNotes();
	nextNote = ttsNoteQueue[0];
	ttsNoteQueue.shift();

	if (ttsNoteQueue.length == 0) {
		console.log("No eligible notes available");
		return;
	}
	console.log(nextWord, nextNote);
	const wordBuffer = await
		espeak2note(nextWord, Tone.Frequency(nextNote.note).toMidi(), nextNote.duration);

	// Schedule it to play in sync
	scheduleAudio(wordBuffer, nextNote.time);
	log(`eSpeakNG TTS: ${nextWord.padEnd(10, ' ')} -> ${nextNote.note.padEnd(3, ' ')} at ${nextNote.time}`);
}

function pruneUsedNotes() {
	const now = Tone.Transport.seconds;
	ttsNoteQueue = ttsNoteQueue.filter(note => {
		const noteTime = Tone.Time(note.time).toSeconds();
		return !note.word && noteTime > now;
	});
}

function pushWordToNextNote(word) {
	pruneUsedNotes();
	const next = ttsNoteQueue.shift();
	if (next) {
		next.word = word;
		console.log(`Assigned "${word}" → ${next.note} @ ${next.time}`);
	} else {
		console.warn("No available notes for:", word);
	}
}