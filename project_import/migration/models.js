export class Comment {
  constructor(body, user, date) {
    this.raw = { body, user, date };
    this.body = body;
    this.user = user;
    this.date = date;
  }

  getFormattedBody() {
    const matches = this.body.match(/\((.*?)\)/g);
    const lastMatch = matches ? matches[matches.length - 1] : null;
    const bracketsContent = lastMatch ? lastMatch.slice(1, -1) : 'Comment';
    this.body = `#### (${bracketsContent})\n${this.body.replace(/\s*\(.*?\)$/, '')}`;
    return this.body;
  }
}

export class Issue {
  constructor(title, body, labels, user, createdAt) {
    this.raw = { title, body, labels, user, createdAt };
    this.title = title;
    this.body = body;
    this.labels = labels || [];
    this.user = user;
    this.createdAt = createdAt;
    this.comments = [];
    this.acceptedAt = null;  // New field
    this.id = null;         // New field
    this.files = [];       // New field for attached files
  }

  getFormattedBody() {
    const dates = this.acceptedAt
      ? `${this.createdAt} (accepted: ${this.acceptedAt})`
      : `${this.createdAt}`;

    let text = `#${this.id}\n\n ## ${this.user}: ${dates}\n\n${this.body}`;

    // Add inline comments if enabled
    if (process.env.GITHUB_INLINE_COMMENTS === 'true' && this.comments.length > 0) {
      text += '\n\n---\n## Comments\n';
      text += this.comments
        .map(comment => comment.getFormattedBody())
        .join('\n\n---\n---\n\n');
    }

    return text;
  }

  addComment(comment) {
    this.comments.push(comment);
  }
}
