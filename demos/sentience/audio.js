export class AudioEngine {
    constructor() {
        this.ctx = null;
        this.oscillators = [];
        this.masterGain = null;
        this.isStarted = false;
        this.currentState = 'calm';
    }

    init() {
        if (this.isStarted) return;

        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(0.1, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);

        this.createDrone();
        this.isStarted = true;
    }

    createDrone() {
        // Create a base low-frequency drone
        const osc1 = this.ctx.createOscillator();
        const gain1 = this.ctx.createGain();

        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(55, this.ctx.currentTime); // A1

        gain1.gain.setValueAtTime(0.1, this.ctx.currentTime);

        osc1.connect(gain1);
        gain1.connect(this.masterGain);

        osc1.start();
        this.oscillators.push({ osc: osc1, gain: gain1, baseFreq: 55 });

        // Add a second harmonic
        const osc2 = this.ctx.createOscillator();
        const gain2 = this.ctx.createGain();

        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(110, this.ctx.currentTime); // A2

        gain2.gain.setValueAtTime(0.05, this.ctx.currentTime);

        osc2.connect(gain2);
        gain2.connect(this.masterGain);

        osc2.start();
        this.oscillators.push({ osc: osc2, gain: gain2, baseFreq: 110 });
    }

    updateState(state) {
        if (!this.isStarted) return;
        this.currentState = state;

        const now = this.ctx.currentTime;

        switch (state) {
            case 'calm':
                this.rampFrequency(0, 55);
                this.rampGain(0, 0.1);
                this.rampFrequency(1, 110);
                this.rampGain(1, 0.05);
                this.masterGain.gain.exponentialRampToValueAtTime(0.1, now + 2);
                break;
            case 'anxious':
                this.rampFrequency(0, 60);
                this.rampGain(0, 0.2);
                this.rampFrequency(1, 130);
                this.rampGain(1, 0.1);
                this.masterGain.gain.exponentialRampToValueAtTime(0.3, now + 1);
                break;
            case 'curious':
                this.rampFrequency(0, 70);
                this.rampGain(0, 0.15);
                this.rampFrequency(1, 140);
                this.rampGain(1, 0.08);
                break;
            case 'distracted':
                this.rampFrequency(0, 40);
                this.rampFrequency(1, 200);
                // Every other state adjusts the master gain; this one did not,
                // so 'distracted' inherited whatever volume the previous mood
                // had left behind — including the loud 0.5 of 'overwhelmed'.
                this.masterGain.gain.exponentialRampToValueAtTime(0.15, now + 1.5);
                break;
            case 'overwhelmed':
                this.rampGain(0, 0.4);
                this.rampGain(1, 0.3);
                this.masterGain.gain.exponentialRampToValueAtTime(0.5, now + 0.5);
                break;
        }
    }

    rampFrequency(index, freq) {
        if (this.oscillators[index]) {
            // exponentialRampToValueAtTime throws on a target of 0 and ignores
            // a ramp that has no anchored starting value, so pin the current
            // value first.
            const param = this.oscillators[index].osc.frequency;
            param.cancelScheduledValues(this.ctx.currentTime);
            param.setValueAtTime(Math.max(param.value, 0.0001), this.ctx.currentTime);
            param.exponentialRampToValueAtTime(Math.max(freq, 0.0001), this.ctx.currentTime + 2);
        }
    }

    rampGain(index, value) {
        if (this.oscillators[index]) {
            const param = this.oscillators[index].gain.gain;
            param.cancelScheduledValues(this.ctx.currentTime);
            param.setValueAtTime(Math.max(param.value, 0.0001), this.ctx.currentTime);
            param.exponentialRampToValueAtTime(Math.max(value, 0.0001), this.ctx.currentTime + 2);
        }
    }
}
