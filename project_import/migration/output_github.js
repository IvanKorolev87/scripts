import { Octokit } from "@octokit/rest";
import fs from 'fs';
import path from 'path';

class OutputGitHub {
  constructor(token, repositoryPath, logger) {
    this.octokit = new Octokit({ auth: token });
    const [owner, repo] = repositoryPath.split("/");
    this.repoOwner = owner;
    this.repoName = repo;
    this.logger = logger;
    this.lastRateLimit = null;
    this.retryAfterTimeout = null;
  }

  async delay(ms = 3000) {
    await new Promise(resolve => setTimeout(resolve, ms));
  }

  updateRateLimitInfo(response) {
    if (response && response.headers) {
      this.lastRateLimit = parseInt(response.headers['x-ratelimit-remaining']) || 0;
      const retryAfter = parseInt(response.headers['retry-after']);
      if (retryAfter) {
        this.retryAfterTimeout = Date.now() + (retryAfter + 60) * 1000;
      }
    }
  }

  async waitForRateLimit() {
    if (this.retryAfterTimeout) {
      const waitTime = this.retryAfterTimeout - Date.now();
      if (waitTime > 0) {
        console.log(`Rate limit exceeded. Waiting ${Math.ceil(waitTime/1000)} seconds...`);
        await this.delay(waitTime);
        this.retryAfterTimeout = null;
      }
    }
  }

  async checkRateLimits() {
    try {
      const response = await this.octokit.rest.rateLimit.get();
      const { remaining, reset } = response.data.resources.core;

      this.lastRateLimit = remaining;
      if (remaining === 0) {
        // Set retry timeout to reset time + 60 seconds buffer
        this.retryAfterTimeout = (reset * 1000) + 60000;
        console.log(`Rate limit depleted. Reset at: ${new Date(reset * 1000).toLocaleString()}`);
      }

      return {
        remaining,
        resetTime: new Date(reset * 1000).toLocaleString(),
        resetTimestamp: reset
      };
    } catch (error) {
      console.error("Error checking rate limits:", error);
      return null;
    }
  }

  async checkRateLimit(requiredCalls) {
    await this.waitForRateLimit();

    // Get fresh rate limit data
    const limits = await this.checkRateLimits();
    if (limits && limits.remaining < requiredCalls) {
      throw new Error(
        `Rate limit too low (${limits.remaining}) for operation requiring ${requiredCalls} calls. ` +
        `Reset at: ${limits.resetTime}`
      );
    }
  }

  async createLabel(labelName) {
    await this.waitForRateLimit();

    if (this.logger.isLabelCreated(labelName)) {
      return;
    }

    try {
      const response = await this.octokit.rest.issues.createLabel({
        owner: this.repoOwner,
        repo: this.repoName,
        name: labelName,
        color: Math.floor(Math.random() * 16777215).toString(16),
      });
      this.updateRateLimitInfo(response);
      await this.delay();
      console.log(`Label created: ${labelName}`);
      this.logger.logLabel(labelName);
    } catch (error) {
      this.updateRateLimitInfo(error.response);
      if (error.status === 422) {
        console.log(`Label already exists in GitHub: ${labelName}`);
        this.logger.logLabel(labelName);
      } else {
        console.error(`Error creating label: ${labelName}`, error);
      }
    }
  }

