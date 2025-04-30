export const audioCtx = new (window.AudioContext || window.webkitAudioContext)({
	latencyHint: "playback", // Use "interactive" for low latency
	// latencyHint: "interactive", // Use "interactive" for low latency
	sampleRate: 44100,
}); // AudioContext for the browser
console.log("AudioContext initialised:", audioCtx);

// Some simple synthetic instruments
export const metroSynth = new Tone.MembraneSynth().toDestination();
export const glitchSynth = new Tone.MembraneSynth().toDestination();
export const teleportSynth = new Tone.MonoSynth({
	oscillator: { type: "sine" },
	envelope: {
		attack: 0.5,
		decay: 0.2,
		sustain: 0.1,
		release: 2
	},
	filter: {
		Q: 3,
		type: "lowpass",
		rolloff: -12
	}
})

// Load tonejs-instruments sample library
export let instruments = {};
export let piano = null;
export async function loadIntsruments() {
	instruments = await SampleLibrary.load({
		instruments: ['piano', 'bass-electric', 'bassoon', 'cello', 'clarinet', 'contrabass', 'french-horn', 'guitar-acoustic', 'guitar-electric', 'guitar-nylon', 'harp', 'organ', 'saxophone', 'trombone', 'trumpet', 'tuba', 'violin', 'xylophone'],
		baseUrl: "src/tonejs-instruments/samples/",
	})
	console.log("SampleLibrary loaded: ", Object.keys(instruments));
	await Tone.loaded();
	piano = instruments["piano"];
}

export async function playDotSound(y, instrument, scale = null, length = "8n", volume = 0, snapTime = null) {
	await audioCtx.resume();

	// Handle frequency
	var frequency;
	if (scale === "all") {
		let yNorm;
		if (typeof y === "number") {
			yNorm = y;
		} else {
			yNorm = Math.max(Math.min((1 - y.y / y.height), 1), 0); // 1 at top, 0 at bottom
			yNorm = 55 + yNorm * (880 - 55);
		}
		frequency = noteId2frequency(frequency2noteId(yNorm, true));
	} else if (typeof scale === "string" || typeof scale === "number") {
		frequency = scale;
	} else if (Array.isArray(scale)) {
		let yNorm;
		if (typeof y === "number") {
			yNorm = y;
		} else {
			yNorm = Math.max(Math.min((1 - y.y / y.height), 1), 0); // 1 at top, 0 at bottom
		}
		frequency = snapPos2scale(yNorm, scale);
	}

	// Handle instrument
	if (typeof instrument === "string") {
		instrument = instruments[instrument]
	} else if (typeof instrument === "object") {
		instrument = instrument;
	}

	// Handle volume
	if (volume !== null) {
		instrument.volume.value = volume; // in dB (e.g., -12)
	}
	instrument.toDestination();

	// Handle length
	if (length == null) {
		length = "8n";
	}

	// Handle rhythm snapping
	if (snapTime == null) {
		instrument.triggerAttackRelease(frequency, "8n");
		return;
	}
	const time = snap2subdivision(Tone.now(), snapTime);
	try {
		const lastTime = y.lastQuickAudioTime;
		if (Math.abs(time - lastTime) < 0.02) {
			console.log("Skipping sound: too close to last sound");
			return;
		}
		y.lastQuickAudioTime = time;
	} catch (e) {
	}
	instrument.triggerAttackRelease(frequency, length, time);
}

function snap2subdivision(now = Tone.now(), subdivision = "8n", tol = 0.03) {
	const nextTime = Tone.Transport.nextSubdivision(subdivision);

	// Check current time is not close to the subdivision
	const nowTime = nextTime - Tone.Time(subdivision).toSeconds();

	if (Math.abs(nowTime - now) < tol) {
		return now + 0.001;
	}

	// return nextTime;
	return Math.max(nextTime, now + 0.001);
}

function frequency2noteId(freq, round = true) {
	const noteId = 69 + 12 * Math.log2(freq / 440);
	if (round) {
		return Math.round(noteId);
	}
	return noteId;
}
function noteId2frequency(noteId) {
	const freq = 440 * Math.pow(2, (noteId - 69) / 12);
	return freq;
}

// Simple synth
const synth = new Tone.Synth({
	oscillator: {
		type: "sine" // or "square", "triangle", etc.
	},
	envelope: {
		attack: 0.01,
		decay: 0.1,
		sustain: 0.3,
		release: 1
	}
}).toDestination();

export async function initialseSound() {
	const loadingIndicator = document.getElementById("loadingIndicator");
	loadingIndicator.style.display = "block";
	try {
		// Initialise AudioContext
		audioCtx = new (window.AudioContext || window.webkitAudioContext)();
		console.log("AudioContext initialised:", audioCtx);

		// Load tonejs-instruments sample library
		instruments = SampleLibrary.load({
			instruments: ['piano', 'bass-electric', 'bassoon', 'cello', 'clarinet', 'contrabass', 'french-horn', 'guitar-acoustic', 'guitar-electric', 'guitar-nylon', 'harp', 'organ', 'saxophone', 'trombone', 'trumpet', 'tuba', 'violin'],
			baseUrl: "src/tonejs-instruments/samples/",
		})
		await Tone.loaded();
		const instrumentNames = Object.keys(instruments);
		console.log("SampleLibrary loaded: ", instrumentNames);

		const instrumentSelect = document.getElementById("instrumentSelect");
		instrumentNames.forEach(name => {
			const option = document.createElement("option");
			option.value = name;
			option.textContent = name.replace(/-/g, " ").replace(/\b\w/g, l => l.toUpperCase());
			instrumentSelect.appendChild(option);
		});
	} catch (error) {
		console.error("Error during sound initialisation:", error);
		alert("Error during sound initialisation. Please check the console for details.");
	} finally {
		// loadingIndicator.style.display = "none";
		loadingIndicator.textContent = "Initialisation complete, type something to start";
		initialisationIsComplete = true;
	}
}

function snapPos2scale(y, currentScale = ["C4", "D4", "E4", "F4", "G4", "A4", "B4"]) {
	const scaleFreqs = currentScale.map(note => Tone.Frequency(note).toFrequency());
	// Lerp y to the bound of the scale
	const freq = Math.min(...scaleFreqs) + y * (Math.max(...scaleFreqs) - Math.min(...scaleFreqs));

	let closest = scaleFreqs[0];
	let minDiff = Math.abs(freq - closest);

	for (let scaleFreq of scaleFreqs) {
		const diff = Math.abs(freq - scaleFreq);
		if (diff < minDiff) {
			closest = scaleFreq;
			minDiff = diff;
		}
	}
	return closest;
}

export async function playChord(chordNotes, time, instrument = piano, volume = -12) {
	// Get the instrument from the loaded instruments
	try {
		if (typeof instrument === "string") {
			instrument = instruments[instrument].toDestination();
		}
	} catch (e) {
		instrument = instruments["piano"].toDestination();
		console.warn("Instrument not found, using default piano");
	}

	// Set the volume
	if (volume !== null) {
		instrument.volume.value = volume;
	}

	time = snap2subdivision(time);

	instrument.triggerAttackRelease(chordNotes, "1m", time);
}