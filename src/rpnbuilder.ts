// @ts-nocheck
const prompt = require("prompt-sync")({ sigint: true });

const priorityDict = {
    '#IIF': {
        priority: 1,
        orientation: 'left'
    },
    '!': {
        priority: 11,
        orientation: 'left'
    },
    '~': {
        priority: 11,
        orientation: 'left'
    },
    '*': {
        priority: 10,
        orientation: 'left'
    },
    '/': {
        priority: 10,
        orientation: 'left'
    },
    '+': {
        priority: 5,
        orientation: 'left'
    },
    '-': {
        priority: 5,
        orientation: 'left'
    },
    '==': {
        priority: 3,
        orientation: 'left'
    },
    '<': {
        priority: 4,
        orientation: 'left'
    },
    '>': {
        priority: 4,
        orientation: 'left'
    },
    '^': {
        priority: 11,
        orientation: 'right'
    },
    '||': {
        priority: 3,
        orientation: 'left'
    },
    '&&': {
        priority: 3,
        orientation: 'left'
    },
}

function expressionParser(expression: any, _builder: any) {

    if (typeof _builder === 'string') {
        var rawString = _builder;
        let builder = new PolisBuilder(rawString);
        traverseExpression(builder);
        return builder.end();
    } else if (_builder.constructor.name == 'PolisBuilder') {
        traverseExpression(_builder);
    }

    function traverseExpression(builder: any) {
        operandParser(expression.children.Operand[0], builder);
        for (let i = 1; i < expression.children.Operand.length; i++) {
            operatorParser(expression.children.Operator[i - 1], builder);
            operandParser(expression.children.Operand[i], builder);
        }
    }

}

function operandParser(operand: any, builder: any) {
    let operandType = Object.keys(operand.children)[0]
    if (operandType === 'OperandWithUnary') {
        operandWithUnaryParser(operand.children.OperandWithUnary[0], builder);
    } else if (operandType === "OperandSimple") {
        operandSimpleParser(operand.children.OperandSimple[0], builder);
    }
}

function checkIfFilterTime(expression) {
    try {
        if (expression.children['Operand'][0].children['OperandSimple'][0].children['VariableReference'][0].children['FilterRefference'][0].children['Identifier'][0].image === 'time') {
            return true;
        }
        return false;
    } catch (e) {
        console.log('Error: FilterTime error')
        return false;
    }
}
function operandSimpleParser(operand: any, builder: any) {
    let operandType = Object.keys(operand.children)[0];
    if (operandType === "ParenthisExpression") {
        parenthisExpressionParser(operand.children[operandType][0], builder)
        return;
    }
    if (operandType === "VariableReference") {

        let varRef = operand.children['VariableReference'][0];

        if (varRef.children['FunctionCall'] && !checkIfFilterTime(varRef.children['FunctionCall'][0].children["Expression"][0])) {
            var functionName = varRef.children['Identifier'][0].image;
            var functionCall = varRef.children['FunctionCall'][0];
            if (functionCall.children["Expression"]) {
                functionCall.children["Expression"].forEach(expression => {
                    builder.next({ type: "leftBracket", str: '(', tokenType: "LeftParenthesis" });
                    expressionParser(expression, builder);
                    builder.next({ type: "rightBracket", str: ')', tokenType: "RightParenthesis" });
                })
                builder.outputQueue.push({ str: `${functionCall.children["Expression"].length}`, tokenType: 'AgrumentsCount' });
                builder.outputQueue.push({ str: `#${functionName}`, tokenType: 'FunctionCall' });
            } else {
                builder.outputQueue.push({ str: `${0}`, tokenType: 'AgrumentsCount' });
                builder.outputQueue.push({ str: `#${functionName}`, tokenType: 'FunctionCall' });
            }

            return;
        }
        builder.next({ type: "operand", str: builder.rawString.slice(operand.location.startOffset, operand.location.endOffset + 1), tokenType: "Identifier" });
        return;
    }
    if (operandType === "Number") {
        builder.next({ type: "operand", str: operand.children["Number"][0].image, tokenType: "Number" })
        return;
    }
    if (operandType === "String") {
        builder.next({ type: "operand", str: operand.children["String"][0].image, tokenType: "String" })
        return;
    }
    if (operandType === "IIFExpression") {

        builder.next({ type: "leftBracket", str: '(', tokenType: "LeftParenthesis" });
        var iif = operand.children["IIFExpression"][0];

        builder.next({ type: "leftBracket", str: '(', tokenType: "LeftParenthesis" });
        expressionParser(iif.children["Expression"][2], builder);
        builder.next({ type: "rightBracket", str: ')', tokenType: "RightParenthesis" });

        builder.next({ type: "leftBracket", str: '(', tokenType: "LeftParenthesis" });
        expressionParser(iif.children["Expression"][3], builder);
        builder.next({ type: "rightBracket", str: ')', tokenType: "RightParenthesis" });

        builder.next({ type: "leftBracket", str: '(', tokenType: "LeftParenthesis" });
        expressionParser(iif.children["Expression"][0], builder);
        builder.next({ type: "rightBracket", str: ')', tokenType: "RightParenthesis" });

        builder.next({ type: "leftBracket", str: '(', tokenType: "LeftParenthesis" });
        expressionParser(iif.children["Expression"][1], builder);
        builder.next({ type: "rightBracket", str: ')', tokenType: "RightParenthesis" });

        let compareOperator = (iif.children["GreaterThan"] ||
            iif.children["LesserThan"] ||
            iif.children["Equal"] ||
            iif.children["NotEqual"] ||
            iif.children["GreaterThanEqual"] ||
            iif.children["LesserThanEqual"])

        builder.outputQueue.push({ str: compareOperator[0].image, tokenType: compareOperator[0].tokenType.name });

        builder.next({ type: "rightBracket", str: ')', tokenType: "RightParenthesis" });

        builder.outputQueue.push({ str: "#IIF", tokenType: "IIFCall" });
        return;
    }
}

