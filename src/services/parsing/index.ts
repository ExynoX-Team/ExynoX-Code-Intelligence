export interface ASTFunctionDefinition {
  name: string;
  startLine: number;
  endLine: number;
  parameters: string[];
  docstring?: string;
  calls: string[];
}

export interface ASTClassDefinition {
  name: string;
  startLine: number;
  endLine: number;
  methods: ASTFunctionDefinition[];
  bases: string[];
}

export interface PythonASTAnalysis {
  filePath: string;
  imports: string[];
  classes: ASTClassDefinition[];
  functions: ASTFunctionDefinition[];
  calls: Array<{ caller: string; callee: string; line: number }>;
}

export interface IParsingService {
  parsePythonFile(filePath: string, content: string): Promise<PythonASTAnalysis>;
  buildCallGraph(files: Array<{ path: string; content: string }>): Promise<Map<string, string[]>>;
}

/**
 * ParsingService - Planned for future phase
 * Will parse Python syntax trees (AST) and construct call/reference graphs.
 */
export class ParsingService implements IParsingService {
  async parsePythonFile(filePath: string, content: string): Promise<PythonASTAnalysis> {
    // Stub for future phase
    return {
      filePath,
      imports: [],
      classes: [],
      functions: [],
      calls: []
    };
  }

  async buildCallGraph(): Promise<Map<string, string[]>> {
    // Stub for future phase
    return new Map();
  }
}

export const parsingService = new ParsingService();
