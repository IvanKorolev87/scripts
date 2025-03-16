import Logger from "./logger.js";
import { RowMapper } from "./row_mapper.js";
import csv from "csv-parser";
import dotenv from "dotenv";
import fs from "fs";
import outputGithub from "./output_github.js";
import outputXml from "./output_xml.js";
import readline from "readline";

dotenv.config(); // Load environment variables from a .env file

// Function to prompt user input
function getInput(prompt, mask = false) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  });

  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(mask ? "*".repeat(answer.length) : answer);
    });
  });
}

async function main() {
  const startTime = Date.now();
  const csvFilePath = process.argv[2];
  const outputType = process.argv[3] || "xml";
  const size = parseInt(process.argv[4]) || 3;
  const workingMode = process.argv[5] || "index";

  if (!csvFilePath) {
    throw new Error("Enter file path to CSV as first argument.");
  }

  // Authenticate with Octokit
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN || await getInput("Enter GitHub Token > ", true);

  // Get repository path from environment variable
  const repositoryPath = process.env.GITHUB_REPO_PATH;
  if (!repositoryPath || !repositoryPath.includes("/")) {
    throw new Error("Repository should contain a forward slash ('/') and be set in the environment variable GITHUB_REPO_PATH.");
  }

  const logger = new Logger();
  const outputService = outputType === "github" ?
    new outputGithub(GITHUB_TOKEN, repositoryPath, logger) :
    new outputXml();

  let processedRows = 0;
  const startFromIndex = outputType === "github" ? logger.getLastProcessedIndex() + 1 : 0;

  // Collect all rows first
  const rows = [];
  await new Promise((resolve, reject) => {
    fs.createReadStream(csvFilePath)
      .pipe(csv({newline: '\n', separator: ','}))
      .on('data', (row) => rows.push(row))
      .on('end', resolve)
      .on('error', reject);
  });

  let rowsToProcess;
  if (workingMode === "missing" && outputType === "github") {
    // Get missing issues and find their corresponding rows
    const allIssueIds = rows.map(row => row.Id);
    const missingIssues = logger.getMissingIssues(allIssueIds);
    console.log(`Found ${missingIssues.length} missing issues`);

    rowsToProcess = rows
      .filter(row => missingIssues.includes(row.Id))
      .slice(0, size);

    console.log(`Will process ${rowsToProcess.length} issues: ${rowsToProcess.map(r => r.Id).join(', ')}`);
  } else {
    // Original index-based behavior
    rowsToProcess = rows.slice(startFromIndex, startFromIndex + (size === -1 ? rows.length : size));
  }

  // Process selected rows
  for (const row of rowsToProcess) {
    const currentRowIndex = rows.indexOf(row);
    await createIssue(row, currentRowIndex, outputService, outputType, logger, csvFilePath);
    processedRows++;
  }

  await outputService.finalize();
  const processingEndTime = Date.now();
  const totalSeconds = (processingEndTime - startTime) / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  console.log(`CSV processing completed. Processed ${processedRows} rows in ${minutes}:${seconds}`);
}

async function createIssue(row, rowIndex, outputService, outputType, logger, csvFilePath) {
  try {
    const mapper = new RowMapper(row, csvFilePath, rowIndex);
    const issue = mapper.mapToIssue();

    // Create labels first
    await Promise.all(issue.labels.map(label => outputService.createLabel(label)));

    // Create issue and log result if using GitHub
    const result = await outputService.createIssue(issue);
    if (outputType === "github" && result) {
      logger.logIssue(rowIndex, issue.id, result.number, result.rateLimit);
    }
  } catch (error) {
    console.error(`Error processing row ${rowIndex}:`, error);
  }
}

main().catch(console.error);
