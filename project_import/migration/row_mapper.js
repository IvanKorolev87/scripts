import { Comment, Issue } from './models.js';

import fs from 'fs';
import path from 'path';

export class RowMapper {
  constructor(row, csvPath) {
    this.row = row;
    this.csvBasePath = path.dirname(csvPath);
  }

  getTitle() {
    return this.row["Title"] || this.row[1] || "";  // Column B
  }

  getBody() {
    const description = this.row["Description"] || "";
    return description;
  }

  getUser() {
    return this.row["Requested By"] || this.row["Owned By"] || "Unknown";
  }

  getDates() {
    return {
      created: this.row["Created at"] || "",
      accepted: this.row["Accepted at"] || "",
      deadline: this.row["Deadline"] || "",
    };
  }

  getComments() {
    const comments = [];
    const user = this.getUser();
    const date = this.getDates().created;

    // Collect all Comment columns
    Object.keys(this.row).forEach(key => {
      if (key.startsWith("Comment") && this.row[key] && this.row[key].trim()) {
        comments.push({
          body: this.row[key],
          user,
          date
        });
      }
    });

    return comments;
  }

  getLabels() {
    const labels = [];

    // Add type if present
    if (this.row["Type"]) {
      labels.push(this.row["Type"].toLowerCase());
    }

    // Add priority if present
    if (this.row["Priority"]) {
      labels.push(this.row["Priority"].toLowerCase());
    }

    // Add explicit labels
    if (this.row["Labels"]) {
      labels.push(...this.row["Labels"].split(",").map(l => l.trim()));
    }

    return [...new Set(labels)].filter(Boolean);  // Remove duplicates and empty values
  }

  getAttachedFiles() {
    const id = this.row.Id;
    if (!id) return [];

    const filesPath = path.join(this.csvBasePath, id);
    try {
      if (fs.existsSync(filesPath) && fs.statSync(filesPath).isDirectory()) {
        return fs.readdirSync(filesPath)
          .filter(file => !file.startsWith('.'));
      }
    } catch (error) {
      console.warn(`Warning: Could not read files for issue ${id}:`, error.message);
    }
    return [];
  }

  mapToIssue() {
    const title = this.getTitle();
    const body = this.getBody();
    const labels = this.getLabels();
    const user = this.getUser();
    const { created: createdAt } = this.getDates();

    const issue = new Issue(title, body, labels, user, createdAt);

    issue.id = this.row.Id || '';
    issue.acceptedAt = this.row['Accepted at'] || null;
    issue.files = this.getAttachedFiles();

    // Add comments
    this.getComments().forEach(c => {
      issue.addComment(new Comment(c.body, c.user, c.date));
    });

    return issue;
  }
}
