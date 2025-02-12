import readline from 'node:readline/promises';

class ConsoleProgress {
    private startTime: number;
    private lastUpdateTime: number;
    private processed: number;
    private total: number;
    private label: string;
    private averageTime: number[];
    private rl: readline.Interface;

    constructor(total: number, label: string) {
        this.total = total;
        this.label = label;
        this.processed = 0;
        this.startTime = Date.now();
        this.lastUpdateTime = this.startTime;
        this.averageTime = [];
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        this.render();
    }

    async tick(count: number = 1) {
        this.processed += count;
        const now = Date.now();
        const timeSinceLastUpdate = now - this.lastUpdateTime;
        
        // Only update average time if some time has passed
        if (timeSinceLastUpdate > 0) {
            this.averageTime.push(timeSinceLastUpdate);
            // Keep only last 10 measurements for moving average
            if (this.averageTime.length > 10) {
                this.averageTime.shift();
            }
        }
        
        this.lastUpdateTime = now;
        await this.render();
    }

    private getProgressBar(width: number = 30): string {
        const progress = this.processed / this.total;
        const filled = Math.round(width * progress);
        const empty = width - filled;
        return '[' + '█'.repeat(filled) + '░'.repeat(empty) + ']';
    }

    private formatTime(ms: number): string {
        if (ms < 1000) return `${ms}ms`;
        const seconds = Math.floor(ms / 1000);
        if (seconds < 60) return `${seconds}s`;
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}m${remainingSeconds}s`;
    }

    private getEstimatedTimeRemaining(): string {
        const avgTime = this.averageTime.reduce((a, b) => a + b, 0) / this.averageTime.length;
        const remaining = this.total - this.processed;
        return this.formatTime(avgTime * remaining);
    }

    private async render() {
        const progress = (this.processed / this.total * 100).toFixed(1);
        const elapsedTime = this.formatTime(Date.now() - this.startTime);
        const eta = this.getEstimatedTimeRemaining();
        const progressBar = this.getProgressBar();
        
        // Clear line and move cursor to start
        // process.stdout.write('\r\x1b[K');
        
        // Render progress line
        
        
        
        // this.rl.clearLine(0);
        

        const text = `${this.label}: ${progressBar} ${progress}% | ` +
        `${this.processed}/${this.total} | ` +
        `Elapsed: ${elapsedTime} | ` +
        `ETA: ${eta}`
        // process.stdout.moveCursor(0, 0);
        process.stdout.cursorTo(0);
        process.stdout.clearLine(1);
        process.stdout.write(text, );
        
        // console.clear();
        // console.log(text)
        // process.stdout.write(text);
        // If complete, move to next line
        if (this.processed >= this.total) {
            process.stdout.write('\n');
        }
    }
}

export default ConsoleProgress