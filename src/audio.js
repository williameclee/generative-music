Tone.Transport.bpm.value = 72;     // BPM
Tone.Transport.timeSignature = 3;  // beats per bar
Tone.Transport.loop = false;
Tone.Transport.loopEnd = "8m";     // Loop every 4 measures


async function scheduleMelody(melody, instrument = "piano", use_tts = true, offset = "0:0", outputLog = false, melody_tts_eligible = false) {
	instruments[instrument].toDestination();
	for (const { note, time, duration, word } of melody) {
		// Schedule synth note
		const adjustedTime = Tone.Time(time) + Tone.Time(offset);
		Tone.Transport.schedule((t) => {
			instruments[instrument].triggerAttackRelease(note, duration, t);
		}, adjustedTime);

		// Populate tts_eligible_notes
		if (melody_tts_eligible && !word) {
			ttsNoteQueue.push({
				note: note,
				time: time,
				duration: duration,
			});
		}

		// If there's a word, schedule TTS
		if (!word || !use_tts) continue;
		const wordBuffer = await
			espeak2note(word, Tone.Frequency(note).toMidi(), duration);

		// Schedule it to play in sync
		scheduleAudio(wordBuffer, time);

		if (outputLog) {
			if (outputLog) {
				log(`eSpeakNG TTS: ${word.padEnd(10, ' ')} -> ${note.padEnd(3, ' ')} at ${time}`);
			}
		}
	}
}

async function loadMIDI(url, tts_eligible = false) {
	const res = await fetch(url);
	const arrayBuffer = await res.arrayBuffer();
	const midi = new Midi(arrayBuffer);

	const ppq = midi.header.ppq;
	const timeSignature = midi.header.timeSignatures[0]?.timeSignature[0] || 4;

	const melody = [];

	midi.tracks.forEach(track => {
		console.log("Track: ", track);
		track.notes.forEach(note => {
			const beatTime = note.ticks / ppq;
			const beatDuration = note.durationTicks / ppq;

			melody.push({
				note: note.name,
				time: beatsToBarsBeatsSixteenths(beatTime, timeSignature),
				duration: Tone.Time(`${beatDuration}i`).toNotation(),
				word: "",
				tts_eligible: tts_eligible,
			});
		});
	});

	melody.sort((a, b) => Tone.Time(a.time).toSeconds() - Tone.Time(b.time).toSeconds());

	return melody;
}

function beatsToBarsBeatsSixteenths(beats, timeSignature = 4) {
	const bars = Math.floor(beats / timeSignature);
	const remainingBeats = beats % timeSignature;

	const wholeBeats = Math.floor(remainingBeats);
	const fractional = remainingBeats - wholeBeats;
	const sixteenths = Math.round(fractional * 4); // 1 beat = 4 sixteenths

	return `${bars}:${wholeBeats}:${sixteenths}`;
}

function hzToMidi(hz) {
	return 69 + 12 * Math.log2(hz / 440);
}

function scheduleAudio(buffer, time = "0:0") {
	Tone.Transport.schedule((scheduledTime) => {
		const source = audioCtx.createBufferSource();
		source.buffer = buffer;
		source.connect(audioCtx.destination);
		source.start(scheduledTime);  // use Tone.js time
	}, time);
}

function splitBufferToChunks(buffer, chunkDuration = 0.1, overlapRatio = 0.5) {
	const sampleRate = buffer.sampleRate;
	const chunkSize = Math.floor(chunkDuration * sampleRate);
	const overlapSize = Math.floor(chunkSize * overlapRatio);
	const hopSize = chunkSize - overlapSize;

	const chunks = [];

	for (let start = 0; start < buffer.length; start += hopSize) {
		const end = Math.min(start + chunkSize, buffer.length);
		const chunk = audioCtx.createBuffer(1, end - start, sampleRate);
		const data = buffer.getChannelData(0).slice(start, end);
		chunk.copyToChannel(data, 0);
		chunks.push(chunk);
	}

	return { chunks, chunkSize, hopSize };
}

function concatChunksWithCrossfade(chunks, chunkSpacing, originalLength) {
	if (chunkSpacing === undefined) {
		console.error("chunkSpacing is undefined");
	}
	const result = audioCtx.createBuffer(1, originalLength, chunks[0].sampleRate);
	const output = result.getChannelData(0);

	let i_offset = 0;
	let fadeout_length = 0;
	for (let j_chunk = 0; j_chunk < chunks.length; j_chunk++) {
		const input = chunks[j_chunk].getChannelData(0);
		for (let j_data = 0; j_data < input.length; j_data++) {
			const i_output = i_offset + j_data;
			if (j_data < fadeout_length) {
				// output[i_output] = input[j_data] * (j_data / fadeout_length)
				output[i_output] = input[j_data]
					+ output[i_output] * (1 - j_data / fadeout_length);
			} else {
				output[i_output] = input[j_data];
			}
			fadeout_length = input.length - chunkSpacing;
		}
		i_offset += chunkSpacing;
	}

	return result;
}

function resampleBuffer(buffer, newLength) {
	const result = audioCtx.createBuffer(1, newLength, buffer.sampleRate);
	const src = buffer.getChannelData(0);
	const dst = result.getChannelData(0);

	for (let i = 0; i < newLength; i++) {
		const index = (i / newLength) * src.length;
		const i0 = Math.floor(index);
		const i1 = Math.min(i0 + 1, src.length - 1);
		const frac = index - i0;
		dst[i] = src[i0] * (1 - frac) + src[i1] * frac;
	}

	return result;
}

