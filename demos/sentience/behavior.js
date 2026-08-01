// Behavior Monitoring Module
export class BehaviorMonitor {
    constructor() {
        this.metrics = {
            mouseSpeed: 0,
            mouseErraticness: 0,
            scrollSpeed: 0,
            clickFrequency: 0,
            idleTime: 0,
            lastActivity: Date.now()
        };

        this.history = {
            mousePositions: [],
            clickTimes: [],
            scrollEvents: []
        };

        this.init();
    }

    init() {
        window.addEventListener('mousemove', (e) => this.trackMouse(e));
        window.addEventListener('mousedown', () => this.trackClick());
        window.addEventListener('wheel', (e) => this.trackScroll(e));

        // Idle tracking
        setInterval(() => {
            this.metrics.idleTime = (Date.now() - this.metrics.lastActivity) / 1000;
            this.decayMetrics();
        }, 100);
    }

    trackMouse(e) {
        const now = Date.now();
        const pos = { x: e.clientX, y: e.clientY, t: now };

        if (this.history.mousePositions.length > 0) {
            const last = this.history.mousePositions[this.history.mousePositions.length - 1];
            const dx = pos.x - last.x;
            const dy = pos.y - last.y;
            const dt = pos.t - last.t;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dt > 0) {
                const speed = dist / dt;
                this.metrics.mouseSpeed = this.metrics.mouseSpeed * 0.8 + speed * 0.2;

                // Erraticness: change in direction
                if (this.history.mousePositions.length > 2) {
                    const prev = this.history.mousePositions[this.history.mousePositions.length - 2];
                    const v1 = { x: last.x - prev.x, y: last.y - prev.y };
                    const v2 = { x: pos.x - last.x, y: pos.y - last.y };
                    // Raw atan2 difference lands in (-2pi, 2pi), so a tiny
                    // direction change across the +/-pi boundary registered as
                    // a near-maximum turn and spuriously triggered "anxious".
                    // Normalise to [0, pi] — the actual turn angle.
                    let angle = Math.atan2(v2.y, v2.x) - Math.atan2(v1.y, v1.x);
                    while (angle > Math.PI) angle -= 2 * Math.PI;
                    while (angle < -Math.PI) angle += 2 * Math.PI;
                    angle = Math.abs(angle);

                    this.metrics.mouseErraticness = this.metrics.mouseErraticness * 0.9 + angle * 0.1;
                }
            }
        }

        this.history.mousePositions.push(pos);
        if (this.history.mousePositions.length > 50) this.history.mousePositions.shift();

        this.metrics.lastActivity = now;

        // Update CSS custom properties for atmosphere
        document.documentElement.style.setProperty('--mouse-x', `${(e.clientX / window.innerWidth) * 100}%`);
        document.documentElement.style.setProperty('--mouse-y', `${(e.clientY / window.innerHeight) * 100}%`);

        // Drive the soft cursor that replaces the hidden system pointer.
        if (!this.cursorEl) this.cursorEl = document.getElementById('soft-cursor');
        if (this.cursorEl) {
            this.cursorEl.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
        }
    }

    trackClick() {
        const now = Date.now();
        this.history.clickTimes.push(now);
        if (this.history.clickTimes.length > 10) this.history.clickTimes.shift();

        if (this.history.clickTimes.length > 1) {
            const dt = now - this.history.clickTimes[this.history.clickTimes.length - 2];
            const freq = 1000 / dt;
            this.metrics.clickFrequency = this.metrics.clickFrequency * 0.5 + freq * 0.5;
        }

        this.metrics.lastActivity = now;
    }

    trackScroll(e) {
        const now = Date.now();
        const speed = Math.abs(e.deltaY);
        this.metrics.scrollSpeed = this.metrics.scrollSpeed * 0.7 + speed * 0.3;
        this.metrics.lastActivity = now;
    }

    decayMetrics() {
        // Naturally fade metrics over time if no activity
        this.metrics.mouseSpeed *= 0.95;
        this.metrics.mouseErraticness *= 0.95;
        this.metrics.scrollSpeed *= 0.9;
        this.metrics.clickFrequency *= 0.9;
    }

    getSummary() {
        return { ...this.metrics };
    }
}
