"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const utils_1 = require("@typescript-eslint/utils");
const tsutils = __importStar(require("ts-api-utils"));
const ts = __importStar(require("typescript"));
const util_1 = require("../util");
exports.default = (0, util_1.createRule)({
    name: 'no-useless-default-assignment',
    meta: {
        type: 'suggestion',
        docs: {
            description: 'Disallow default values that will never be used',
            recommended: 'strict',
            requiresTypeChecking: true,
        },
        fixable: 'code',
        messages: {
            uselessDefaultAssignment: 'Default value is useless because the {{ type }} is not optional.',
            uselessUndefined: 'Default value is useless because it is undefined. Optional {{ type }}s are already undefined by default.',
        },
        schema: [],
    },
    defaultOptions: [],
    create(context) {
        const services = (0, util_1.getParserServices)(context);
        const checker = services.program.getTypeChecker();
        const compilerOptions = services.program.getCompilerOptions();
        const isNoUncheckedIndexedAccess = tsutils.isCompilerOptionEnabled(compilerOptions, 'noUncheckedIndexedAccess');
        function canBeUndefined(type) {
            if ((0, util_1.isTypeAnyType)(type) || (0, util_1.isTypeUnknownType)(type)) {
                return true;
            }
            return tsutils
                .unionConstituents(type)
                .some(part => (0, util_1.isTypeFlagSet)(part, ts.TypeFlags.Undefined));
        }
        function getPropertyType(objectType, propertyName) {
            const symbol = objectType.getProperty(propertyName);
            if (!symbol) {
                if (isNoUncheckedIndexedAccess) {
                    return null;
                }
                return objectType.getStringIndexType() ?? null;
            }
            return checker.getTypeOfSymbol(symbol);
        }
        function getArrayElementType(arrayType, elementIndex) {
            if (checker.isTupleType(arrayType)) {
                const tupleArgs = checker.getTypeArguments(arrayType);
                if (elementIndex < tupleArgs.length) {
                    return tupleArgs[elementIndex];
                }
            }
            if (isNoUncheckedIndexedAccess) {
                return null;
            }
            return arrayType.getNumberIndexType() ?? null;
        }
        function checkAssignmentPattern(node) {
            if (node.right.type === utils_1.AST_NODE_TYPES.Identifier &&
                node.right.name === 'undefined') {
                const type = node.parent.type === utils_1.AST_NODE_TYPES.Property ||
                    node.parent.type === utils_1.AST_NODE_TYPES.ArrayPattern
                    ? 'property'
                    : 'parameter';
                reportUselessDefault(node, type, 'uselessUndefined');
                return;
            }
            const parent = node.parent;
            if (parent.type === utils_1.AST_NODE_TYPES.ArrowFunctionExpression ||
                parent.type === utils_1.AST_NODE_TYPES.FunctionExpression) {
                const paramIndex = parent.params.indexOf(node);
                if (paramIndex !== -1) {
                    const tsFunc = services.esTreeNodeToTSNodeMap.get(parent);
                    if (ts.isFunctionLike(tsFunc)) {
                        const contextualType = checker.getContextualType(tsFunc);
                        if (!contextualType) {
                            return;
                        }
                        const signatures = contextualType.getCallSignatures();
                        const params = signatures[0].getParameters();
                        if (paramIndex < params.length) {
                            const paramSymbol = params[paramIndex];
                            if ((paramSymbol.flags & ts.SymbolFlags.Optional) === 0) {
                                const paramType = checker.getTypeOfSymbol(paramSymbol);
                                if (!canBeUndefined(paramType)) {
                                    reportUselessDefault(node, 'parameter', 'uselessDefaultAssignment');
                                }
                            }
                        }
                    }
                }
                return;
            }
            if (parent.type === utils_1.AST_NODE_TYPES.Property) {
                const propertyType = getTypeOfProperty(parent);
                if (!propertyType) {
                    return;
                }
                if (!canBeUndefined(propertyType)) {
                    reportUselessDefault(node, 'property', 'uselessDefaultAssignment');
                }
            }
            else if (parent.type === utils_1.AST_NODE_TYPES.ArrayPattern) {
                const sourceType = getSourceTypeForPattern(parent);
                if (!sourceType) {
                    return;
                }
                const elementIndex = parent.elements.indexOf(node);
                const elementType = getArrayElementType(sourceType, elementIndex);
                if (!elementType) {
                    return;
                }
                if (!canBeUndefined(elementType)) {
                    reportUselessDefault(node, 'property', 'uselessDefaultAssignment');
                }
            }
        }
        function getTypeOfProperty(node) {
            const objectPattern = node.parent;
            const sourceType = getSourceTypeForPattern(objectPattern);
            if (!sourceType) {
                return null;
            }
            const propertyName = getPropertyName(node.key);
            if (!propertyName) {
                return null;
            }
            return getPropertyType(sourceType, propertyName);
        }
        function getSourceTypeForPattern(pattern) {
            const parent = (0, util_1.nullThrows)(pattern.parent, util_1.NullThrowsReasons.MissingParent);
            if (parent.type === utils_1.AST_NODE_TYPES.VariableDeclarator && parent.init) {
                const tsNode = services.esTreeNodeToTSNodeMap.get(parent.init);
                return checker.getTypeAtLocation(tsNode);
            }
            if ((0, util_1.isFunction)(parent)) {
                const paramIndex = parent.params.indexOf(pattern);
                const tsFunc = services.esTreeNodeToTSNodeMap.get(parent);
                const signature = (0, util_1.nullThrows)(checker.getSignatureFromDeclaration(tsFunc), util_1.NullThrowsReasons.MissingToken('signature', 'function'));
                const params = signature.getParameters();
                return checker.getTypeOfSymbol(params[paramIndex]);
            }
            if (parent.type === utils_1.AST_NODE_TYPES.AssignmentPattern) {
                return getSourceTypeForPattern(parent);
            }
            if (parent.type === utils_1.AST_NODE_TYPES.Property) {
                return getTypeOfProperty(parent);
            }
            if (parent.type === utils_1.AST_NODE_TYPES.ArrayPattern) {
                const arrayPattern = parent;
                const arrayType = getSourceTypeForPattern(arrayPattern);
                if (!arrayType) {
                    return null;
                }
                const elementIndex = arrayPattern.elements.indexOf(pattern);
                return getArrayElementType(arrayType, elementIndex);
            }
            return null;
        }
        function getPropertyName(key) {
            switch (key.type) {
                case utils_1.AST_NODE_TYPES.Identifier:
                    return key.name;
                case utils_1.AST_NODE_TYPES.Literal:
                    return String(key.value);
                default:
                    return null;
            }
        }
        function reportUselessDefault(node, type, messageId) {
            context.report({
                node: node.right,
                messageId,
                data: { type },
                fix(fixer) {
                    // Remove from before the = to the end of the default value
                    // Find the start position (including whitespace before =)
                    const start = node.left.range[1];
                    const end = node.range[1];
                    return fixer.removeRange([start, end]);
                },
            });
        }
        return {
            AssignmentPattern: checkAssignmentPattern,
        };
    },
});
