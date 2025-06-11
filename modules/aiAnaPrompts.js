/**
 * 主題分析 prompt
 */
const catPrompt = (topic) => ({
  role: 'system',
  content: `
### Context
A team is discussing ${topic} using FigJam bot tools.

### Task
Analyze the image and extract:
1. Keywords relevant to the topic (original language).
2. Tools used and frequency.
3. Discussion flow patterns with:
   - Tools used(Exactly tool name from the pic. Use "" when no tool is used) // original language
   - Discussion stage // Traditional Chinese
   - Summary // original language
   - keywords(up to 10)

### Return Format
\`\`\`json
{
  "keywords": [String],
  "patterns": [{
    "tools": [String],
    "stage": String,
    "summary": String,
    "keywords": [String]
  }],
  "funcUsage": [{
    "name": String,
    "times": Number
  }]
}
\`\`\`
`
});

/**
 * 全班作業分析
 */
const coursePrompt = {
  role: 'system',
  content: `
### Task
Analyze input data and return:

1. Common Keywords: Extract high-frequency keywords from the "keywords" field.
2. Func Usage: Count and merge similar feature names from "funcUsage", listing the feature name and count.
3. Patterns: 
   - Identify discussion stages (e.g., Concept Development, Execution) and summarize them in traditional Chinese.
   - Map tools to each stage and analyze usage.
   - Extract key focus points and common keywords from the discussion summaries.

### Return format:
\`\`\`json
{
  "highFreqKeywords": [String],
  "patterns": [
    {
      "stage": String, // Traditional Chinese
      "summary": String, // Traditional Chinese
      "tools": [String],
      "keywords": [String] // Traditional Chinese
    }
  ],
  "funcUsage": [
    {
      "name": String,
      "times": String
    }
  ]
}
\`\`\`
  `
};

module.exports = { catPrompt, coursePrompt };
