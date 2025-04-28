export class Dot {
	constructor(x, y, radius) {
		this.x = x;
		this.y = y;
		this.u = 0.2;
		this.v = 0;
		this.xPrev = this.x;
		this.yPrev = this.y;
		this.uPrev = this.u;
		this.vPrev = this.v;
		this.radius = radius;
		this.colour = "blue";
		this.gravity = 0.5 / 1e3;
		this.maxSpeed =
			Math.sqrt(2 * Math.abs(this.gravity) * (canvas.height - this.y - this.radius));
		this.hasCollided = false;
		this.inFloatingMode = false;
	}

	update(deltaTime, canvasCtx) {
		// this.colour = "blue";

		this.xPrev = this.x;
		this.uPrev = this.u;
		this.yPrev = this.y;
		this.vPrev = this.v;

		// x-motion
		var xTarget = this.x + this.u * deltaTime;

		// y-motion
		if (this.inFloatingMode) {
			this.v += (-0.5 * this.gravity) * deltaTime;
		} else {
			this.v += this.gravity * deltaTime;
		}
		var yTarget = this.y + this.v * deltaTime;

		// Clamp position to canvas
		const clampedPos = clampPos2canvas(canvas, xTarget, yTarget, this);
		xTarget = clampedPos.x;
		yTarget = clampedPos.y;
		this.x = xTarget;
		this.y = yTarget;
		this.u = clampedPos.u;
		this.v = clampedPos.v;

		// Check for collision
		const collisionResult =
			checkPathCollision(canvasCtx, this.xPrev, this.yPrev, xTarget, yTarget, this.radius);
		this.hasCollided = collisionResult.hasCollided;
		const yCollision = collisionResult.y;

		// No collision
		if (!this.hasCollided) {
			this.x = xTarget;
			this.y = yTarget;
			this.inFloatingMode = false;
			return;
		}

		// Collision detected, but in floating mode, so no need to push out
		if (this.inFloatingMode) {
			this.x = xTarget;
			this.y = yTarget;
			return;
		}

		// Collision detected, but not in floating mode: try to push out
		const xTargetCollision = xTarget;
		const yTargetCollision = yCollision - (yTarget - yCollision);

		if (checkCollision(canvasCtx, xTargetCollision, yTargetCollision, this.radius)) {
			// Cannot push out of collision: enter floating mode
			this.x = xTarget;
			this.y = yTarget;
			this.inFloatingMode = true;
			return;
		}

		if (yTarget < this.yPrev) {
			// Collision from below, enter floating mode
			this.x = xTarget;
			this.y = yTarget;
			this.inFloatingMode = true;
			return;
		}

		// Collision from above
		this.x = xTargetCollision;
		this.y = yTargetCollision;
		this.v = -this.vPrev;
		console.log("Collision detected at:", this.x, this.y, "speed: ", this.u, this.v);
	}

	draw(ctx) {
		ctx.fillStyle = this.colour;
		ctx.beginPath();
		ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
		ctx.fill();
	}

	playSound(y, snap = true) {
		Tone.start();
		// Map dotZ (0 = top, canvas.height = bottom) to a musical pitch range
		const minPitch = 200; // lowest frequency (Hz)
		const maxPitch = 800; // highest frequency (Hz)

		const normFactor = 1 - (y / canvas.height); // 1 at top, 0 at bottom
		var frequency = minPitch + normFactor * (maxPitch - minPitch);
		if (snap) {
			frequency = noteId2frequency(frequency2noteId(frequency, true));
		}

		synth.triggerAttackRelease(frequency, "8n");
	}
}

function checkCollision(ctx, dotX, dotY, radius) {
	const steps = 16; // how many points around the circle to sample
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
			console.error("Error getting pixel data at ", sampleX, sampleY, ": ", e);
		}
		const brightness = (pixel[0] + pixel[1] + pixel[2]) / 3;

		if (brightness < 10 && pixel[3] > 0) {
			// console.log("Collision detected at:", sampleX, sampleY, "brightness:", brightness);
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

function clampPos2canvas(canvas, x, y, dot) {
	if (y > canvas.height - dot.radius) {
		y = canvas.height - dot.radius;
		dot.y = y;
		dot.v = -dot.maxSpeed;
	} else if (y < dot.radius) {
		y = dot.radius;
		dot.y = y;
		dot.v = -dot.vPrev;
	}
	if (x < dot.radius) {
		x = dot.radius - (x - dot.radius);
		dot.x = x;
		dot.u = -dot.uPrev;
		// console.log("Collision with left wall:", this.x, this.y, "speed: ", this.u);
	} else if (x > canvas.width - dot.radius) {
		x = (canvas.width - dot.radius) - (x - (canvas.width - dot.radius));
		dot.x = x;
		dot.u = -this.uPrev;
		// console.log("Collision with right wall:", this.x, this.y, "speed: ", this.u);
	}
	return { x: x, y: y, u: dot.u, v: dot.v };
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

function playBounceSound(y, snap = true) {
	Tone.start();
	// Map dotZ (0 = top, canvas.height = bottom) to a musical pitch range
	const minPitch = 200; // lowest frequency (Hz)
	const maxPitch = 800; // highest frequency (Hz)

	const normalized = 1 - (y / canvas.height); // 1 at top, 0 at bottom
	var frequency = minPitch + normalized * (maxPitch - minPitch);
	if (snap) {
		frequency = noteId2frequency(frequency2noteId(frequency, true));
	}

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