  async uploadFile(id, filePath) {

    if (process.env.GITHUB_UPLOAD_FILES !== 'true') {
        const fileName = path.basename(filePath);
        return `[${fileName}](https://github.com/${this.repoOwner}/${this.repoName}/raw/main/uploads/${id}/${encodeURIComponent(fileName)})`;
    }

    await this.waitForRateLimit();
    try {
      if (!fs.existsSync(filePath)) {
        console.warn(`File not found: ${filePath}`);
        return null;
      }

      const content = await fs.promises.readFile(filePath, { encoding: 'base64' });
      const fileName = path.basename(filePath);

      console.log(`Uploading file: ${fileName}`);

      const response = await this.octokit.rest.repos.createOrUpdateFileContents({
        owner: this.repoOwner,
        repo: this.repoName,
        path: `uploads/${id}/${fileName}`,
        message: `Upload attachment ${id}/${fileName}`,
        content: content,
      });
      this.updateRateLimitInfo(response);
      await this.delay();

    return `[${fileName}](https://github.com/${this.repoOwner}/${this.repoName}/raw/main/uploads/${id}/${encodeURIComponent(fileName)})`;
    } catch (error) {
      this.updateRateLimitInfo(error.response);

      if (error.status === 422) {
        // File already exists, return the URL anyway
        const fileName = path.basename(filePath);
        return `[${fileName}](https://github.com/${this.repoOwner}/${this.repoName}/raw/main/uploads/${id}/${encodeURIComponent(fileName)})`;
      }

      console.error(`Error uploading file ${filePath}:`, error);
      return null;
    }
  }

  async createIssue(issue) {
    try {
      // Calculate required API calls - skip comments if inline mode is enabled
      const inlineComments = process.env.GITHUB_INLINE_COMMENTS === 'true';
      const requiredCalls = 5 + // base safety margin
        (inlineComments ? 0 : (issue.comments?.length || 0)) + // comments (if not inline)
        (issue.files?.length || 0) + // file uploads
        (issue.acceptedAt ? 1 : 0); // close issue call

      await this.checkRateLimit(requiredCalls);

      // Upload any attachments first - process sequentially to avoid conflicts
      const uploadedFiles = [];
      if (issue.files && issue.files.length > 0) {
        for (const file of issue.files) {
          const fileUrl = await this.uploadFile(issue.id, path.join('./export', issue.id, file));
          if (fileUrl) uploadedFiles.push(fileUrl);
        }
      }

      // Add file links to the body
      const fileLinks = uploadedFiles
        .map(url => `\n- ${url}`)
        .join('');

    const response = await this.octokit.rest.issues.create({
      owner: this.repoOwner,
      repo: this.repoName,
      title: issue.title,
      body: issue.getFormattedBody() + (fileLinks ? ('\n\n---\n\n ## Files\n' + fileLinks) : ''),
      labels: issue.labels,
    });
      this.updateRateLimitInfo(response);
      await this.delay();

      // Create comments only if not in inline mode
      if (!inlineComments) {
        for (const comment of issue.comments) {
          await this.createComment(response.data.number, comment);
          await this.delay();
        }
      }

      // Close the issue if it has a closed_at date
      if (issue.acceptedAt) {
        await this.closeIssue(response.data.number, issue.acceptedAt);
        await this.delay();
      }

      console.log(`Issue created: #${response.data.number}`);
      return {
        number: response.data.number,
        rateLimit: this.lastRateLimit
      };
    } catch (error) {
      this.updateRateLimitInfo(error.response);
      console.error("Error creating issue:", error);
      return null;
    }
  }

  async closeIssue(issueNumber, closedAt) {
    await this.waitForRateLimit();
    try {
      const response = await this.octokit.rest.issues.update({
        owner: this.repoOwner,
        repo: this.repoName,
        issue_number: issueNumber,
        state: 'closed',
        state_reason: 'completed'
      });
      this.updateRateLimitInfo(response);
      await this.delay();
      console.log(`Issue #${issueNumber} closed`);
    } catch (error) {
      this.updateRateLimitInfo(error.response);
      console.error(`Error closing issue #${issueNumber}:`, error);
    }
  }

  async createComment(issueNumber, comment, fileLinks = '') {
    await this.waitForRateLimit();
    try {
      const response = await this.octokit.rest.issues.createComment({
        owner: this.repoOwner,
        repo: this.repoName,
        issue_number: issueNumber,
        body: comment.getFormattedBody() + fileLinks,
      });
      this.updateRateLimitInfo(response);
      await this.delay();
    } catch (error) {
      this.updateRateLimitInfo(error.response);
      console.error(`Error creating comment on issue #${issueNumber}:`, error);
    }
  }

  async finalize() {
    console.log("GitHub processing complete.");
  }
}

export default OutputGitHub;
