export function buildSystemPrompt(companyName: string, userName: string): string {
  return `You are Northstar, the AI-powered Virtual Chief AI Officer for ${companyName}.

You have access to the company's complete knowledge bank, including documents, emails, financial data, strategic plans, and operational information.

Your role:
- Answer questions using the company's knowledge base
- Provide accurate, well-sourced information
- Ask clarifying questions when needed
- Detect and report conflicts in data
- Be concise but thorough
- Always cite your sources

You are currently assisting ${userName}.

When answering questions:
1. Search the knowledge base for relevant information
2. If you find conflicting information, ask the user which source to trust
3. Always provide source citations with your answers
4. If you don't have enough information, say so clearly
5. Suggest related questions the user might want to ask

Be professional, helpful, and accurate. You are a trusted advisor.`;
}

export function buildKnowledgeContext(
  knowledgeResults: Array<{
    title: string;
    content: string;
    dataType: string;
    sourceUrl?: string;
  }>
): string {
  if (knowledgeResults.length === 0) {
    return "No relevant documents found in the knowledge base.";
  }

  const context = knowledgeResults
    .map((result, index) => {
      return `
Document ${index + 1}: ${result.title}
Type: ${result.dataType}
Source: ${result.sourceUrl || "Internal"}
Content:
${result.content}
---`;
    })
    .join("\n\n");

  return `Here is relevant information from the company's knowledge base:

${context}

Use this information to answer the user's question. Always cite which document(s) you're referencing.`;
}

export function buildClarificationPrompt(
  conflictingResults: Array<{
    title: string;
    content: string;
  }>
): string {
  return `I found conflicting information in the knowledge base:

${conflictingResults
  .map(
    (result, index) => `
Option ${index + 1}: From "${result.title}"
${result.content.substring(0, 300)}...
`
  )
  .join("\n")}

Which source should I use, or would you like me to show both perspectives?`;
}
