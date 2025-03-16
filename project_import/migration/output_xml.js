import { create } from "xmlbuilder2";
import fs from "fs";

class OutputXML {
  constructor() {
    this.xmlRoot = create({ version: "1.0" }).ele("issues");
    this.issueCount = 0;  // Add counter to track issues
  }

  async createLabel(labelName) {
    //console.log(`Label registered: ${labelName}`);
  }

  async createIssue(issue) {
    this.issueCount++;
    const issueElement = this.xmlRoot.ele("issue");

    issueElement.ele("id").txt(issue.id);
    issueElement.ele("title").txt(issue.title);
    issueElement.ele("formattedBody").txt(issue.getFormattedBody());
    issueElement.ele("description").txt(issue.body);
    issueElement.ele("user").txt(issue.user);
    issueElement.ele("createdAt").txt(issue.createdAt);
    issueElement.ele("acceptedAt").txt(issue.acceptedAt || '');

    const labelsNode = issueElement.ele("labels");
    issue.labels.forEach((label) => labelsNode.ele("label").txt(label));

    const filesNode = issueElement.ele("files");
    issue.files.forEach(file => filesNode.ele("file").txt(file));

    // Add comments
    const commentsNode = issueElement.ele("comments");
    issue.comments.forEach(comment => {
      const commentElement = commentsNode.ele("comment");

      commentElement.ele("formattedBody").txt(comment.getFormattedBody());
    });

    return this.issueCount;
  }

  async finalize() {
    fs.writeFileSync("export.xml", this.xmlRoot.end({ prettyPrint: true }));
    console.log("XML file generated: export.xml");
  }
}

export default OutputXML;
