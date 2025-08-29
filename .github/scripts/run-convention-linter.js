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
// - AI_PROVIDER: The AI provider to use ('github', 'gemini', or 'openai'). Defaults to 'github'.
// - GEMINI_API_KEY: Required if AI_PROVIDER is 'gemini'.
// - OPENAI_API_KEY: Required if AI_PROVIDER is 'openai'.

/**
 * Configuration for different AI providers
 */
const AI_PROVIDERS = {
    github: {
        name: 'GitHub Models',
        endpoint: 'https://models.github.ai/inference/chat/completions',
        model: 'openai/gpt-4o',
        requiresToken: 'GITHUB_TOKEN',
        supportsSystemPrompt: true
    },
    gemini: {
        name: 'Google Gemini (Thinking)',
        endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-thinking-exp:generateContent',
        model: 'gemini-2.0-flash-thinking-exp',
        requiresToken: 'GEMINI_API_KEY',
        supportsSystemPrompt: true
    },
    openai: {
        name: 'OpenAI ChatGPT',
        endpoint: 'https://api.openai.com/v1/chat/completions',
        model: 'gpt-4',
        requiresToken: 'OPENAI_API_KEY',
        supportsSystemPrompt: true
    }
};

/**
 * Creates the API payload for GitHub Models with system/user prompts
 */
function createGitHubPayload(systemPrompt, userPrompt) {
    return {
        messages: [
            {
                role: 'system',
                content: systemPrompt,
            },
            {
                role: 'user',
                content: userPrompt,
            }
        ],
        model: AI_PROVIDERS.github.model,
        temperature: 0.1,
        max_tokens: 4000
    };
}

/**
 * Creates the API payload for OpenAI ChatGPT with system/user prompts
 */
function createOpenAIPayload(systemPrompt, userPrompt) {
    return {
        model: AI_PROVIDERS.openai.model,
        messages: [
            {
                role: 'system',
                content: systemPrompt,
            },
            {
                role: 'user',
                content: userPrompt,
            }
        ],
        temperature: 0.1,
        max_tokens: 4000
    };
}

/**
 * Creates the API payload for Gemini with system instructions
 */
function createGeminiPayload(systemPrompt, userPrompt) {
    return {
        systemInstruction: {
            parts: [{
                text: systemPrompt
            }]
        },
        contents: [{
            parts: [{
                text: userPrompt
            }]
        }],
        generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 4000
        }
    };
}

/**
 * Makes an API call to GitHub Models
 */
