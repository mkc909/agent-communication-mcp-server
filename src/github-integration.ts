import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { Octokit } from '@octokit/rest';

export class GitHubIntegration {
  private octokit: Octokit;

  constructor() {
    // Initialize Octokit with GitHub token from environment variables
    this.octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN,
    });
  }

  public registerHandlers(server: Server) {
    // Register tools for GitHub integration
    server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'github_create_issue',
          description: 'Create GitHub issue',
          inputSchema: {
            type: 'object',
            properties: {
              repository: {
                type: 'string',
                description: 'Repository name (owner/repo)',
              },
              title: {
                type: 'string',
                description: 'Issue title',
              },
              body: {
                type: 'string',
                description: 'Issue body',
              },
              labels: {
                type: 'array',
                items: {
                  type: 'string',
                },
                description: 'Issue labels',
              },
              assign_to_agent: {
                type: 'string',
                description: 'Agent ID to assign the issue to (optional)',
              },
            },
            required: ['repository', 'title', 'body'],
          },
        },
        {
          name: 'github_comment_issue',
          description: 'Comment on GitHub issue',
          inputSchema: {
            type: 'object',
            properties: {
              repository: {
                type: 'string',
                description: 'Repository name (owner/repo)',
              },
              issue_number: {
                type: 'number',
                description: 'Issue number',
              },
              comment: {
                type: 'string',
                description: 'Comment text',
              },
            },
            required: ['repository', 'issue_number', 'comment'],
          },
        },
        {
          name: 'github_create_pr',
          description: 'Create GitHub PR',
          inputSchema: {
            type: 'object',
            properties: {
              repository: {
                type: 'string',
                description: 'Repository name (owner/repo)',
              },
              title: {
                type: 'string',
                description: 'PR title',
              },
              body: {
                type: 'string',
                description: 'PR body',
              },
              base: {
                type: 'string',
                description: 'Base branch',
              },
              head: {
                type: 'string',
                description: 'Head branch',
              },
            },
            required: ['repository', 'title', 'body', 'base', 'head'],
          },
        },
        {
          name: 'github_review_pr',
          description: 'Review GitHub PR',
          inputSchema: {
            type: 'object',
            properties: {
              repository: {
                type: 'string',
                description: 'Repository name (owner/repo)',
              },
              pr_number: {
                type: 'number',
                description: 'PR number',
              },
              review_type: {
                type: 'string',
                enum: ['approve', 'request_changes', 'comment'],
                description: 'Review type',
              },
              comment: {
                type: 'string',
                description: 'Review comment',
              },
            },
            required: ['repository', 'pr_number', 'review_type', 'comment'],
          },
        },
      ],
    }));

    // Handle tool calls
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      switch (request.params.name) {
        case 'github_create_issue':
          return this.createIssue(request.params.arguments);
        case 'github_comment_issue':
          return this.commentIssue(request.params.arguments);
        case 'github_create_pr':
          return this.createPR(request.params.arguments);
        case 'github_review_pr':
          return this.reviewPR(request.params.arguments);
        default:
          throw new McpError(
            ErrorCode.MethodNotFound,
            `Unknown tool: ${request.params.name}`
          );
      }
    });
  }

  private async createIssue(args: any): Promise<any> {
    try {
      // Validate arguments
      if (!this.isValidCreateIssueArgs(args)) {
        throw new McpError(
          ErrorCode.InvalidParams,
          'Invalid issue creation arguments'
        );
      }

      // Parse repository owner and name
      const [owner, repo] = args.repository.split('/');
      if (!owner || !repo) {
        throw new McpError(
          ErrorCode.InvalidParams,
          'Repository must be in the format "owner/repo"'
        );
      }

      // Create issue
      const response = await this.octokit.issues.create({
        owner,
        repo,
        title: args.title,
        body: args.body,
        labels: args.labels,
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              issue_number: response.data.number,
              html_url: response.data.html_url,
              title: response.data.title,
              state: response.data.state,
              created_at: response.data.created_at,
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      if (error instanceof McpError) {
        throw error;
      }
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to create GitHub issue: ${(error as Error).message}`
      );
    }
  }

  private async commentIssue(args: any): Promise<any> {
    try {
      // Validate arguments
      if (!this.isValidCommentIssueArgs(args)) {
        throw new McpError(
          ErrorCode.InvalidParams,
          'Invalid issue comment arguments'
        );
      }

      // Parse repository owner and name
      const [owner, repo] = args.repository.split('/');
      if (!owner || !repo) {
        throw new McpError(
          ErrorCode.InvalidParams,
          'Repository must be in the format "owner/repo"'
        );
      }

      // Create comment
      const response = await this.octokit.issues.createComment({
        owner,
        repo,
        issue_number: args.issue_number,
        body: args.comment,
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              comment_id: response.data.id,
              html_url: response.data.html_url,
              created_at: response.data.created_at,
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      if (error instanceof McpError) {
        throw error;
      }
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to comment on GitHub issue: ${(error as Error).message}`
      );
    }
  }

  private async createPR(args: any): Promise<any> {
    try {
      // Validate arguments
      if (!this.isValidCreatePRArgs(args)) {
        throw new McpError(
          ErrorCode.InvalidParams,
          'Invalid PR creation arguments'
        );
      }

      // Parse repository owner and name
      const [owner, repo] = args.repository.split('/');
      if (!owner || !repo) {
        throw new McpError(
          ErrorCode.InvalidParams,
          'Repository must be in the format "owner/repo"'
        );
      }

      // Create PR
      const response = await this.octokit.pulls.create({
        owner,
        repo,
        title: args.title,
        body: args.body,
        head: args.head,
        base: args.base,
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              pr_number: response.data.number,
              html_url: response.data.html_url,
              title: response.data.title,
              state: response.data.state,
              created_at: response.data.created_at,
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      if (error instanceof McpError) {
        throw error;
      }
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to create GitHub PR: ${(error as Error).message}`
      );
    }
  }

  private async reviewPR(args: any): Promise<any> {
    try {
      // Validate arguments
      if (!this.isValidReviewPRArgs(args)) {
        throw new McpError(
          ErrorCode.InvalidParams,
          'Invalid PR review arguments'
        );
      }

      // Parse repository owner and name
      const [owner, repo] = args.repository.split('/');
      if (!owner || !repo) {
        throw new McpError(
          ErrorCode.InvalidParams,
          'Repository must be in the format "owner/repo"'
        );
      }

      // Map review type to GitHub event
      const event = this.mapReviewTypeToEvent(args.review_type);

      // Create review
      const response = await this.octokit.pulls.createReview({
        owner,
        repo,
        pull_number: args.pr_number,
        body: args.comment,
        event,
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              review_id: response.data.id,
              state: response.data.state,
              submitted_at: response.data.submitted_at,
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      if (error instanceof McpError) {
        throw error;
      }
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to review GitHub PR: ${(error as Error).message}`
      );
    }
  }

  private isValidCreateIssueArgs(args: any): args is {
    repository: string;
    title: string;
    body: string;
    labels?: string[];
    assign_to_agent?: string;
  } {
    return (
      typeof args === 'object' &&
      args !== null &&
      typeof args.repository === 'string' &&
      typeof args.title === 'string' &&
      typeof args.body === 'string' &&
      (args.labels === undefined || Array.isArray(args.labels)) &&
      (args.assign_to_agent === undefined || typeof args.assign_to_agent === 'string')
    );
  }

  private isValidCommentIssueArgs(args: any): args is {
    repository: string;
    issue_number: number;
    comment: string;
  } {
    return (
      typeof args === 'object' &&
      args !== null &&
      typeof args.repository === 'string' &&
      typeof args.issue_number === 'number' &&
      typeof args.comment === 'string'
    );
  }

  private isValidCreatePRArgs(args: any): args is {
    repository: string;
    title: string;
    body: string;
    base: string;
    head: string;
  } {
    return (
      typeof args === 'object' &&
      args !== null &&
      typeof args.repository === 'string' &&
      typeof args.title === 'string' &&
      typeof args.body === 'string' &&
      typeof args.base === 'string' &&
      typeof args.head === 'string'
    );
  }

  private isValidReviewPRArgs(args: any): args is {
    repository: string;
    pr_number: number;
    review_type: 'approve' | 'request_changes' | 'comment';
    comment: string;
  } {
    return (
      typeof args === 'object' &&
      args !== null &&
      typeof args.repository === 'string' &&
      typeof args.pr_number === 'number' &&
      typeof args.review_type === 'string' &&
      ['approve', 'request_changes', 'comment'].includes(args.review_type) &&
      typeof args.comment === 'string'
    );
  }

  private mapReviewTypeToEvent(reviewType: string): 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT' {
    switch (reviewType) {
      case 'approve':
        return 'APPROVE';
      case 'request_changes':
        return 'REQUEST_CHANGES';
      case 'comment':
        return 'COMMENT';
      default:
        return 'COMMENT';
    }
  }
}