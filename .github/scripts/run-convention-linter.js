#!/usr/bin/env node

const {execSync} = require('child_process');
const fs = require('fs');
const path = require('path');

// This script is designed to be run in a GitHub Actions environment.
// It requires the following environment variables to be set:
// - GITHUB_BASE_REF: The base branch for comparison (e.g., 'main').
// - CHANGED_FILES: A space-separated string of changed filenames.
// - GITHUB_TOKEN: A token with permissions to call the GitHub Models API.
// - GITHUB_REPOSITORY: The full repository name (e.g., 'owner/repo').
// - PR_NUMBER: The number of the pull request.
// - AI_PROVIDER: The AI provider to use ('github' or 'gemini'). Defaults to 'github'.
// - GEMINI_API_KEY: Required if AI_PROVIDER is 'gemini'.

/**
 * Configuration for different AI providers
 */
const AI_PROVIDERS = {
    github: {
        name: 'GitHub Models',
        endpoint: 'https://models.github.ai/inference/chat/completions',
        model: 'openai/gpt-4o',
        requiresToken: 'GITHUB_TOKEN'
    },
    gemini: {
        name: 'Google Gemini (Thinking)',
        endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-thinking-exp:generateContent',
        model: 'gemini-2.0-flash-thinking-exp',
        requiresToken: 'GEMINI_API_KEY'
    }
};

/**
 * Creates the API payload for GitHub Models
 */
function createGitHubPayload(prompt) {
    return {
        messages: [{
            role: 'user',
            content: prompt,
        }],
        model: AI_PROVIDERS.github.model,
    };
}

/**
 * Creates the API payload for Gemini
 */
function createGeminiPayload(prompt) {
    return {
        contents: [{
            parts: [{
                text: prompt
            }]
        }]
    };
}

/**
 * Makes an API call to GitHub Models
 */
async function callGitHubModels(prompt, token) {
    const payload = createGitHubPayload(prompt);

    const response = await fetch(AI_PROVIDERS.github.endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`GitHub Models API call failed with status ${response.status}: ${errorText}`);
    }

    const responseData = await response.json();
    const responseText = responseData.choices?.[0]?.message?.content?.trim();

    if (!responseText) {
        throw new Error("Invalid response from GitHub Models API");
    }

    return responseText;
}

/**
 * Makes an API call to Gemini Thinking Model
 */
async function callGemini(prompt, apiKey) {
    const payload = createGeminiPayload(prompt);
    const url = `${AI_PROVIDERS.gemini.endpoint}?key=${apiKey}`;

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini Thinking API call failed with status ${response.status}: ${errorText}`);
    }

    const responseData = await response.json();

    // For thinking models, we want the final output, not the thinking process
    const candidate = responseData.candidates?.[0];
    if (!candidate) {
        throw new Error("No candidates in Gemini response");
    }

    // Extract the final output from the thinking model response
    const responseText = candidate.content?.parts?.[0]?.text?.trim();

    if (!responseText) {
        console.log("Debug: Full Gemini response:", JSON.stringify(responseData, null, 2));
        throw new Error("Invalid response from Gemini Thinking API");
    }

    // Optional: Log thinking process for debugging (remove in production)
    if (candidate.content?.parts?.[0]?.thought && process.env.DEBUG_THINKING) {
        console.log("🧠 Gemini Thinking Process:", candidate.content.parts[0].thought);
    }

    return responseText;
}

/**
 * Generic function to call the selected AI provider
 */
async function callAIProvider(provider, prompt, token) {
    console.log(`🤖 Calling ${AI_PROVIDERS[provider].name}...`);

    switch (provider) {
        case 'github':
            return await callGitHubModels(prompt, token);
        case 'gemini':
            return await callGemini(prompt, token);
        default:
            throw new Error(`Unsupported AI provider: ${provider}`);
    }
}

/**
 * Validates environment variables and provider configuration
 */
function validateEnvironment(provider) {
    const {GITHUB_BASE_REF, CHANGED_FILES, GITHUB_REPOSITORY, PR_NUMBER} = process.env;

    if (!GITHUB_BASE_REF || !CHANGED_FILES || !GITHUB_REPOSITORY || !PR_NUMBER) {
        throw new Error("Missing required environment variables (GITHUB_BASE_REF, CHANGED_FILES, GITHUB_REPOSITORY, PR_NUMBER).");
    }

    if (!AI_PROVIDERS[provider]) {
        throw new Error(`Invalid AI provider: ${provider}. Supported providers: ${Object.keys(AI_PROVIDERS).join(', ')}`);
    }

    const requiredTokenVar = AI_PROVIDERS[provider].requiresToken;
    if (!process.env[requiredTokenVar]) {
        throw new Error(`Missing required environment variable: ${requiredTokenVar} for provider: ${provider}`);
    }

    return {
        baseRef: GITHUB_BASE_REF,
        changedFiles: CHANGED_FILES.split(' ').filter(Boolean),
        repository: GITHUB_REPOSITORY,
        prNumber: PR_NUMBER,
        token: process.env[requiredTokenVar]
    };
}

/**
 * Generates diff content for changed files
 */
function generateDiffContent(changedFiles, baseRef) {
    let diffContent = '';

    for (const file of changedFiles) {
        console.log(`  - Processing diff for: ${file}`);
        try {
            const fileDiff = execSync(`git diff origin/${baseRef} HEAD -- "${file}"`).toString();
            if (fileDiff) {
                diffContent += `\n\n--- Diff for ${file} ---\n${fileDiff}`;
            }
        } catch (error) {
            console.warn(`Could not get diff for file: ${file}. It might have been deleted.`, error.message);
        }
    }

    return diffContent;
}

/**
 * Reads and prepares the prompt template
 */
function preparePrompt(diffContent) {
    const promptTemplatePath = path.join('.github', 'prompts', 'convention-linter-prompt.txt');

    if (!fs.existsSync(promptTemplatePath)) {
        throw new Error(`Prompt template not found at: ${promptTemplatePath}`);
    }

    const promptTemplate = fs.readFileSync(promptTemplatePath, 'utf8');
    return promptTemplate.replace('__DIFFS_PLACEHOLDER__', diffContent);
}

/**
 * Posts a comment to the GitHub Pull Request.
 * @param {string} linterOutput - The content of the comment.
 * @param {string} prNumber - The number of the pull request.
 * @param {string} repoFullName - The full repository name (e.g., 'owner/repo').
 * @param {string} token - The GitHub token.
 * @param {string} provider - The AI provider used.
 */
async function postPrComment(linterOutput, prNumber, repoFullName, token, provider) {
    const [owner, repo] = repoFullName.split('/');
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/issues/${prNumber}/comments`;

    const providerName = AI_PROVIDERS[provider].name;
    const commentBody = `### 🤖 Convention Linter Failed! (Powered by ${providerName})
            
The following naming convention violations were found:

\`\`\`
${linterOutput}
\`\`\`

Please fix these issues and push your changes.`;

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/vnd.github.v3+json',
            },
            body: JSON.stringify({body: commentBody}),
        });

        if (response.ok) {
            console.log("✅ Successfully posted comment to PR.");
        } else {
            const errorText = await response.text();
            console.error(`❌ Failed to post comment on PR. Status: ${response.status}`);
            console.error("Response:", errorText);
        }
    } catch (error) {
        console.error("An error occurred while trying to post the PR comment:", error);
    }
}

