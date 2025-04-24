let audioCtx
let espeak
let instruments

var initialisationIsComplete = false;
initialseSound();

var ttsNoteQueue = [];


async function initialseSound() {
	const loadingIndicator = document.getElementById("loadingIndicator");
	loadingIndicator.style.display = "block";
	try {
		// Initialise AudioContext
		audioCtx = new (window.AudioContext || window.webkitAudioContext)();
		console.log("AudioContext initialised:", audioCtx);

		// Initialise eSpeakNG TTS engine
		await new Promise(resolve => {
			window.espeak = new eSpeakNG("src/espeakng.worker.js", resolve);
		});
		console.log("eSpeakNG initialised:", window.espeak);

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
