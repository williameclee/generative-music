export async function loadScales(src = "assets/scales.json") {
	const response = await fetch(src);
	scales = await response.json();
	console.log("Loaded scales:", Object.keys(scales));
}

export async function loadTransitionMatrices(src = "assets/chord-transitions.json") {
	const response = await fetch(src);
	chordTransitionMatrices = await response.json();
	console.log("Loaded chord transition matrices:", chordTransitionMatrices);
}

export async function loadChordNotes(src = "assets/chord-notes.json") {
	const response = await fetch(src);
	chords = await response.json();
	console.log("Loaded chord notes:", chords);
}

export let chordTransitionMatrices = null;
export let chords = null;
export let scales = null;

export function loadScaleNotes(scaleName) {
	return scales[scaleName];
}

export function getNextChord(currentChord, scaleType, refStyle) {
	const style = `${refStyle} ${scaleType}`;
	const transitionMatrix = chordTransitionMatrices[style];
	const probabilities = transitionMatrix[currentChord];
	if (!probabilities) {
		console.error(`No transition probabilities found for chord: ${currentChord}`, transitionMatrix);
		return currentChord; // Fallback to the current chord
	}

	const randomCounter = Math.random();
	let cumulative = 0;

	for (const [chord, probability] of Object.entries(probabilities)) {
		cumulative += probability;
		if (randomCounter < cumulative) {
			return chord;
		}
	}

	console.warn(`No chord selected, returning current chord: ${currentChord}`);
	console.log(currentChord, scaleType, refStyle)
	return currentChord;
}

export function getChordNotes(chord, scaleType, baseNote, expand = false) {
	const chordNoteOffset = chords[scaleType][chord];
	const baseNoteMidi = Tone.Frequency(baseNote).toMidi();
	var chordMidiNotes = [];
	let chordNotes = [];

	for (let i = 0; i < chordNoteOffset.length; i++) {
		const midiNote = baseNoteMidi + chordNoteOffset[i];
		chordMidiNotes.push(midiNote);
		if (expand) {
			let offset;
			if (midiNote > 77) {
				// > F5
				chordMidiNotes.push(midiNote - 12);
				chordMidiNotes.push(midiNote - 24);
			} else if (midiNote <= 53) {
				// < F3
				chordMidiNotes.push(midiNote + 12);
				chordMidiNotes.push(midiNote + 24);
			} else {
				chordMidiNotes.push(midiNote - 12);
				chordMidiNotes.push(midiNote + 12);
			}
		}
	}
	chordMidiNotes.sort((a, b) => a - b);


	for (let i = 0; i < chordMidiNotes.length; i++) {
		chordNotes.push(Tone.Frequency(chordMidiNotes[i], "midi").toNote());
	}
	return chordNotes;
}

// const scaleType = "major";
// const refStyle = "Bach";
// const baseNote = "C4";
// var currentChord = "I";

// const selectChordBtn = document.getElementById("selectChord");
// const log = document.getElementById("log");

// selectChordBtn.addEventListener("click", () => {
// 	const nextChord = getNextChord(currentChord, scaleType, refStyle);
// 	const chordNotes = getChordNotes(nextChord, scaleType, baseNote);
// 	log.textContent = `Current chord: ${currentChord}, Next chord: ${chordNotes}`;
// 	currentChord = nextChord;
// });