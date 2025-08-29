#!/usr/bin/env node

const {execSync} = require('child_process');
const fs = require('fs');
const path = require('path');

// This script is designed to be run in a GitHub Actions environment.
// It requires the following environment variables to be set:
// - GITHUB_BASE_REF: The base branch for comparison (e.g., 'main').
// - CHANGED_FILES: A space-separated string of changed filenames.
// - GITHUB_TOKEN: A token with permissions to call the GitHub Models API.
// - GITHUB_ENV: The path to the file for setting environment variables for subsequent steps.

/**
 * Main function to execute the convention linting process.
 */
async function main() {
    console.log("🔍 Analyzing naming convention violations...");

    // --- 1. Get required variables from the environment ---
    const {GITHUB_BASE_REF, CHANGED_FILES, GITHUB_TOKEN, GITHUB_ENV} = process.env;

    if (!GITHUB_BASE_REF || !CHANGED_FILES || !GITHUB_TOKEN || !GITHUB_ENV) {
        console.error("❌ Missing required environment variables (GITHUB_BASE_REF, CHANGED_FILES, GITHUB_TOKEN, GITHUB_ENV).");
        process.exit(1);
    }

    const changedFiles = CHANGED_FILES.split(' ').filter(Boolean);
    if (changedFiles.length === 0) {
        console.log("No changed files to process. Exiting.");
        return;
    }

    try {
        // --- 2. Fetch the base branch for diff comparison ---
        console.log(`Fetching base branch: ${GITHUB_BASE_REF}`);
        execSync(`git fetch origin ${GITHUB_BASE_REF}`);

        // --- 3. Read the prompt template ---
        const promptTemplatePath = path.join('.github', 'prompts', 'convention-linter-prompt.txt');
        const promptTemplate = fs.readFileSync(promptTemplatePath, 'utf8');

        // --- 4. Generate diff content for all changed files ---
        let diffContent = '';
        for (const file of changedFiles) {
            console.log(`  - Processing diff for: ${file}`);
            try {
                const fileDiff = execSync(`git diff origin/${GITHUB_BASE_REF} HEAD -- "${file}"`).toString();
                if (fileDiff) {
                    diffContent += `\n\n--- Diff for ${file} ---\n${fileDiff}`;
                }
            } catch (error) {
                console.warn(`Could not get diff for file: ${file}. It might have been deleted.`, error.message);
            }
        }

        if (!diffContent.trim()) {
            console.log("🎉 No meaningful diffs found. Skipping API call.");
            return;
        }

        // --- 5. Construct the full prompt and JSON payload ---
        const fullPrompt = promptTemplate.replace('__DIFFS_PLACEHOLDER__', diffContent);

        const jsonPayload = {
            messages: [{
                role: 'user',
                content: fullPrompt,
            },],
            model: 'openai/gpt-4o',
        };

        // --- 6. Make the API call to GitHub Models ---
        console.log("🤖 Calling GitHub Models API...");

        const apiResponse = await fetch("https://models.github.ai/inference/chat/completions", {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${GITHUB_TOKEN}`,
            },
            body: JSON.stringify(jsonPayload),
        });

        if (!apiResponse.ok) {
            const errorText = await apiResponse.text();
            console.error(`❌ API call failed with status ${apiResponse.status}: ${errorText}`);
            process.exit(1);
        }

        const responseData = await apiResponse.json();

        // --- 7. Process the API response ---
        const responseText = responseData.choices?.[0]?.message?.content?.trim();

        if (!responseText) {
            console.error("❌ Invalid response from GitHub Models API");
            console.error("API Response:", JSON.stringify(responseData, null, 2));
            process.exit(1);
        }

        console.log("--- GitHub Models Analysis Result ---");
        console.log(responseText);
        console.log("-----------------------------------");

        // --- 8. Set output for subsequent GitHub Actions steps ---
        fs.appendFileSync(GITHUB_ENV, `LINTER_OUTPUT=${responseText}\n`);

        // --- 9. Determine success or failure ---
        if (responseText !== "OK") {
            console.log("💔 Convention violations found.");
            process.exit(1);
        } else {
            console.log("🎉 Success! No convention violations found.");
        }

    } catch (error) {
        console.error("An unexpected error occurred:", error);
        process.exit(1);
    }
}

// Execute the script
main();
