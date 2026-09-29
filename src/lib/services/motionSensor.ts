/**
 * Device-motion based step detection.
 *
 * Browsers do not expose a native "step counter" API. We approximate steps by
 * running peak detection over the accelerometer stream from
 * `DeviceMotionEvent`. This is intentionally simple and is *not* medically
 * accurate — it is a best-effort feature that only works on devices with a
 * motion sensor (typically phones), and only while the page is open.
 *
 * All access to `window`/`DeviceMotionEvent` is guarded so this module is safe
 * to import during SSR.
 */

export type SensorStatus =
	| 'unsupported'
	| 'permission-required'
	| 'denied'
	| 'ready'
	| 'active'
	| 'error';

export interface SensorCallbacks {
	/** Called whenever the accumulated step count increases. */
	onSteps?: (steps: number) => void;
	/** Called when the detection status changes. */
	onStatus?: (status: SensorStatus, message?: string) => void;
}

export interface MotionPermissionRequester {
	requestPermission?: () => Promise<'granted' | 'denied' | 'default'>;
}

/** Feature-detect motion-sensor support in a way that is SSR-safe. */
export function isMotionSupported(): boolean {
	if (typeof window === 'undefined') return false;
	return typeof (window as unknown as { DeviceMotionEvent?: unknown }).DeviceMotionEvent !== 'undefined';
}

/** True when the platform requires an explicit permission prompt (iOS 13+). */
export function motionPermissionRequired(): boolean {
	if (!isMotionSupported()) return false;
	const ctor = (window as unknown as { DeviceMotionEvent?: MotionPermissionRequester })
		.DeviceMotionEvent;
	return typeof ctor?.requestPermission === 'function';
}

/**
 * Simple, self-contained step detector using accelerometer magnitude peaks.
 *
 * The algorithm tracks the acceleration magnitude, applies a low-pass filter to
 * estimate gravity, then counts a step each time the high-passed signal crosses
 * an upper threshold and then falls back below a lower threshold (hysteresis),
 * with a minimum interval between steps.
 */
export class StepDetector {
	private lastTimestamp = 0;
	private smoothedMagnitude = 0;
	private aboveThreshold = false;
	private lastStepAt = 0;
	private steps = 0;

	/** Minimum time between two counted steps (ms). ~2.5 steps/second max. */
	private readonly minStepIntervalMs = 250;
	/** Upper/lower hysteresis thresholds on the linear-acceleration magnitude. */
	private readonly highThreshold = 1.6;
	private readonly lowThreshold = 0.6;
	/** Low-pass filter factor for the gravity estimate. */
	private readonly smoothing = 0.85;

	constructor(private readonly onStep: () => void) {}

	get stepCount(): number {
		return this.steps;
	}

	reset(steps = 0): void {
		this.steps = steps;
		this.aboveThreshold = false;
		this.lastStepAt = 0;
		this.lastTimestamp = 0;
		this.smoothedMagnitude = 0;
	}

	/** Feed a single acceleration sample (in m/s²). */
	process(x: number, y: number, z: number, timestamp: number): void {
		if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return;

		// If timestamps jump backwards (or are missing), restart the baseline.
		if (this.lastTimestamp === 0 || timestamp < this.lastTimestamp) {
			this.lastTimestamp = timestamp;
			this.smoothedMagnitude = Math.sqrt(x * x + y * y + z * z);
			return;
		}

		const magnitude = Math.sqrt(x * x + y * y + z * z);
		// Low-pass filter to track gravity (~9.81 on a device at rest).
		this.smoothedMagnitude =
			this.smoothing * this.smoothedMagnitude + (1 - this.smoothing) * magnitude;
		const linear = magnitude - this.smoothedMagnitude;

		if (!this.aboveThreshold && linear > this.highThreshold) {
			this.aboveThreshold = true;
		} else if (this.aboveThreshold && linear < this.lowThreshold) {
			this.aboveThreshold = false;
			if (timestamp - this.lastStepAt >= this.minStepIntervalMs) {
				this.lastStepAt = timestamp;
				this.steps += 1;
				this.onStep();
			}
		}

		this.lastTimestamp = timestamp;
	}
}

/**
 * Owns the `devicemotion` listener and the permission flow.
 * Call `start()` to begin and `stop()` to remove the listener.
 */
export class MotionSensor {
	private detector: StepDetector;
	private listening = false;
	private status: SensorStatus = 'unsupported';
	private message: string | undefined;

	constructor(private readonly callbacks: SensorCallbacks) {
		this.detector = new StepDetector(() => {
			callbacks.onSteps?.(this.detector.stepCount);
		});
	}

	private setStatus(status: SensorStatus, message?: string): void {
		this.status = status;
		this.message = message;
		this.callbacks.onStatus?.(status, message);
	}

	/** Current sensor status. */
	get currentStatus(): SensorStatus {
		return this.status;
	}

	get currentMessage(): string | undefined {
		return this.message;
	}

	/**
	 * Ensure motion permission, then start listening.
	 * Returns the resulting status.
	 */
	async start(initialSteps = 0): Promise<SensorStatus> {
		this.detector.reset(initialSteps);

		if (!isMotionSupported()) {
			this.setStatus('unsupported', 'Perangkat ini tidak mendukung sensor gerakan.');
			return this.status;
		}

		if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
			// Still attempt; browsers throttle background tabs but we can resume.
		}

		if (motionPermissionRequired()) {
			this.setStatus('permission-required');
			try {
				const ctor = (window as unknown as { DeviceMotionEvent: MotionPermissionRequester })
					.DeviceMotionEvent;
				const result = await ctor.requestPermission?.();
				if (result !== 'granted') {
					this.setStatus('denied', 'Izin sensor gerakan ditolak.');
					return this.status;
				}
			} catch (error) {
				this.setStatus(
					'error',
					error instanceof Error ? error.message : 'Gagal meminta izin sensor.'
				);
				return this.status;
			}
		}

		return this.listen();
	}

	private listen(): SensorStatus {
		if (typeof window === 'undefined') return this.status;
		try {
			window.addEventListener('devicemotion', this.handleMotion, { passive: true });
			this.listening = true;
			this.setStatus('active', 'Sensor aktif. Letakkan perangkat di saku atau genggam saat berjalan.');
		} catch (error) {
			this.setStatus(
				'error',
				error instanceof Error ? error.message : 'Gagal mengaktifkan sensor gerakan.'
			);
		}
		return this.status;
	}

	/** Stop listening and remove the listener. */
	stop(): void {
		if (typeof window !== 'undefined' && this.listening) {
			window.removeEventListener('devicemotion', this.handleMotion);
			this.listening = false;
		}
		if (this.status === 'active') this.setStatus('ready', 'Sensor dihentikan.');
	}

	get stepCount(): number {
		return this.detector.stepCount;
	}

	private handleMotion = (event: DeviceMotionEvent): void => {
		// Linear acceleration is preferred; fall back to raw accelerationWithGravity.
		const acceleration = event.acceleration ?? event.accelerationIncludingGravity;
		if (!acceleration) return;
		const x = acceleration.x ?? 0;
		const y = acceleration.y ?? 0;
		const z = acceleration.z ?? 0;
		// `event.timeStamp` is a DOMHighResTimeStamp in ms.
		const timestamp = typeof event.timeStamp === 'number' ? event.timeStamp : Date.now();
		this.detector.process(x, y, z, timestamp);
	};
}