function operatorParser(operator: any, builder: any) {
    let operatorType = Object.keys(operator.children)[0];
    builder.next({ type: 'operator', str: operator.children[operatorType][0].image, tokenType: operatorType })
}

function operandWithUnaryParser(operand: any, builder: any) {
    operandSimpleParser(operand.children['OperandSimple'][0], builder);
    if (operand.children['Not']) {
        builder.next({ type: 'operator', str: '!', tokenType: "Not" })
    }
    if (operand.children['Minus']) {
        builder.next({ type: 'operator', str: '~', tokenType: "UnaryMinus" })
    }
}

function parenthisExpressionParser(expression: any, builder: any) {
    builder.next({ type: "leftBracket", str: '(', tokenType: "LeftParenthesis" });
    expressionParser(expression.children['Expression'][0], builder);
    builder.next({ type: "rightBracket", str: ')', tokenType: "RightParenthesis" });
}

class PolisBuilder {
    operatorStack: any[];
    outputQueue: any[];
    rawString: string;
    constructor(rawString: string) {
        this.rawString = rawString;
        this.operatorStack = [];
        this.outputQueue = [];
    }
    next(token: any) {
        switch (token.type) {
            case "operator":
                while (this.operatorStack.length > 0 && this.operatorStack[this.operatorStack.length - 1].str !== '(' &&
                    (priorityDict[this.operatorStack[this.operatorStack.length - 1].str].priority > priorityDict[token.str].priority ||
                        (priorityDict[this.operatorStack[this.operatorStack.length - 1].str].priority === priorityDict[token.str].priority && priorityDict[token.str].orientation === 'left'))) {
                    this.outputQueue.push(this.operatorStack.pop());
                }
                this.operatorStack.push({ str: token.str, tokenType: token.tokenType });
                break;
            case "operand":
                this.outputQueue.push({ str: token.str, tokenType: token.tokenType });
                break;
            case "leftBracket":
                this.operatorStack.push({ str: token.str, tokenType: token.tokenType });
                break;
            case "rightBracket":
                while (this.operatorStack[this.operatorStack.length - 1].str !== "(") {
                    this.outputQueue.push(this.operatorStack.pop());
                }
                this.operatorStack.pop();
                break;
        }
    }
    end() {
        while (this.operatorStack.length !== 0)
            this.outputQueue.push(this.operatorStack.pop());
        return this.outputQueue;
    }
}

function parseExpression(expression) {
    var res = expressionParser(expression);
    return res;
}


function variableRefferenceToImage(varREf) {

}
function parseExressions(cst, rawString) {
    let assignStatements = [];
    cst.children.SourceBlock.forEach((sourceBlock, SBIndex) => {
        assignStatements.push([]);
        sourceBlock.children.AssignStatement.forEach((statement) => {
            assignStatements[SBIndex].push(statement.children)
        })
    })
    assignStatements.forEach(sb => {
        sb.forEach(statement => {
            let expression = statement.Expression[0];
            let res = expressionParser(expression, rawString);
            statement.parsingResult = res;
        });
    })
    return assignStatements;
}

export { parseExressions }