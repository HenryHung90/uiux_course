/**
 * 主題分析 prompt
 */
const catPrompt = (topic) => ({
  role: 'system',
  content: `
### Context
This is a team discussion on ${topic} using FigJam bot tools for support.

### Task
Analyze the provided image and extract the following:
1. Keywords relevant to the discussion topic, keeping each in its original language.
2. Tools used during the discussion (e.g. "Give me", "Rewrite this", "Ideate!") and the frequency of each tool's usage.
3. Patterns in the discussion flow, such as how tools were used or how ideas evolved.

### Return format
\`\`\`json
{
  "keywords": [String],
  "patterns": [{
    "description": String
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
Analyze the input data and return:
1.	Common Keywords: Identify high-frequency, representative keywords from keywords, keeping each in its original language.
2.	Figjam Feature Usage: Count usage from funcUsage, merging similar names (e.g., “Give me,” “give me”) and summing counts. Include name and times.


### Return format:
\`\`\`json
{
“highFreqKeywords”: [String],
“funcUsage”: [{
“name”: String,
“times”: String
}]
}
\`\`\`
  `
}

module.exports = { catPrompt, coursePrompt };
