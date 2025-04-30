export class Dot {
	constructor(x, radius) {
		this.x = x;
		this.y = 0;
		this.u = 0;
		this.u0 = 1.2;
		this.v = 0;
		this.r = radius;
		this.g = 12;
		this.vViscosity = 4;
		this.hViscosity = 2;
		this.xPrev = this.x;
		this.yPrev = this.y;
		this.uPrev = this.u;
		this.vPrev = this.v;
		this.xTarget = this.x;
		this.yTarget = this.y;
		this.colour = "blue";
		this.hasCollided = false;
		this.hasCollidedWithGround = false;
		this.prevCollidedWithGround = false;
		this.inSlowMo = false;
		this.inFloatingMode = false;
	}

	update(deltaTime, collisionImgBuffer, idleTime) {
		this.xPrev = this.x;
		this.uPrev = this.u;
		this.yPrev = this.y;
		this.vPrev = this.v;

		if (this.hasCollidedWithGround) {
			this.prevCollidedWithGround = true;
		}

		// x-motion
		if (idleTime > 4) {
			this.u -= this.hViscosity * this.u * deltaTime * 0.5;
		} else {
			if (this.inSlowMo) {
				this.u -= this.hViscosity * this.u * deltaTime;
			} else {
				if (idleTime > 1) {
					this.u += this.hViscosity * (this.u0 - this.u) * deltaTime;
				} else {
					this.u += this.hViscosity * (this.u0 * 1.5 - this.u) * deltaTime;
				}
			}
			this.u = Math.max(this.u, this.u0 * 0.5);
		}
		this.xTarget = this.x + this.u * deltaTime;

		// y-motion
		if (this.inSlowMo) {
			this.v -= this.vViscosity * this.v * deltaTime;
			this.v += (0.2 * this.g) * deltaTime;
		} else if (this.inFloatingMode) {
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
		this.hasCollided = collisionResult.hasCollided > 0;
		if (this.hasCollided) {
			this.prevCollidedWithGround = false;
		}
		const yCollision = collisionResult.y;

		// No collision
		if (collisionResult.hasCollided == 0) {
			this.hasCollided = false;
			this.x = this.xTarget;
			this.y = this.yTarget;
			this.inFloatingMode = false;
			this.inSlowMo = false;
			return;
		} else if (collisionResult.hasCollided == 2) {
			this.hasCollided = true;
			this.x = this.xTarget;
			this.y = this.yTarget;
			this.inFloatingMode = false;
			this.inSlowMo = true;
			return;
		}

		// Collision detected, but in floating mode, so no need to push out
		if (this.inFloatingMode || this.inSlowMo) {
			this.x = this.xTarget;
			this.y = this.yTarget;
			if (collisionResult.hasCollided == 1) {
				this.inFloatingMode = true;
				this.inSlowMo = false;
			} else if (collisionResult.hasCollided == 2) {
				this.inFloatingMode = false;
				this.inSlowMo = true;
			}
			return;
		}

		// Collision detected, but not in floating mode: try to push out
		const xTargetCollision = this.xTarget;
		const yTargetCollision = yCollision - (this.yTarget - yCollision);

		const origCollisionResult = checkCollision(
			collisionImgBuffer, xTargetCollision, yTargetCollision,
			this.r, this.xScale, this.yScale);
		if (origCollisionResult == 1) {
			// Cannot push out of collision: enter floating mode
			this.x = this.xTarget;
			this.y = this.yTarget;
			this.inFloatingMode = true;
			return;
		} else if (origCollisionResult == 2) {
			// Soft collision: enter floating mode
			this.x = this.xTarget;
			this.y = this.yTarget;
			this.inSlowMo = true;
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
		} else if (randomFactor < 0.8) {
			this.v *= 2;
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
}

function checkCollision(collisionImgBuffer, dotX, dotY, radius, xScale, yScale) {
	const steps = 4; // how many points around the circle to sample
	for (let i = 0; i < steps; i++) {
		const angle = (i / steps) * 2 * Math.PI;
		const sampleX = Math.round(dotX * xScale + radius * Math.cos(angle));
		const sampleY = Math.round(dotY * yScale + radius * Math.sin(angle));

		// Make sure sample inside canvas
		if (sampleX < 0 || sampleX >= canvas.width || sampleY < 0 || sampleY >= canvas.height) continue;
		let alpha;
		let r;
		try {
			const alphaId = (sampleY * collisionImgBuffer.width + sampleX) * 4 + 3;
			alpha = collisionImgBuffer.data[alphaId];
			const rId = (sampleY * collisionImgBuffer.width + sampleX) * 4;
			r = collisionImgBuffer.data[rId];
		} catch (e) {
			console.error("Error getting pixel data at ", sampleX, sampleY, ": ", e);
		}

		if (alpha > 0) {
			if (r > 50) {
				return 2; // soft collision
			}
			return 1; // hard collision
		}
	}
	return 0; // no collision
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

		const collisionResult = checkCollision(collisionImgBuffer, x, y, radius, xScale, yScale)
		if (collisionResult > 0) {
			return { hasCollided: collisionResult, x: prevX, y: prevY }
		}
		prevX = x;
		prevY = y;
	}
	return { hasCollided: 0, x: endX, y: endY }
}