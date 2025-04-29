export class Dot {
	constructor(x, radius) {
		this.x = x;
		this.y = 0;
		this.u = 1;
		this.v = 0;
		this.xPrev = this.x;
		this.yPrev = this.y;
		this.uPrev = this.u;
		this.vPrev = this.v;
		this.xTarget = this.x;
		this.yTarget = this.y;
		this.r = radius;
		this.colour = "blue";
		this.hasCollided = false;
		this.hasCollidedWithGround = false;
		this.prevCollidedWithGround = false;
		this.inFloatingMode = false;
	}

	update(deltaTime, collisionImgBuffer) {
		this.xPrev = this.x;
		this.uPrev = this.u;
		this.yPrev = this.y;
		this.vPrev = this.v;

		if (this.hasCollidedWithGround) {
			this.prevCollidedWithGround = true;
		}

		// x-motion
		this.xTarget = this.x + this.u * deltaTime;

		// y-motion
		if (this.inFloatingMode) {
			this.v += (-0.5 * this.g) * deltaTime;
		} else {
			this.v += this.g * deltaTime;
		}
		this.yTarget = this.y + this.v * deltaTime;

		// Clamp position to canvas
		this.clampPos2canvas(this);

		// Check for collision
		const collisionResult =
			checkPathCollision(collisionImgBuffer, this.xPrev, this.yPrev, this.xTarget, this.yTarget, this.r, this.xScale, this.yScale);
		this.hasCollided = collisionResult.hasCollided;
		if (this.hasCollided) {
			this.prevCollidedWithGround = false;
		}
		const yCollision = collisionResult.y;

		// No collision
		if (!this.hasCollided) {
			this.x = this.xTarget;
			this.y = this.yTarget;
			this.inFloatingMode = false;
			return;
		}

		// Collision detected, but in floating mode, so no need to push out
		if (this.inFloatingMode) {
			this.x = this.xTarget;
			this.y = this.yTarget;
			return;
		}

		// Collision detected, but not in floating mode: try to push out
		const xTargetCollision = this.xTarget;
		const yTargetCollision = yCollision - (this.yTarget - yCollision);

		if (checkCollision(collisionImgBuffer, xTargetCollision, yTargetCollision, this.r, this.xScale, this.yScale)) {
			// Cannot push out of collision: enter floating mode
			this.x = this.xTarget;
			this.y = this.yTarget;
			this.inFloatingMode = true;
			return;
		}

		if (this.yTarget < this.yPrev) {
			// Collision from below, enter floating mode
			this.x = this.xTarget;
			this.y = this.yTarget;
			this.inFloatingMode = true;
			return;
		}

		// Collision from above
		this.x = xTargetCollision;
		this.y = yTargetCollision;
		this.v = -Math.sign(this.vPrev) * this.maxSpeed;
		const randomFactor = Math.random();
		if (randomFactor < 0.7) {
			this.v *= 1 / 2;
		}
		// console.log(`Collision detected at: x = ${this.x.toFixed(2)}, y = ${this.y.toFixed(2)}, u = ${this.u.toFixed(2)}, v = ${this.v.toFixed(2)}`);
	}

	clampPos2canvas() {
		this.hasCollidedWithGround = false;
		if (this.yTarget > this.height - this.ry) {
			this.yTarget = this.height - this.ry;
			this.y = this.yTarget;
			this.v = -this.maxSpeed;
			this.hasCollidedWithGround = true;
			// console.log(`Collision with ground: x = ${this.x.toFixed(2)}, y = ${this.y.toFixed(2)}, u = ${this.u.toFixed(2)}, v = ${this.v.toFixed(2)}`);
		} else if (this.yTarget < this.ry) {
			// this.yTarget = this.ry;
			// this.y = this.yTarget;
			// this.v = -this.vPrev;
			// this.hasCollidedWithGround = true;
			// this.prevCollidedWithGround = true;
			// console.log(`Collision with ceiling: x = ${this.x.toFixed(2)}, y = ${this.y.toFixed(2)}, u = ${this.u.toFixed(2)}, v = ${this.v.toFixed(2)}`);
		}
		if (this.xTarget < this.rx) {
			this.xTarget = this.rx - (this.x - this.rx);
			this.x = this.xTarget;
			this.u = -this.uPrev;
			// this.hasCollidedWithGround = true;
			// this.prevCollidedWithGround = true;
			// console.log(`Collision with left wall: x = ${this.x.toFixed(2)}, y = ${this.y.toFixed(2)}, u = ${this.u.toFixed(2)}, v = ${this.v.toFixed(2)}`);
		} else if (this.xTarget > this.width - this.rx) {
			this.xTarget = (this.width - this.rx) - (this.x - (this.width - this.rx));
			this.x = this.xTarget;
			this.u = -this.uPrev;
			// this.hasCollidedWithGround = true;
			// this.prevCollidedWithGround = true;
			// console.log(`Collision with right wall: x = ${this.x.toFixed(2)}, y = ${this.y.toFixed(2)}, u = ${this.u.toFixed(2)}, v = ${this.v.toFixed(2)}`);
		}
	}

	draw(ctx) {
		ctx.fillStyle = this.colour;
		ctx.beginPath();
		ctx.arc(this.x * this.xScale, this.y * this.yScale, this.r, 0, Math.PI * 2);
		ctx.fill();
	}

	async playSound(y, snapPitch = true) {
		Tone.start();
		const minPitch = 110; // lowest frequency (Hz)
		const maxPitch = 880; // highest frequency (Hz)

		const normFactor = Math.max(Math.min(1 - (y / this.height), 1), 0); // 1 at top, 0 at bottom
		var frequency = minPitch + normFactor * (maxPitch - minPitch);
		if (snapPitch) {
			frequency = noteId2frequency(frequency2noteId(frequency, true));
		}
		synth.triggerAttackRelease(frequency, "8n");
	}
}

function checkCollision(collisionImgBuffer, dotX, dotY, radius, xScale, yScale) {
	const steps = 4; // how many points around the circle to sample
	for (let i = 0; i < steps; i++) {
		const angle = (i / steps) * 2 * Math.PI;
		const sampleX = Math.round(dotX * xScale + radius * Math.cos(angle));
		const sampleY = Math.round(dotY * yScale + radius * Math.sin(angle));

		// Make sure sample inside canvas
		if (sampleX < 0 || sampleX >= canvas.width || sampleY < 0 || sampleY >= canvas.height) continue;
		let pixel;
		try {
			const alphaId = (sampleY * collisionImgBuffer.width + sampleX) * 4 + 3;
			pixel = collisionImgBuffer.data[alphaId];
		} catch (e) {
			console.error("Error getting pixel data at ", sampleX, sampleY, ": ", e);
		}

		if (pixel > 0) {
			return true; // collision detected
		}
	}
	return false; // no collision
}

function checkPathCollision(collisionImgBuffer, startX, startY, endX, endY, radius, xScale, yScale, steps = 6) {
	let x = startX, y = startY;
	let prevX = x, prevY = y;
	for (let t = 0; t <= 1; t += 1 / steps) {
		x = startX + t * (endX - startX);
		y = startY + t * (endY - startY);

		if (isNaN(x) || isNaN(y)) {
			console.error("NaN detected in path collision check", prevX, prevY, x, y);
			continue;
		}

		if (checkCollision(collisionImgBuffer, x, y, radius, xScale, yScale)) {
			return { hasCollided: true, x: prevX, y: prevY }
		}
		prevX = x;
		prevY = y;
	}
	return { hasCollided: false, x: endX, y: endY }
}