async function callGitHubModels(systemPrompt, userPrompt, token) {
    const payload = createGitHubPayload(systemPrompt, userPrompt);

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
 * Makes an API call to OpenAI ChatGPT
 */
async function callOpenAI(systemPrompt, userPrompt, apiKey) {
    const payload = createOpenAIPayload(systemPrompt, userPrompt);

    const response = await fetch(AI_PROVIDERS.openai.endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI API call failed with status ${response.status}: ${errorText}`);
    }

    const responseData = await response.json();
    const responseText = responseData.choices?.[0]?.message?.content?.trim();

    if (!responseText) {
        console.log("Debug: Full OpenAI response:", JSON.stringify(responseData, null, 2));
        throw new Error("Invalid response from OpenAI API");
    }

    return responseText;
}

/**
 * Makes an API call to Gemini with system instructions
 */
async function callGemini(systemPrompt, userPrompt, apiKey) {
    const payload = createGeminiPayload(systemPrompt, userPrompt);
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
 * Generic function to call the selected AI provider with system/user prompts
 */
async function callAIProvider(provider, systemPrompt, userPrompt, token) {
    console.log(`🤖 Calling ${AI_PROVIDERS[provider].name}...`);

    switch (provider) {
        case 'github':
            return await callGitHubModels(systemPrompt, userPrompt, token);
        case 'gemini':
            return await callGemini(systemPrompt, userPrompt, token);
        case 'openai':
            return await callOpenAI(systemPrompt, userPrompt, token);
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
 * Reads the complete content of a file
 */
function getFileContent(file) {
    try {
        if (!fs.existsSync(file)) {
            return null;
        }
        return fs.readFileSync(file, 'utf8');
    } catch (error) {
        console.warn(`Could not read file content for: ${file}`, error.message);
        return null;
    }
}

/**
 * Checks if a file is a .model.ts file
 */
function isModelFile(file) {
    return file.endsWith('.model.ts') || file.endsWith('.model.js');
}

/**
 * Checks if a file is a migration file
 */
function isMigrationFile(file) {
    return file.includes('/migrations/') && (file.endsWith('.ts') || file.endsWith('.js'));
}

/**
 * Generates enhanced diff content for changed files with special handling for model and migration files
 */
function generateDiffContent(changedFiles, baseRef) {
    const diffData = {
        diffs: [],
        modelFiles: [],
        migrationFiles: [],
        otherFiles: []
    };

    for (const file of changedFiles) {
        console.log(`  - Processing diff for: ${file}`);

        try {
            const fileDiff = execSync(`git diff origin/${baseRef} HEAD -- "${file}"`).toString();

            const fileInfo = {
                path: file,
                diff: fileDiff || '',
                fullContent: null,
                type: 'other'
            };

            // Categorize and handle special files
            if (isModelFile(file)) {
                fileInfo.type = 'model';
                diffData.modelFiles.push(file);

                const fullContent = getFileContent(file);
                if (fullContent) {
                    fileInfo.fullContent = fullContent;
                    console.log(`  📄 Detected model file: ${file} - fetched complete content`);
                }
            } else if (isMigrationFile(file)) {
                fileInfo.type = 'migration';
                diffData.migrationFiles.push(file);

                const fullContent = getFileContent(file);
                if (fullContent) {
                    fileInfo.fullContent = fullContent;
                    console.log(`  🔄 Detected migration file: ${file} - fetched complete content`);
                }
            } else {
                diffData.otherFiles.push(file);
            }

            diffData.diffs.push(fileInfo);

        } catch (error) {
            console.warn(`Could not get diff for file: ${file}. It might have been deleted.`, error.message);

            // Try to get content for special files even if diff fails
            if (isModelFile(file) || isMigrationFile(file)) {
                const fullContent = getFileContent(file);
                if (fullContent) {
                    diffData.diffs.push({
                        path: file,
                        diff: '',
                        fullContent: fullContent,
                        type: isModelFile(file) ? 'model' : 'migration'
                    });
                }
            }
        }
    }

    return diffData;
}

/**
 * Formats the diff data into a structured format for the AI
 */
function formatDiffDataForAI(diffData) {
    let formattedContent = '';

    // Add summary
    formattedContent += `## Change Summary\n`;
    formattedContent += `- Model files changed: ${diffData.modelFiles.length} (${diffData.modelFiles.join(', ') || 'none'})\n`;
    formattedContent += `- Migration files changed: ${diffData.migrationFiles.length} (${diffData.migrationFiles.join(', ') || 'none'})\n`;
    formattedContent += `- Other files changed: ${diffData.otherFiles.length}\n\n`;

    // Add detailed diffs
    formattedContent += `## Detailed Changes\n\n`;

    for (const fileInfo of diffData.diffs) {
        formattedContent += `### File: ${fileInfo.path} (Type: ${fileInfo.type})\n\n`;

        if (fileInfo.diff) {
            formattedContent += `#### Git Diff:\n\`\`\`diff\n${fileInfo.diff}\n\`\`\`\n\n`;
        }

        if (fileInfo.fullContent) {
            formattedContent += `#### Complete File Content (for context):\n\`\`\`typescript\n${fileInfo.fullContent}\n\`\`\`\n\n`;
        }
    }

    return formattedContent;
}

/**
 * Reads and prepares the prompts (system and user)
 */
function preparePrompts(diffData) {
    const systemPromptPath = path.join('.github', 'prompts', 'convention-linter-system.txt');
    const userPromptPath = path.join('.github', 'prompts', 'convention-linter-user.txt');

    // Check if separate prompt files exist, otherwise use the original combined prompt
    if (fs.existsSync(systemPromptPath) && fs.existsSync(userPromptPath)) {
        const systemPrompt = fs.readFileSync(systemPromptPath, 'utf8');
        const userPromptTemplate = fs.readFileSync(userPromptPath, 'utf8');

        const formattedDiffData = formatDiffDataForAI(diffData);
        const userPrompt = userPromptTemplate.replace('__DIFF_DATA__', formattedDiffData);

        return { systemPrompt, userPrompt };
    } else {
        // Fallback to original prompt file if new structure doesn't exist
        const promptTemplatePath = path.join('.github', 'prompts', 'convention-linter-prompt.txt');

        if (!fs.existsSync(promptTemplatePath)) {
            throw new Error(`No prompt templates found. Please create either:\n` +
                `  - ${systemPromptPath} and ${userPromptPath} (recommended)\n` +
                `  - ${promptTemplatePath} (legacy)`);
        }

        console.log('⚠️  Using legacy combined prompt. Consider splitting into system and user prompts for better results.');

        const promptTemplate = fs.readFileSync(promptTemplatePath, 'utf8');
        const formattedDiffData = formatDiffDataForAI(diffData);

        // Split the legacy prompt into system and user parts
        const systemPrompt = promptTemplate.split('__DIFFS_PLACEHOLDER__')[0];
        const userPrompt = `Please analyze the following code changes:\n\n${formattedDiffData}`;

        return { systemPrompt, userPrompt };
    }
}

/**
 * Posts a comment to the GitHub Pull Request with enhanced formatting
 */
async function postPrComment(linterOutput, prNumber, repoFullName, token, provider, diffData) {
    const [owner, repo] = repoFullName.split('/');
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/issues/${prNumber}/comments`;

    const providerName = AI_PROVIDERS[provider].name;

    // Enhanced comment formatting
    let commentBody = `## 🚨 Convention Linter Analysis\n\n`;
    commentBody += `**AI Provider:** ${providerName}\n`;
    commentBody += `**Files Analyzed:** ${diffData.diffs.length}\n`;
    commentBody += `- Model files: ${diffData.modelFiles.length}\n`;
    commentBody += `- Migration files: ${diffData.migrationFiles.length}\n\n`;
    commentBody += `### ❌ Issues Found\n\n`;
    commentBody += `\`\`\`\n${linterOutput}\n\`\`\`\n\n`;

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
 * Posts a success comment to the GitHub Pull Request
 */
async function postSuccessComment(prNumber, repoFullName, token, provider, diffData) {
    const [owner, repo] = repoFullName.split('/');
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/issues/${prNumber}/comments`;

    const providerName = AI_PROVIDERS[provider].name;

    let commentBody = `## ✅ Convention Linter Passed!\n\n`;
    commentBody += `**AI Provider:** ${providerName}\n`;
    commentBody += `**Files Analyzed:** ${diffData.diffs.length}\n`;
    commentBody += `- Model files: ${diffData.modelFiles.length}\n`;
    commentBody += `- Migration files: ${diffData.migrationFiles.length}\n\n`;
    commentBody += `All naming conventions and structural integrity checks passed successfully! 🎉`;

    // Only post success comments if explicitly enabled
    if (process.env.POST_SUCCESS_COMMENTS === 'true') {
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
                console.log("✅ Successfully posted success comment to PR.");
            }
        } catch (error) {
            console.error("Failed to post success comment:", error);
        }
    }
}

/**
 * Main function to execute the convention linting process
 */
async function main() {
    console.log("🔍 Starting Sequelize Migration & Model Convention Linter...");

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

        // --- 4. Generate enhanced diff content ---
        const diffData = generateDiffContent(config.changedFiles, config.baseRef);

        if (diffData.diffs.length === 0) {
            console.log("🎉 No meaningful diffs found. Skipping AI analysis.");
            return;
        }

        // --- 5. Prepare prompts (system and user) ---
        const { systemPrompt, userPrompt } = preparePrompts(diffData);

        console.log(`📊 Analysis Summary:`);
        console.log(`  - Total files to analyze: ${diffData.diffs.length}`);
        console.log(`  - Model files: ${diffData.modelFiles.length}`);
        console.log(`  - Migration files: ${diffData.migrationFiles.length}`);
        console.log(`  - Other files: ${diffData.otherFiles.length}`);

        // --- 6. Call AI provider with system and user prompts ---
        const responseText = await callAIProvider(provider, systemPrompt, userPrompt, config.token);

        console.log("\n--- AI Analysis Result ---");
        console.log(responseText);
        console.log("-------------------------\n");

        // --- 7. Handle results ---
        const githubToken = process.env.GITHUB_TOKEN;

        if (!responseText.includes('OK')) {
            console.log("💔 Convention violations found. Posting a comment on the PR...");
            await postPrComment(responseText, config.prNumber, config.repository, githubToken, provider, diffData);
            process.exit(1);
        } else {
            console.log("🎉 Success! No convention violations found.");
            await postSuccessComment(config.prNumber, config.repository, githubToken, provider, diffData);
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
🔧 Sequelize Migration & Model Convention Linter

This tool validates consistency between Sequelize models and migrations in NestJS applications.

Environment Variables:
  Required:
    GITHUB_BASE_REF       Base branch for comparison
    CHANGED_FILES         Space-separated list of changed files
    GITHUB_REPOSITORY     Full repository name (owner/repo)
    PR_NUMBER            Pull request number
    GITHUB_TOKEN         GitHub API token
  
  Optional:
    AI_PROVIDER          AI provider: 'github', 'gemini', or 'openai' (default: 'github')
    POST_SUCCESS_COMMENTS Post comments on successful checks: 'true' or 'false' (default: 'false')
    DEBUG_THINKING       Show Gemini's thinking process: 'true' or 'false' (default: 'false')
  
  Provider-specific:
    GEMINI_API_KEY       Required for Gemini provider
    OPENAI_API_KEY       Required for OpenAI provider

Supported AI Providers:
${Object.entries(AI_PROVIDERS).map(([key, config]) =>
        `  ${key.padEnd(10)} - ${config.name} (${config.model})`
    ).join('\n')}

Features:
  ✓ System/User prompt separation for better AI context
  ✓ Enhanced model and migration file analysis
  ✓ Comprehensive diff processing with full file context
  ✓ Detailed error reporting with actionable feedback
  ✓ Support for multiple AI providers

Examples:
  # Using GitHub Models (default)
  ./convention-linter.js
  
  # Using Gemini with thinking process
  AI_PROVIDER=gemini DEBUG_THINKING=true ./convention-linter.js
  
  # Using OpenAI with success comments
  AI_PROVIDER=openai POST_SUCCESS_COMMENTS=true ./convention-linter.js

Prompt Files:
  The tool looks for prompt files in .github/prompts/:
  - convention-linter-system.txt (system prompt)
  - convention-linter-user.txt (user prompt template)
  
  Or legacy format:
  - convention-linter-prompt.txt (combined prompt)
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