/**
 * Main function to execute the convention linting process.
 */
async function main() {
    console.log("🔍 Analyzing naming convention violations...");

    try {
        // --- 1. Determine AI provider ---
        const provider = process.env.AI_PROVIDER || 'github';
        console.log(`📡 Using AI provider: ${AI_PROVIDERS[provider].name}`);

        // --- 2. Validate environment ---
        const config = validateEnvironment(provider);

        if (config.changedFiles.length === 0) {
            console.log("No changed files to process. Exiting.");
            return;
        }

        // --- 3. Fetch the base branch for diff comparison ---
        console.log(`Fetching base branch: ${config.baseRef}`);
        execSync(`git fetch origin ${config.baseRef}`);

        // --- 4. Generate diff content ---
        const diffContent = generateDiffContent(config.changedFiles, config.baseRef);

        if (!diffContent.trim()) {
            console.log("🎉 No meaningful diffs found. Skipping AI analysis.");
            return;
        }

        // --- 5. Prepare prompt ---
        const fullPrompt = preparePrompt(diffContent);

        // --- 6. Call AI provider ---
        const responseText = await callAIProvider(provider, fullPrompt, config.token);

        console.log("--- AI Analysis Result ---");
        console.log(responseText);
        console.log("-------------------------");

        // --- 7. Handle results ---
        if (responseText !== "OK") {
            console.log("💔 Convention violations found. Posting a comment on the PR...");

            // For GitHub provider, use GITHUB_TOKEN for posting comments
            // For other providers, still use GITHUB_TOKEN for GitHub API calls
            const githubToken = process.env.GITHUB_TOKEN;
            await postPrComment(responseText, config.prNumber, config.repository, githubToken, provider);

            process.exit(1);
        } else {
            console.log("🎉 Success! No convention violations found.");
        }

    } catch (error) {
        console.error(`❌ An unexpected error occurred: ${error.message}`);
        console.error("Full error:", error);
        process.exit(1);
    }
}

/**
 * CLI helper function to display usage information
 */
function displayUsage() {
    console.log(`
🔧 Convention Linter Usage

Environment Variables:
  GITHUB_BASE_REF     Base branch for comparison (required)
  CHANGED_FILES       Space-separated list of changed files (required)
  GITHUB_REPOSITORY   Full repository name (required)
  PR_NUMBER          Pull request number (required)
  AI_PROVIDER        AI provider to use: 'github' or 'gemini' (default: 'github')
  DEBUG_THINKING     Set to 'true' to see Gemini's thinking process (optional)
  
Provider-specific tokens:
  GITHUB_TOKEN       Required for GitHub Models provider
  GEMINI_API_KEY     Required for Gemini provider

Supported AI Providers:
${Object.entries(AI_PROVIDERS).map(([key, config]) =>
        `  ${key.padEnd(10)} - ${config.name} (${config.model})`
    ).join('\n')}

Examples:
  # Using GitHub Models (default)
  AI_PROVIDER=github ./convention-linter.js
  
  # Using Gemini
  AI_PROVIDER=gemini ./convention-linter.js
`);
}

// Handle CLI arguments
if (process.argv.includes('--help') || process.argv.includes('-h')) {
    displayUsage();
    process.exit(0);
}

// Execute the script
main().catch(error => {
    console.error(`❌ Script execution failed: ${error.message}`);
    process.exit(1);
});