import fs from 'fs';

class Logger {
    constructor(logFile = 'log.json') {
        this.logFile = logFile;
        this.data = this.getLogData();
    }

    getLogData() {
        try {
            return fs.existsSync(this.logFile)
                ? JSON.parse(fs.readFileSync(this.logFile, 'utf8'))
                : {
                    lastProcessedIndex: -1,
                    issues: {},
                    labels: [],
                    rateLimits: {}
                };
        } catch (error) {
            console.error(`Error loading ${this.logFile}:`, error);
            return {
                lastProcessedIndex: -1,
                issues: {},
                labels: [],
                rateLimits: {}
            };
        }
    }

    getMissingIssues(allIds) {
        const missing = [];
        for (const id of allIds) {
            //console.log(id);
            if (!this.data.issues[id]) {
                missing.push(id);
            }
        }
        return missing;
    }

    save() {
        fs.writeFileSync(this.logFile, JSON.stringify(this.data, null, 2));
    }

    logIssue(rowIndex, issueId, githubIssueId, rateLimit) {
        this.data.lastProcessedIndex = Math.max(this.data.lastProcessedIndex, rowIndex);
        this.data.issues[issueId] = githubIssueId;
        this.data.rateLimits[githubIssueId] = rateLimit;
        this.save();
    }

    getLastProcessedIndex() {
        return this.data.lastProcessedIndex || -1;
    }

    isLabelCreated(labelName) {
        return this.data.labels.includes(labelName);
    }

    logLabel(labelName) {
        if (!this.isLabelCreated(labelName)) {
            this.data.labels.push(labelName);
            this.save();
        }
    }

    getMissingIssues(allIds) {
        const missing = [];
        for (const id of allIds) {
            if (!this.data.issues[id]) {
                missing.push(id);
            }
        }
        return missing;
    }
}

export default Logger;
