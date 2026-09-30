/**
 * GulfHive ERP - Safe Domain Formula Evaluator
 * Deterministic mathematical expression evaluator without eval().
 * Supports variables, operator precedence, parentheses, and decimal precision.
 */

import Decimal from 'decimal.js';

export class FormulaEvaluator {
  /**
   * Safely evaluate a formula string using a variable context.
   * Example: "BASIC * 0.10 + 25" with context { BASIC: '1000' } => '125.000'
   */
  public static evaluate(formula: string, context: Record<string, string | number>): Decimal {
    if (!formula || !formula.trim()) {
      return new Decimal(0);
    }

    // 1. Tokenize expression into numbers, operators, identifiers, and parentheses
    const tokens = this.tokenize(formula);
    if (tokens.length === 0) return new Decimal(0);

    // 2. Convert to Postfix (Reverse Polish Notation) using Shunting-Yard Algorithm
    const postfix = this.toPostfix(tokens, context);

    // 3. Evaluate Postfix Expression safely using Decimal.js
    return this.evaluatePostfix(postfix);
  }

  /**
   * Validates the syntax and safety of a formula expression.
   */
  public static validate(formula: string): { isValid: boolean; error?: string } {
    if (!formula || !formula.trim()) {
      return { isValid: false, error: 'Formula cannot be empty' };
    }

    try {
      // Check for illegal consecutive operators
      if (/[\+\-\*\/%]{2,}/.test(formula.replace(/\s+/g, ''))) {
        return { isValid: false, error: 'Formula contains consecutive operators' };
      }

      // Check parentheses balance
      let depth = 0;
      for (const ch of formula) {
        if (ch === '(') depth++;
        if (ch === ')') depth--;
        if (depth < 0) return { isValid: false, error: 'Mismatched closing parenthesis' };
      }
      if (depth !== 0) return { isValid: false, error: 'Unclosed parenthesis' };

      // Test evaluate with mock identifier values
      const tokens = this.tokenize(formula);
      const mockContext: Record<string, number> = {};
      for (const t of tokens) {
        if (/^[A-Z_][A-Z0-9_]*$/i.test(t) && isNaN(Number(t))) {
          mockContext[t] = 100;
        }
      }
      this.evaluate(formula, mockContext);
      return { isValid: true };
    } catch (err: any) {
      return { isValid: false, error: err.message || 'Invalid formula syntax' };
    }
  }

  private static tokenize(expr: string): string[] {
    const tokens: string[] = [];
    let current = '';

    for (let i = 0; i < expr.length; i++) {
      const ch = expr[i];

      if (/\s/.test(ch)) {
        if (current) {
          tokens.push(current);
          current = '';
        }
        continue;
      }

      if (['+', '-', '*', '/', '(', ')', '%'].includes(ch)) {
        if (current) {
          tokens.push(current);
          current = '';
        }
        tokens.push(ch);
      } else {
        current += ch;
      }
    }

    if (current) tokens.push(current);
    return tokens;
  }

  private static precedence(op: string): number {
    if (op === '+' || op === '-') return 1;
    if (op === '*' || op === '/' || op === '%') return 2;
    return 0;
  }

  private static toPostfix(tokens: string[], context: Record<string, string | number>): Array<string | Decimal> {
    const output: Array<string | Decimal> = [];
    const opStack: string[] = [];

    // Normalize context keys to uppercase
    const upperContext: Record<string, Decimal> = {};
    for (const [k, v] of Object.entries(context)) {
      upperContext[k.toUpperCase()] = new Decimal(v.toString());
    }

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];

      if (token === '(') {
        opStack.push(token);
      } else if (token === ')') {
        while (opStack.length > 0 && opStack[opStack.length - 1] !== '(') {
          output.push(opStack.pop()!);
        }
        if (opStack.length === 0) {
          throw new Error('Mismatched parentheses in payroll formula');
        }
        opStack.pop(); // discard '('
      } else if (['+', '-', '*', '/', '%'].includes(token)) {
        // Handle unary minus: if '-' is the first token or follows an operator or '('
        if (token === '-' && (i === 0 || tokens[i - 1] === '(' || ['+', '-', '*', '/', '%'].includes(tokens[i - 1]))) {
          output.push(new Decimal(0));
          opStack.push('-');
          continue;
        }

        while (
          opStack.length > 0 &&
          opStack[opStack.length - 1] !== '(' &&
          this.precedence(opStack[opStack.length - 1]) >= this.precedence(token)
        ) {
          output.push(opStack.pop()!);
        }
        opStack.push(token);
      } else {
        // Number or Identifier / Variable
        const tokenUpper = token.toUpperCase();
        if (tokenUpper in upperContext) {
          output.push(upperContext[tokenUpper]);
        } else if (/^-?\d+(\.\d+)?$/.test(token)) {
          output.push(new Decimal(token));
        } else {
          // Unknown variable defaults to 0 to prevent crashes
          output.push(new Decimal(0));
        }
      }
    }

    while (opStack.length > 0) {
      const op = opStack.pop()!;
      if (op === '(' || op === ')') {
        throw new Error('Mismatched parentheses in payroll formula');
      }
      output.push(op);
    }

    return output;
  }

  private static evaluatePostfix(postfix: Array<string | Decimal>): Decimal {
    const stack: Decimal[] = [];

    for (const item of postfix) {
      if (item instanceof Decimal) {
        stack.push(item);
      } else {
        const op = item;
        const b = stack.pop();
        const a = stack.pop();

        if (a === undefined || b === undefined) {
          throw new Error('Invalid formula expression syntax');
        }

        switch (op) {
          case '+':
            stack.push(a.plus(b));
            break;
          case '-':
            stack.push(a.minus(b));
            break;
          case '*':
            stack.push(a.times(b));
            break;
          case '/':
            if (b.isZero()) {
              throw new Error('Division by zero in payroll formula');
            }
            stack.push(a.dividedBy(b));
            break;
          case '%':
            stack.push(a.mod(b));
            break;
          default:
            throw new Error(`Unsupported formula operator: ${op}`);
        }
      }
    }

    if (stack.length !== 1) {
      throw new Error('Invalid formula structure');
    }

    return stack[0];
  }
}