function playTone(frequency = 441, duration = 0.5, volume = 0.5) {
	const oscillator = audioCtx.createOscillator();
	const gainNode = audioCtx.createGain();

	oscillator.type = "sine";
	oscillator.frequency.value = frequency;

	const now = audioCtx.currentTime;
	const fadeOutTime = 0.01; // 20ms fade-out

	gainNode.gain.setValueAtTime(volume, now);
	gainNode.gain.linearRampToValueAtTime(0.0001, now + duration); // smooth fade

	oscillator.connect(gainNode);
	gainNode.connect(audioCtx.destination);

	oscillator.start(now);
	oscillator.stop(now + duration + fadeOutTime); // give it time to fade out

	oscillator.onended = () => {
		oscillator.disconnect();
		gainNode.disconnect();
	};
}

async function playAudio(buffer, { semitoneShift = 0, when = 0, pause = false } = {}) {
	// await audioCtx.resume();
	const startTime = Math.max(audioCtx.currentTime + when, 0);

	// Prime the AudioContext to ensure clock starts ticking
	const prime = audioCtx.createBufferSource();
	prime.buffer = audioCtx.createBuffer(1, 1, audioCtx.sampleRate);
	prime.connect(audioCtx.destination);
	prime.start();


	return new Promise(resolve => {
		if (semitoneShift === 0) {
			// Native playback path
			const source = audioCtx.createBufferSource();
			source.buffer = buffer;
			source.connect(audioCtx.destination);
			source.start(startTime);

			if (pause) {
				source.onended = resolve;
			} else {
				resolve();
			}

		} else {
			buffer = padAudioBuffer(buffer, 0.5); // Pad to avoid clicks
			// Pitch-shifted path (scheduled manually)
			const node = createPitchShifter(buffer, semitoneShift);

			// Estimate pitch-altered duration
			const rateFactor = Math.pow(2, -semitoneShift / 12); // pitch up → shorter duration
			const adjustedDuration = buffer.duration * rateFactor;

			const delay = Math.max(0, startTime - audioCtx.currentTime);

			// Schedule connection and resolution
			setTimeout(() => {
				node.connect(audioCtx.destination);

				if (pause) {
					setTimeout(resolve, adjustedDuration * 1000);
				} else {
					resolve();
				}
			}, delay * 1000);
		}
	});
}

function padAudioBuffer(buffer, seconds = 0.5) {
	const padSamples = Math.floor(buffer.sampleRate * seconds);
	const newLength = buffer.length + padSamples;
	const padded = audioCtx.createBuffer(buffer.numberOfChannels, newLength, buffer.sampleRate);

	for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
		const oldData = buffer.getChannelData(ch);
		const newData = padded.getChannelData(ch);
		newData.set(oldData); // copy original data
		// trailing samples are zero (silence)
	}

	return padded;
}

function ensureStereo(buffer) {
	if (buffer.numberOfChannels === 2) return buffer;
	const stereo = audioCtx.createBuffer(2, buffer.length, buffer.sampleRate);
	const mono = buffer.getChannelData(0);
	stereo.copyToChannel(mono, 0);
	stereo.copyToChannel(mono, 1);
	return stereo;
}

function createPitchShifter(buffer, semitoneShift = 0) {
	const stereoBuffer = ensureStereo(buffer);
	const source = new soundtouch.WebAudioBufferSource(stereoBuffer);
	const st = new soundtouch.SoundTouch(audioCtx.sampleRate);
	st.pitch = Math.pow(2, semitoneShift / 12);
	const filter = new soundtouch.SimpleFilter(source, st);
	return soundtouch.getWebAudioNode(audioCtx, filter);
}

function detectPitch(audioBuffer, clip = [50, 1000], segmentLength = 4096) {
	const detector = PitchDetector.forFloat32Array(segmentLength);
	const channelData = audioBuffer.getChannelData(0);
	const sampleRate = audioBuffer.sampleRate;
	const hopSize = segmentLength / 4;

	let weighted = 0, weight = 0;

	for (let offset = hopSize * 2; offset + segmentLength < channelData.length - hopSize * 2; offset += hopSize) {
		const segment = channelData.subarray(offset, offset + segmentLength); // safer than slice
		const [pitch, clarity] = detector.findPitch(segment, sampleRate);

		if (pitch && clarity > 0.5 && pitch >= clip[0] && pitch <= clip[1]) {
			weighted += pitch * clarity;
			weight += clarity;
		}
	}

	var result = weight > 0 ? weighted / weight : null;
	if (!(result >= clip[0] && result <= clip[1])) {
		result = null;
	}
	return isFinite(result) ? result : null;
}

async function playPureToneMelody(melody, { duration = 0.3, volume = 0.3, baseFreq = 440 } = {}) {
	const now = audioCtx.currentTime;

	melody.forEach(({ pitch, time }) => {
		const freq = baseFreq * Math.pow(2, pitch / 12);
		const start = now + time;

		const osc = audioCtx.createOscillator();
		const gain = audioCtx.createGain();

		osc.type = "sine";
		osc.frequency.value = freq;

		gain.gain.setValueAtTime(volume, start);
		gain.gain.linearRampToValueAtTime(0.0001, start + duration); // fade-out to prevent clicks

		osc.connect(gain).connect(audioCtx.destination);
		osc.start(start);
		osc.stop(start + duration + 0.01);
	});
}