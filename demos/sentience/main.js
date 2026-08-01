import { BehaviorMonitor } from './behavior.js';
import { AudioEngine } from './audio.js';

class EmotionalEngine {
    constructor() {
        this.state = 'calm'; // Default state
        this.emotions = {
            calm: 1,
            anxious: 0,
            curious: 0,
            distracted: 0,
            overwhelmed: 0
        };
    }

    update(metrics) {
        // Fuzzy logic to determine emotional state
        const scores = {
            calm: 0,
            anxious: 0,
            curious: 0,
            distracted: 0,
            overwhelmed: 0
        };

        // Calm: Low speed, low erraticness, low frequency
        if (metrics.mouseSpeed < 0.5 && metrics.mouseErraticness < 0.2) scores.calm += 1;
        if (metrics.idleTime > 5) scores.calm += 2;

        // Anxious: High erraticness, high click frequency
        if (metrics.mouseErraticness > 1.5) scores.anxious += 2;
        if (metrics.clickFrequency > 2) scores.anxious += 2;
        if (metrics.mouseSpeed > 2) scores.anxious += 1;

        // Curious: Moderate speed, high scroll
        if (metrics.scrollSpeed > 50 && metrics.mouseSpeed < 2) scores.curious += 2;
        if (metrics.mouseSpeed > 0.5 && metrics.mouseSpeed < 2 && metrics.mouseErraticness < 0.5) scores.curious += 1;

        // Distracted: High speed but very erratic jumps
        if (metrics.mouseSpeed > 3 && metrics.mouseErraticness > 2) scores.distracted += 2;

        // Overwhelmed: Very high metrics followed by sudden idle
        if (metrics.mouseSpeed > 5 || metrics.clickFrequency > 5) scores.overwhelmed += 3;

        // Find max score
        let maxScore = -1;
        let nextState = this.state;
        for (const [state, score] of Object.entries(scores)) {
            if (score > maxScore) {
                maxScore = score;
                nextState = state;
            }
        }

        if (nextState !== this.state) {
            this.state = nextState;
            this.applyState();
        }
    }

    applyState() {
        // Replace only the mood class instead of clobbering className, which
        // would wipe out any other class on <body>.
        document.body.classList.remove(...Object.keys(this.emotions));
        document.body.classList.add(this.state);
        this.triggerVisualEffects();
    }

    triggerVisualEffects() {
        const root = document.documentElement;
        switch (this.state) {
            case 'calm':
                root.style.setProperty('--bg-color', '#050508');
                root.style.setProperty('--blur-amount', '20px');
                root.style.setProperty('--text-blur', '0px');
                break;
            case 'anxious':
                root.style.setProperty('--bg-color', '#1a0505');
                root.style.setProperty('--blur-amount', '0px');
                root.style.setProperty('--text-blur', '1px');
                break;
            case 'curious':
                root.style.setProperty('--bg-color', '#051a1a');
                root.style.setProperty('--blur-amount', '10px');
                root.style.setProperty('--text-blur', '0px');
                break;
            case 'distracted':
                root.style.setProperty('--bg-color', '#1a1a05');
                root.style.setProperty('--blur-amount', '40px');
                root.style.setProperty('--text-blur', '2px');
                break;
            case 'overwhelmed':
                root.style.setProperty('--bg-color', '#1a1a1a');
                root.style.setProperty('--blur-amount', '5px');
                root.style.setProperty('--text-blur', '4px');
                break;
        }
    }
}

class SentienceApp {
    constructor() {
        this.monitor = new BehaviorMonitor();
        this.engine = new EmotionalEngine();
        this.audio = new AudioEngine();
        this.thoughtElement = document.getElementById('thought-marker');

        this.thoughts = {
            returner: [
                "You have returned. The space remembers your presence.",
                "Back again? The air here feels familiar to you.",
                "Your pattern is known to us now."
            ],
            calm: [
                "The rhythm of your presence is steady.",
                "Time slows in your stillness.",
                "There is no rush in this void."
            ],
            anxious: [
                "Your movement betrays a search.",
                "The shadows dance with your hesitation.",
                "Why do you vibrate with such intensity?"
            ],
            curious: [
                "You are looking deep into the layers.",
                "The details respond to your attention.",
                "There is much to find when you look closely."
            ],
            distracted: [
                "Your focus is a flickering candle.",
                "The surface is not the depth.",
                "Where does your mind wander?"
            ],
            overwhelmed: [
                "The signal is too loud.",
                "Silence is the only response to such noise.",
                "Retreat into the quiet."
            ]
        };

        this.lastThoughtTime = 0;
        this.isReturning = localStorage.getItem('visited') === 'true';
        localStorage.setItem('visited', 'true');

        this.start();
    }

    start() {
        // The engine starts in 'calm' but only wrote a class on a state
        // CHANGE, so <body> had no class at all on load and the calm styling
        // never applied until the mood happened to shift.
        this.engine.applyState();

        // Periodic engine update
        setInterval(() => {
            const metrics = this.monitor.getSummary();
            const oldState = this.engine.state;
            this.engine.update(metrics);

            if (this.engine.state !== oldState) {
                this.audio.updateState(this.engine.state);
            }

            this.displayContextualThought();
        }, 1000);

        // Required interaction to start audio
        window.addEventListener('mousedown', () => {
            this.audio.init();
        }, { once: true });

        if (this.isReturning) {
            setTimeout(() => this.showThought(this.thoughts.returner[Math.floor(Math.random() * this.thoughts.returner.length)]), 3000);
        } else {
            setTimeout(() => this.showThought("Welcome to the quiet."), 2000);
        }
    }

    displayContextualThought() {
        const now = Date.now();
        if (now - this.lastThoughtTime < 10000) return; // Show thoughts every 10s at most

        if (Math.random() > 0.7) {
            const stateThoughts = this.thoughts[this.engine.state];
            const thought = stateThoughts[Math.floor(Math.random() * stateThoughts.length)];
            this.showThought(thought);
            this.lastThoughtTime = now;
        }
    }

    showThought(text) {
        // Each call queued two nested timeouts with nothing cancelling the
        // previous pair, so overlapping thoughts fought over the same element
        // and text could change while it was still fading in.
        clearTimeout(this._showTimer);
        clearTimeout(this._hideTimer);

        this.thoughtElement.classList.remove('visible');
        this._showTimer = setTimeout(() => {
            this.thoughtElement.innerText = text;
            this.thoughtElement.classList.add('visible');
            this._hideTimer = setTimeout(() => {
                this.thoughtElement.classList.remove('visible');
            }, 5000);
        }, 2000);
    }
}

// Initialize the experience
window.addEventListener('DOMContentLoaded', () => {
    new SentienceApp();
});
