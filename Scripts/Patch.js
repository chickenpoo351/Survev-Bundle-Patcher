import * as acorn from 'acorn';
import fs from 'fs';
import path from 'path';


const importantFiles = fs.readdirSync('../Current-Runtime-Bundle');
const file1Path = path.join('../Current-Runtime-Bundle', importantFiles[0]);
// yes technically this could go wrong if in the future there are more than two 
// files but im just gonna ignore that...
const file2Path = path.join('../Current-Runtime-Bundle', importantFiles[1]);
const file1 = fs.readFileSync(file1Path).toString();
const file2 = fs.readFileSync(file2Path).toString();

const file1AST = acorn.parse(file1, { ecmaVersion: 2022, allowReturnOutsideFunction: true, sourceType: 'module' });
const file2AST = acorn.parse(file2, { ecmaVersion: 2022, allowReturnOutsideFunction: true, sourceType: 'module' });

const fileHasBigImport = (ast) => {
    return ast.body.some(node =>
        node.type === 'ImportDeclaration' && node.specifiers.length > 20 //hopefully shouldnt backfire and also should correctly make sure we are patching the right file...
    )
}

const isFile1ImportFile = fileHasBigImport(file1AST);
const isFile2ImportFile = fileHasBigImport(file2AST);

let importFileAST, exportFileAST;
let thoughtToBeImportFileAmount = 0
let thoughtToBeExportFileAmount = 0

function importFileCounter() {
    thoughtToBeImportFileAmount++;
}

function exportFileCounter() {
    thoughtToBeExportFileAmount++;
}

if (isFile1ImportFile) {
    console.log('File 1 is more than likely the import file so file 2 is probably the export file')
    importFileCounter();
    importFileAST = file1AST;
} else {
    console.log('File 1 does not seem to contain the big import block so file 2 is probably the import file')
    exportFileCounter();
    exportFileAST = file1AST;
}

if (isFile2ImportFile) {
    console.log('File 2 is more than likely the import file so file 1 is probably the export file')
    importFileCounter();
    importFileAST = file2AST;
} else {
    console.log('File 2 does not seem to contain the big import block so file 1 is probably the import file')
    exportFileCounter();
    exportFileAST = file2AST;
}

if (thoughtToBeImportFileAmount >= 2 || thoughtToBeExportFileAmount >= 2) {
    console.log('Something went wrong... apparently 2 files either ended up being assigned the import or export file so I guess we gotta call a human :o')
    badFileNotify();
    process.exit(1);
}

function badFileNotify() {
    console.log('eventually this will probably make a pull request notifying me the code failed but for now instead here is pointless log spam :D')
}
42
// export file patch section start
// I know its a lot of words but I guess this is the stuff that must be done when working with minified code... :[
const possiblePatch1Keywords = ['__proto__', 'BaseTextureCache', 'BoundingBox', 'CanvasRenderTarget', 'DATA_URI', 'EventEmitter', 'ProgramCache', 'TextureCache', 'clearTextureCache', 'correctBlendMode', 'createIndicesForQuads', 'decomposeDataURI', 'deprecation', 'destroyTextureCache', 'detectVideoAlphaMode', 'determineCrossOrigin', 'earcut', 'getBufferType', 'getCanvasBoundingBox', 'getResolutionOfUrl', 'hex2rgb', 'hex2string', 'interleaveTypedArrays', 'isMobile', 'isPow2', 'isWebGLSupported', 'log2', 'nextPow2', 'path', 'premultiplyBlendMode', 'premultiplyRgba', 'premultiplyTint', 'premultiplyTintToRgba', 'removeItems', 'rgb2hex', 'sayHello', 'sign', 'skipHello', 'string2Hex', 'trimCanvas', 'uid', 'url'];

function calculatePatch1Score(properties) {
    let exportPatch1Score = 0;

    properties.forEach(property => {
        if (property.key && property.key.type === 'Identifier' && possiblePatch1Keywords.includes(property.key.name)) {
            exportPatch1Score++;
        }
    });

    return exportPatch1Score;
}

function findFirstExportFileVariableDeclarationPatchTarget(ast) {
    let highestScore = 0;
    let bestMatch = null;
    let minifiedVariableName = null;

    // should hopefully find all of the VariableDeclaration's in the body object of the AST
    ast.body.forEach(node => {
        if (node.type === 'VariableDeclaration' && node.kind === 'const') {
            node.declarations.forEach(declaration => {
                if (declaration.id && declaration.id.type === 'Identifier') {
                    minifiedVariableName = declaration.id.name;
                }
                if (declaration.init && declaration.init.type === 'CallExpression') {
                    const firstArgument = declaration.init.arguments[0];
                    if (firstArgument && firstArgument.type === 'CallExpression') {
                        const nestedArgument = firstArgument.arguments[0];
                        // then once the VariableDeclaration is found check if it contains a ObjectExpression node thingy
                        if (nestedArgument && nestedArgument.type === 'ObjectExpression') {
                            const properties = nestedArgument.properties || [];
                            const keywordMatchScore = calculatePatch1Score(properties);
                            // after verifying the node has the rough structure we check if any of the keywords match then
                            //  whichever matches the most gets assigned to the bestMatch variable which should hopefully end up being the node we want
                            if (keywordMatchScore > highestScore) {
                                highestScore = keywordMatchScore;
                                bestMatch = node;
                            }
                            if (highestScore / possiblePatch1Keywords.length >= 0.75) {
                                // should hopefully make it so that if at least 75% of the words match then we can just 
                                // assume we have the right node and continue with it to hopefully make the search faster 
                                return bestMatch;
                            }
                        }
                    }
                }
            })
        }
    })


    if (bestMatch) {
        console.log('Best match found:', bestMatch);
        console.log('Variable name of the best match:', minifiedVariableName);
    } else {
        console.log('No match found.');
    }

    return bestMatch;
}

function appendNewCodeAfter(ast, targetNode, codeToAppend) {
    if (!targetNode) {
        console.log('are you sure you have the right node? perhaps the code needs tweaking because it didnt match...')
        return;
    }

    const targetEnd = targetNode.end;
    console.log('should be appending code at the end of the node')
    return ast;
}

function applyFirstExportFilePatch(ast, codeToAppend) {
    const bestMatchNode = findFirstExportFileVariableDeclarationPatchTarget(ast);
    const firstPatchUpdatedAST = appendNewCodeAfter(ast, bestMatchNode, codeToAppend);
    console.log('First patch succesfully applied? perhaps? who knows...')
    return firstPatchUpdatedAST;
}

applyFirstExportFilePatch(exportFileAST, 'will add stuff here later')
// export file patch section end

