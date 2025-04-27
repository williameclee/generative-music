export class Dot {
	constructor(x, y, radius) {
		this.x = x;
		this.y = y;
		this.u = 0;
		this.v = 0;
		this.xPrev = x;
		this.yPrev = y;
		this.uPrev = 0;
		this.vPrev = 0;
		this.radius = radius;
		this.colour = "blue";
		this.gravity = 0.5 / 1e3;
		this.maxSpeed = Math.sqrt(2 * Math.abs(this.gravity) * (canvas.height - this.y - this.radius));
	}

	update(deltaTime, canvasCtx) {
		var hasCollided = false;
		this.colour = "blue";

		this.yPrev = this.y;
		this.vPrev = this.v;

		if (checkCollision(canvasCtx, this.x, this.y, this.radius)) {
			// console.log("Between frames collision detected at:", this.x, this.y);
			this.colour = "red";
			let pushUp = true;
			if (this.v > 0) {
				pushUp = false;
			}
			const pos = pushOutOfCollision(canvasCtx, this.x, this.y, this.radius, pushUp);
			this.x = pos.x;
			this.y = pos.y;
			if (pushUp) {
				this.v = -Math.abs(this.vPrev);
			} else {
				this.v = Math.abs(this.v);
			}
			const playSound = document.getElementById("toggleSound").checked;
			if (playSound) {
				playBounceSound(this.y)
			} else {
				// console.log("Sound is off");
			};
			return;
		}

		// Gravity pulls it down
		this.v += this.gravity * deltaTime;
		var yTarget = this.y + this.v * deltaTime;

		// Floor clamp
		if (yTarget > canvas.height - this.radius) {
			yTarget = canvas.height - this.radius;
			this.y = yTarget;
			this.v = -this.maxSpeed;
		} else if (yTarget < this.radius) {
			yTarget = this.radius;
			this.y = yTarget;
			this.v = -this.vPrev; // From energy conservation
		}

		const collisionResult =
			checkPathCollision(canvasCtx, this.xPrev, this.yPrev, this.x, yTarget, this.radius);
		hasCollided = collisionResult.hasCollided;
		this.x = collisionResult.x;
		this.y = collisionResult.y;

		if (hasCollided) {
			this.v = -this.vPrev;
			// console.log("Collision detected at:", this.x, this.y, "speed: ", this.v);
			const playSound = document.getElementById("toggleSound").checked;
			if (playSound) {
				playBounceSound(this.y)
			} else {
				// console.log("Sound is off");
			};
		}
	}

	draw(ctx) {
		ctx.fillStyle = this.colour;
		ctx.beginPath();
		ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
		ctx.fill();
	}
}

function checkCollision(ctx, dotX, dotY, radius) {
	const steps = 8; // how many points around the circle to sample
	for (let i = 0; i < steps; i++) {
		const angle = (i / steps) * 2 * Math.PI;
		const sampleX = Math.round(dotX + radius * Math.cos(angle));
		const sampleY = Math.round(dotY + radius * Math.sin(angle));

		// Make sure sample inside canvas
		if (sampleX < 0 || sampleX >= canvas.width || sampleY < 0 || sampleY >= canvas.height) continue;
		let pixel;
		try {
			pixel = ctx.getImageData(sampleX, sampleY, 1, 1).data;
		} catch (e) {
			// console.log("Sampled pixel at:", sampleX, sampleY);
			console.error("Error getting pixel data:", e);
		}
		const brightness = (pixel[0] + pixel[1] + pixel[2]) / 3;

		if (brightness < 10) {
			return true; // collision detected
		}
	}
	return false; // no collision
}

function checkPathCollision(ctx, startX, startY, endX, endY, radius, steps = 10) {
	let x = startX, y = startY;
	let prevX = x, prevY = y;
	for (let t = 0; t <= 1; t += 1 / steps) {
		x = startX + t * (endX - startX);
		y = startY + t * (endY - startY);

		if (isNaN(x) || isNaN(y)) {
			console.error("NaN detected in path collision check", prevX, prevY, x, y);
			continue;
		}

		if (checkCollision(ctx, x, y, radius)) {
			return { hasCollided: true, x: prevX, y: prevY }
		}
		prevX = x;
		prevY = y;
	}
	return { hasCollided: false, x: endX, y: endY }
}


function pushOutOfCollision(ctx, x, y, radius, pushUp = true) {
	var pushCount = 0;

	while (checkCollision(ctx, x, y, radius)) {
		if (pushUp) {
			y -= 1;
		} else {
			y += 1;
		}
		pushCount += 1;
	}
	if (checkCollision(ctx, x, y, radius)) {
		console.error("Push out of collision failed at:", x, y);
		return { x: x, y: y };
	}
	// console.log("Pushed out of collision at:", x, y, "after", pushCount, "steps");
	return { x: x, y: y };
}

function playBounceSound(dotZ) {
	Tone.start();
	// Map dotZ (0 = top, canvas.height = bottom) to a musical pitch range
	const minPitch = 200; // lowest frequency (Hz)
	const maxPitch = 800; // highest frequency (Hz)

	const normalized = 1 - (dotZ / canvas.height); // 1 at top, 0 at bottom
	var frequency = minPitch + normalized * (maxPitch - minPitch);
	frequency = noteId2frequency(frequency2noteId(frequency, true));

	synth.triggerAttackRelease(frequency, "8n");
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