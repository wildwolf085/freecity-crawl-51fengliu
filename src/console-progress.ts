/*
const progress = new ConsoleProgress(cnt, '转换原始数据')
progress.tick()
*/

class ConsoleProgress {
    private startTime: number;
    private lastUpdateTime: number;
    private processed: number;
    private total: number;
    private label: string;
    private averageTime: number[];

    constructor(total: number, label: string) {
        this.total = total;
        this.label = label;
        this.processed = 0;
        this.startTime = Date.now();
        this.lastUpdateTime = this.startTime;
        this.averageTime = [];
        this.tick(0);
    }

    async tick(count: number = 1, additionalInfo: string = '') {
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
        const progress = (this.processed / (this.total || 1) * 100).toFixed(1);
        const progressBar = this.getProgressBar();
        const elapsedTime = (Date.now() - this.startTime)
        const text = `${this.label}: ${progressBar} ${progress}% | ${this.processed}/${this.total || 1}${additionalInfo} | ${elapsedTime / 1000}s avg ${Math.round(elapsedTime / (this.processed || 1))}ms/条`
        process.stdout.removeAllListeners()
        process.stdout.cursorTo(0);
        process.stdout.clearLine(1);
        process.stdout.write(text, );

        if (this.processed >= this.total) {
            process.stdout.write('\n');
        }
    }

    private getProgressBar(width: number = 30): string {
        const progress = this.processed / (this.total || 1);
        const filled = Math.round(width * progress);
        const empty = width - filled;
        return '[' + '█'.repeat(filled) + '░'.repeat(empty) + ']';
    }
}

export default ConsoleProgress
