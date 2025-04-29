export let instruments = {};

export async function loadIntsruments() {
	instruments = await SampleLibrary.load({
		instruments: ['piano', 'bass-electric', 'bassoon', 'cello', 'clarinet', 'contrabass', 'french-horn', 'guitar-acoustic', 'guitar-electric', 'guitar-nylon', 'harp', 'organ', 'saxophone', 'trombone', 'trumpet', 'tuba', 'violin'],
		baseUrl: "src/tonejs-instruments/samples/",
	})
	console.log("SampleLibrary loaded: ", Object.keys(instruments));
	await Tone.loaded();
}

export async function playDotSound(dot, instrument, volume = 0, scale = null, snapTime = null) {
	const minPitch = 220; // lowest frequency (Hz)
	const maxPitch = 880; // highest frequency (Hz)

	const normFactor = Math.max(Math.min(1 - (dot.y / dot.height), 1), 0); // 1 at top, 0 at bottom
	var frequency = minPitch + normFactor * (maxPitch - minPitch);
	if (scale!== null) {
		// frequency = noteId2frequency(frequency2noteId(frequency, true));
		frequency = snapFrequencyToScale(frequency, scale);
	}

	// Set volume if specified
	if (volume !== null) {
		instruments[instrument].volume.value = volume; // in dB (e.g., -12)
	}
	instruments[instrument].toDestination();

	if (snapTime == null) {
		instruments[instrument].triggerAttackRelease(frequency, "8n");
		return;
	}
	const time = snap2subdivision(snapTime);
	instruments[instrument].triggerAttackRelease(frequency, "4n", time);
}

export async function playBaseSound(dot) {
	let time;
	// if (!dot.prevCollidedWithGround) {
	// 	time = snap2subdivision("16n");
	// 	// const drift = Tone.now() - time;
	// 	// console.log("Drift:", drift);
	// 	// Tone.Transport.seconds += drift;
	// } else {
	// 	// Ground bounce: snap clean to 4n
	// 	time = snap2subdivision("4n");
	// }
	time = snap2subdivision("4n");

	// dot.lastDownbeatTime = time; // update anchor
	synth.triggerAttackRelease("C3", "8n", time);
}

function snap2subdivision(subdivision = "8n") {
	const now = Tone.now();
	console.log("snapping")
	const nextTime = Tone.Transport.nextSubdivision(subdivision);

	// Check current time is not close to the subdivision
	const nowTime = nextTime - Tone.Time(subdivision).toSeconds();

	if (Math.abs(nowTime - now) < 0.03) {
		// console.log("Current time is close to the subdivision, using it");
		return now + 0.03;
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

function snapFrequencyToScale(frequency, currentScale = ["C4", "D4", "E4", "F4", "G4", "A4", "B4"]) {
	console.log("Snapping frequency to scale:", frequency, currentScale);
	const scaleFreqs = currentScale.map(note => Tone.Frequency(note).toFrequency());

	let closest = scaleFreqs[0];
	let minDiff = Math.abs(frequency - closest);

	for (let f of scaleFreqs) {
		const diff = Math.abs(frequency - f);
		if (diff < minDiff) {
			closest = f;
			minDiff = diff;
		}
	}
	return closest;
}