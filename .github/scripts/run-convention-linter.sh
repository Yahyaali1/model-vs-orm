#!/bin/bash
# .github/scripts/run-convention-linter.sh

set -e

echo "🔍 Analyzing naming convention violations..."

# Fetch the base branch for diff comparison
git fetch origin $GITHUB_BASE_REF

# Read the prompt template
PROMPT_TEMPLATE=$(cat ./.github/prompts/convention-linter-prompt.txt)

# Initialize diff content
DIFF_CONTENT=""

# Process each changed file
for file in $CHANGED_FILES; do
    echo "  - Processing diff for: $file"

    # Get the diff for the current file
    FILE_DIFF=$(git diff origin/$GITHUB_BASE_REF HEAD -- "$file")

    # Skip if no diff (shouldn't happen but good to be safe)
    if [ -z "$FILE_DIFF" ]; then
        continue
    fi

    # Append to diff content
    DIFF_CONTENT="${DIFF_CONTENT}\n\n--- Diff for ${file} ---\n${FILE_DIFF}"
done

# Replace placeholder in prompt template with actual diff
FULL_PROMPT="${PROMPT_TEMPLATE//__DIFFS_PLACEHOLDER__/$DIFF_CONTENT}"

# Escape the prompt for JSON
ESCAPED_PROMPT=$(echo "$FULL_PROMPT" | jq -R -s '.')

# Construct JSON payload for GitHub Models API
JSON_PAYLOAD=$(cat <<EOF
{
  "messages": [
    {
      "role": "user",
      "content": $ESCAPED_PROMPT
    }
  ],
  "model": "openai/gpt-4o"
}
EOF
)

echo "🤖 Calling GitHub Models API..."

# Make API call to GitHub Models
API_RESPONSE=$(curl -s -X POST \
  "https://models.github.ai/inference/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  -d "${JSON_PAYLOAD}")

# Check if API call was successful
if [ $? -ne 0 ]; then
    echo "❌ Failed to call GitHub Models API"
    exit 1
fi

# Extract response text from GitHub Models format
RESPONSE_TEXT=$(echo "${API_RESPONSE}" | jq -r '.choices[0].message.content // "API_ERROR"')

# Check for API errors
if [ "$RESPONSE_TEXT" = "API_ERROR" ] || [ "$RESPONSE_TEXT" = "null" ]; then
    echo "❌ Invalid response from GitHub Models API"
    echo "API Response: $API_RESPONSE"
    exit 1
fi

echo "--- GitHub Models Analysis Result ---"
echo "$RESPONSE_TEXT"
echo "-----------------------------------"

# Set output for GitHub Actions
echo "LINTER_OUTPUT=$RESPONSE_TEXT" >> $GITHUB_ENV

# Check if there are violations (response is not exactly 'OK')
if [ "$RESPONSE_TEXT" != "OK" ]; then
    echo "💔 Convention violations found."
    exit 1
else
    echo "🎉 Success! No convention violations found."
fi