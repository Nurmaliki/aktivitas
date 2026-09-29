import { describe, expect, it } from 'vitest';
import { clampStepGoal } from '$lib/services/db';
import { DEFAULT_SETTINGS, MAX_STEPS_PER_DAY, MAX_STEP_GOAL, MIN_STEP_GOAL } from '$lib/types/steps';
import { StepDetector } from '$lib/services/motionSensor';

describe('clampStepGoal', () => {
	it('keeps values inside the allowed range', () => {
		expect(clampStepGoal(8000)).toBe(8000);
	});

	it('clamps below the minimum', () => {
		expect(clampStepGoal(10)).toBe(MIN_STEP_GOAL);
	});

	it('clamps above the maximum', () => {
		expect(clampStepGoal(999999)).toBe(MAX_STEP_GOAL);
	});

	it('falls back to the default for invalid values', () => {
		expect(clampStepGoal(NaN)).toBe(DEFAULT_SETTINGS.stepGoal);
		expect(clampStepGoal(Infinity)).toBe(DEFAULT_SETTINGS.stepGoal);
	});

	it('rounds fractional values', () => {
		expect(clampStepGoal(7321.6)).toBe(7322);
	});
});

describe('StepDetector', () => {
	/** Feed a synthetic oscillation that should be counted as steps. */
	function feedSteps(detector: StepDetector, count: number, amplitude = 12) {
		let t = 1000;
		for (let i = 0; i < count; i++) {
			// Resting gravity on Z, then a forward/back swing.
			detector.process(0, 0, 9.81, t);
			t += 100;
			detector.process(0, amplitude, 9.81 + amplitude, t);
			t += 300;
			detector.process(0, 0, 9.81, t);
			t += 400;
		}
	}

	it('starts at zero', () => {
		const detector = new StepDetector(() => {});
		expect(detector.stepCount).toBe(0);
	});

	it('counts oscillations as steps', () => {
		const detector = new StepDetector(() => {});
		feedSteps(detector, 5);
		expect(detector.stepCount).toBeGreaterThanOrEqual(1);
		expect(detector.stepCount).toBeLessThanOrEqual(5);
	});

	it('ignores non-finite samples', () => {
		const detector = new StepDetector(() => {});
		detector.process(NaN, 0, 9.81, 1000);
		expect(detector.stepCount).toBe(0);
	});

	it('resets the count and internal state', () => {
		const detector = new StepDetector(() => {});
		feedSteps(detector, 5);
		detector.reset(0);
		expect(detector.stepCount).toBe(0);
	});

	it('notifies the callback when a step is detected', () => {
		let calls = 0;
		const detector = new StepDetector(() => {
			calls += 1;
		});
		feedSteps(detector, 3);
		expect(calls).toBe(detector.stepCount);
	});

	it('does not exceed the humanly-possible step rate for rapid noise', () => {
		const detector = new StepDetector(() => {});
		let t = 0;
		// 100 rapid oscillations within 1 second should not produce 100 steps.
		for (let i = 0; i < 100; i++) {
			detector.process(0, 0, 9.81, t);
			t += 2;
			detector.process(0, 15, 25, t);
			t += 2;
		}
		expect(detector.stepCount).toBeLessThan(20);
	});
});

describe('step limits', () => {
	it('defines a sane per-day maximum', () => {
		expect(MAX_STEPS_PER_DAY).toBe(200000);
	});
});
