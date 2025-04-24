// eSpeakNG TTS to AudioBuffer
async function espeakTTS2buffer(text, {
	pitch = 50,
	rate = 100,
	voice = "en",
	sampleRate = audioCtx.sampleRate
} = {}) {
	let tts = window.espeak;
	return new Promise((resolve, reject) => {
		if (!tts || !tts.synthesize) {
			return reject(new Error("eSpeak is not initialised or TTS is not ready."));
		}

		tts.set_pitch(pitch);
		tts.set_rate(rate);
		tts.set_voice(voice);

		const chunks = [];

		tts.synthesize(text, (samples) => {
			if (!samples) {
				// End of synthesis: concatenate chunks and return AudioBuffer
				const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
				const merged = new Float32Array(totalLength);
				let offset = 0;
				for (const chunk of chunks) {
					merged.set(chunk, offset);
					offset += chunk.length;
				}

				const buffer = audioCtx.createBuffer(1, merged.length, sampleRate);
				buffer.copyToChannel(merged, 0, 0);
				resolve(buffer);
				return;
			}

			chunks.push(new Float32Array(samples)); // Accumulate audio data
		});
	});
}

// eSpeakNG TTS to AudioBuffer tuned to specific pitch
async function espeak2note(word, targetPitch, duration, outputLog = false) {
	// Change pitch to reduce correction needed
	let pitch = 50; // default pitch
	if (targetPitch < 60) {
		pitch = 30;
	} else if (targetPitch < 110) {
		pitch = 60;
	} else if (targetPitch < 220) {
		pitch = 80;
	} else {
		pitch = 99;
	}
	// Change duration to sound more natural
	let rate = 50; // default rate
	const wordDuration = Tone.Time(duration).toSeconds();
	if (wordDuration < 0.2) {
		rate = 99;
	} else if (wordDuration < 0.4) {
		rate = 70;
	} else if (wordDuration < 0.6) {
		rate = 40;
	} else if (wordDuration < 0.8) {
		rate = 10;
	}


	var wordBuffer = await
		espeakTTS2buffer(word, rate = rate, pitch = pitch);
	wordBuffer = await pitchCorrection(wordBuffer, targetPitch);

	if (outputLog) {
		const note = Tone.Frequency(targetPitch, "midi").toNote();
		log(`eSpeakNG TTS: ${word} -> ${note}`);
	}

	return wordBuffer;
}

// Pitch correction using pitchy.js for pitch detection and SoundTouch.js for pitch shifting
// The correction is done segment-wise
async function pitchCorrection(buffer, targetPitch) {
	// Split the buffer into overlapping chunks
	buffer = padAudioBuffer(buffer, pad = 0.5);
	const { chunks, hopSize } =
		splitBufferToChunks(buffer, chunkDuration = 0.2, overlapRatio = 0.5);
	// Loop through each chunk and apply individual pitch detection/correction
	for (let i = 0; i < chunks.length; i++) {
		const pitch = detectPitch(chunks[i], [50, 150], segmentLength = 2048);
		if (pitch === null) {
			continue;
		}
		// Calculate the pitch shift needed in # semitones
		const pitchMidi = hzToMidi(pitch);
		const semitoneShift = targetPitch - pitchMidi;
		chunks[i] = await applySTPitchShift(chunks[i], semitoneShift, pad = 0.5);
	}
	// COnvert the chunks back to a single AudioBuffer
	buffer = concatChunksWithCrossfade(chunks, hopSize, buffer.length);
	return buffer
}

// Pitch-shifting using SoundTouch.js
function applySTPitchShift(buffer, semitoneShift, pad = 0.5) {
	// Preprocessing
	buffer = ensureStereo(buffer);
	if (pad > 0) {
		buffer = padAudioBuffer(buffer, pad);
	}

	return new Promise((resolve, reject) => {
		try {
			const source = new soundtouch.WebAudioBufferSource(buffer);
			const st = new soundtouch.SoundTouch(buffer.sampleRate);
			st.pitch = Math.pow(2, semitoneShift / 12);

			const filter = new soundtouch.SimpleFilter(source, st);

			const maxFrames = buffer.length * 2;
			const output = new Float32Array(maxFrames);
			const extracted = filter.extract(output, buffer.length);

			if (extracted <= 0) {
				return reject("No frames extracted — pitch shift failed.");
			}

			const final = output.slice(0, extracted);

			// I have no idea why the sample rate is doubled here, but otherwise the output is stretched twice as long
			const shifted = audioCtx.createBuffer(buffer.numberOfChannels, final.length, buffer.sampleRate * 2);

			for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
				shifted.copyToChannel(final, ch);
			}

			resolve(shifted);
		} catch (err) {
			reject("Pitch shift failed: " + err);
		}
	});
}

// Pitch-shifting using Tone.js
// Note: The last time I tested this, it wasn't working at all
async function applyTonePitchShift(buffer, semitoneShift) {
	return new Promise((resolve) => {
		const pitchNode = new Tone.PitchShift(semitoneShift).toDestination();

		const toneBuffer = new Tone.Buffer(buffer);

		const player = new Tone.Player(toneBuffer).connect(pitchNode);
		const recorder = new Tone.Recorder();

		pitchNode.connect(recorder);

		player.start();
		recorder.start();

		player.onstop = async () => {
			const recording = await recorder.stop();
			const arrayBuffer = await recording.arrayBuffer();
			const shifted = await audioCtx.decodeAudioData(arrayBuffer);
			resolve(shifted);
		};
	});
}