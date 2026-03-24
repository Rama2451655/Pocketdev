// src/services/AIService.ts
import axios from 'axios';

export interface AIMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AICompletionOptions {
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
}

class AIService {
  private readonly anthropicEndpoint = 'https://api.anthropic.com/v1/messages';
  private readonly defaultModel = 'claude-sonnet-4-20250514';

  async chat(
    messages: AIMessage[],
    systemPrompt: string,
    apiKey: string,
    model: string = this.defaultModel,
    options: AICompletionOptions = {}
  ): Promise<string> {
    if (!apiKey) {
      throw new Error('No API key configured. Please add your Anthropic API key in Settings.');
    }

    const response = await axios.post(
      this.anthropicEndpoint,
      {
        model: model || this.defaultModel,
        max_tokens: options.maxTokens || 2048,
        system: systemPrompt,
        messages,
      },
      {
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        timeout: 60000,
      }
    );

    const block = response.data.content?.[0];
    if (block?.type === 'text') return block.text;
    throw new Error('Unexpected API response format');
  }

  async getCodeCompletion(
    code: string,
    language: string,
    cursorPosition: number,
    apiKey: string
  ): Promise<string> {
    const prefix = code.slice(0, cursorPosition);
    const suffix = code.slice(cursorPosition);

    const prompt = `Complete this ${language} code. Return ONLY the completion text, no explanation:

\`\`\`${language}
${prefix}<CURSOR>${suffix}
\`\`\``;

    return this.chat(
      [{ role: 'user', content: prompt }],
      'You are a code completion engine. Return only the code completion, nothing else.',
      apiKey,
      this.defaultModel,
      { maxTokens: 256, temperature: 0.2 }
    );
  }

  async explainCode(code: string, language: string, apiKey: string): Promise<string> {
    return this.chat(
      [{
        role: 'user',
        content: `Explain this ${language} code clearly and concisely:\n\`\`\`${language}\n${code}\n\`\`\``,
      }],
      'You are an expert code explainer. Be clear, concise, and helpful.',
      apiKey
    );
  }

  async fixBug(code: string, error: string, language: string, apiKey: string): Promise<string> {
    return this.chat(
      [{
        role: 'user',
        content: `Fix the bug in this ${language} code.\n\nError: ${error}\n\nCode:\n\`\`\`${language}\n${code}\n\`\`\`\n\nReturn the fixed code with a brief explanation.`,
      }],
      'You are an expert debugger. Identify and fix bugs, explain what was wrong.',
      apiKey
    );
  }

  async generateCode(description: string, language: string, apiKey: string): Promise<string> {
    return this.chat(
      [{
        role: 'user',
        content: `Write ${language} code that does the following:\n\n${description}\n\nReturn production-ready code with comments.`,
      }],
      'You are an expert software engineer. Write clean, efficient, well-commented code.',
      apiKey
    );
  }

  async refactorCode(code: string, language: string, apiKey: string): Promise<string> {
    return this.chat(
      [{
        role: 'user',
        content: `Refactor this ${language} code for better readability, maintainability, and performance:\n\`\`\`${language}\n${code}\n\`\`\``,
      }],
      'You are a senior software engineer specializing in code quality.',
      apiKey
    );
  }

  async generateTests(code: string, language: string, framework: string, apiKey: string): Promise<string> {
    return this.chat(
      [{
        role: 'user',
        content: `Write comprehensive ${framework} unit tests for this ${language} code:\n\`\`\`${language}\n${code}\n\`\`\`\n\nInclude edge cases and error scenarios.`,
      }],
      'You are a testing expert. Write thorough, meaningful tests.',
      apiKey
    );
  }

  async addDocumentation(code: string, language: string, apiKey: string): Promise<string> {
    return this.chat(
      [{
        role: 'user',
        content: `Add comprehensive documentation comments to this ${language} code. Keep the code identical, only add docs:\n\`\`\`${language}\n${code}\n\`\`\``,
      }],
      'You are a technical writer. Add clear, informative documentation.',
      apiKey
    );
  }

  async securityReview(code: string, language: string, apiKey: string): Promise<string> {
    return this.chat(
      [{
        role: 'user',
        content: `Perform a security review of this ${language} code. Identify vulnerabilities, security issues, and suggest fixes:\n\`\`\`${language}\n${code}\n\`\`\``,
      }],
      'You are a cybersecurity expert. Identify ALL security vulnerabilities and explain how to fix them.',
      apiKey
    );
  }

  async translateCode(code: string, fromLanguage: string, toLanguage: string, apiKey: string): Promise<string> {
    return this.chat(
      [{
        role: 'user',
        content: `Convert this ${fromLanguage} code to ${toLanguage}. Maintain the same logic and functionality:\n\`\`\`${fromLanguage}\n${code}\n\`\`\``,
      }],
      `You are an expert in both ${fromLanguage} and ${toLanguage}. Translate idiomatically.`,
      apiKey
    );
  }
}

export default new AIService();
