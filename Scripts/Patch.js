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
let importFilePath, exportFilePath;
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
    importFilePath = file1Path;
} else {
    console.log('File 1 does not seem to contain the big import block so file 2 is probably the import file')
    exportFileCounter();
    exportFileAST = file1AST;
    exportFilePath = file1Path;
}

if (isFile2ImportFile) {
    console.log('File 2 is more than likely the import file so file 1 is probably the export file')
    importFileCounter();
    importFileAST = file2AST;
    importFilePath = file2Path;
} else {
    console.log('File 2 does not seem to contain the big import block so file 1 is probably the import file')
    exportFileCounter();
    exportFileAST = file2AST;
    exportFilePath = file2Path
}

if (thoughtToBeImportFileAmount >= 2 || thoughtToBeExportFileAmount >= 2) {
    console.log('Something went wrong... apparently 2 files either ended up being assigned the import or export file so I guess we gotta call a human :o')
    badFileNotify();
    process.exit(1);
}

function badFileNotify() {
    console.log('eventually this will probably make a pull request notifying me the code failed but for now instead here is pointless log spam :D')
}

const exportFileName = path.basename(exportFilePath, path.extname(exportFilePath));
const importFileName = path.basename(importFilePath, path.extname(importFilePath));

const modifyImportStatement = (ast, exportFileName) => {
    ast.body.forEach(node => {
        if (node.type === 'ImportDeclaration') {
            // Update the value with the new file name
            const newValue = `./${exportFileName}.patched.js`;
            node.source.value = newValue;

            // Update the raw to match the formatted string
            node.source.raw = `"${newValue}"`;
            console.log(`import file name statement changing to: ${newValue}`)
        }
    });
};

modifyImportStatement(importFileAST, exportFileName);

// export file patch section start
// export file patch #1 section start
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

let minifiedVariableNameForPatch1 = null;

function findFirstExportFileVariableDeclarationPatchTarget(ast) {
    let highestScoreForFirstPatch = 0;
    let bestMatchForFirstPatch = null;

    // should hopefully find all of the VariableDeclaration's in the body object of the AST
    for (const node of ast.body) {
        if (node.type === 'VariableDeclaration' && node.kind === 'const') {
            node.declarations.forEach(declaration => {
                if (declaration.id && declaration.id.type === 'Identifier') {
                    const currentVariableNameForPatch1 = declaration.id.name;

                    if (declaration.init && declaration.init.type === 'CallExpression') {
                        const firstArgument = declaration.init.arguments[0];
                        if (firstArgument && firstArgument.type === 'CallExpression') {
                            const nestedArgument = firstArgument.arguments[0];
                            // then once the VariableDeclaration is found check if it contains a ObjectExpression node thingy
                            if (nestedArgument && nestedArgument.type === 'ObjectExpression') {
                                const properties = nestedArgument.properties || [];
                                const keywordMatchScore = calculatePatch1Score(properties);
                                // after verifying the node has the rough structure we check if any of the keywords match then
                                //  whichever matches the most gets assigned to the bestMatchForFirstPatch variable which should hopefully end up being the node we want
                                if (keywordMatchScore > highestScoreForFirstPatch) {
                                    highestScoreForFirstPatch = keywordMatchScore;
                                    bestMatchForFirstPatch = node;
                                    minifiedVariableNameForPatch1 = currentVariableNameForPatch1;
                                }
                                if (highestScoreForFirstPatch / possiblePatch1Keywords.length >= 0.75) {
                                    // should hopefully make it so that if at least 75% of the words match then we can just 
                                    // assume we have the right node and continue with it to hopefully make the search faster 
                                    return { bestMatchForFirstPatch, minifiedVariableNameForPatch1 };
                                }
                            }
                        }
                    }
                }
            })
        }
    }


    // After all nodes are processed, log the variable names collected
    console.log('Collected variable names:', minifiedVariableNameForPatch1);

    // Log the best match details
    if (bestMatchForFirstPatch) {
        console.log('Best match found:', bestMatchForFirstPatch);
        console.log('Variable names of the best match:', minifiedVariableNameForPatch1);
    } else {
        console.log('No match found.');
    }

    return { bestMatchForFirstPatch, minifiedVariableNameForPatch1 };
}

function appendNewCodeAfter(ast, targetNode, codeToAppend) {
    if (!targetNode) {
        console.log('are you sure you have the right node? perhaps the code needs tweaking because it didnt match...')
        return;
    }

    const targetEnd = targetNode.end;
    console.log(`should be appending code at the node that ends here: ${targetEnd}`)
    const newCodeNode = acorn.parse(codeToAppend, { ecmaVersion: 2022, allowReturnOutsideFunction: true, sourceType: 'module' });
    const targetIndex = ast.body.findIndex(node => node === targetNode);

    if (targetIndex !== -1) {
        ast.body.splice(targetIndex + 1, 0, ...newCodeNode.body);
        console.log('Code appended successfully I think :o');
    } else {
        console.log('Target node not found in the AST');
    }

    return ast;
}

function applyFirstExportFilePatch(ast, codeToAppend) {
    const { bestMatchForFirstPatch, minifiedVariableNameForPatch1 } = findFirstExportFileVariableDeclarationPatchTarget(ast);
    const firstPatchUpdatedAST = appendNewCodeAfter(ast, bestMatchForFirstPatch, codeToAppend);
    console.log('First patch successfully applied? Perhaps? Who knows...');
    return firstPatchUpdatedAST;
}

applyFirstExportFilePatch(exportFileAST, `/** customskin patch #1 of 3 start */ window.PIXI = ${minifiedVariableNameForPatch1}; /** customskin patch #1 of 3 end */ `);

// export patch #1 stuff end
// export patch #2 stuff start
// yup more words :o
const possiblePatch2Keywords = ['constructor', 'realWidth', 'realHeight', 'mipmap', 'mipmap', 'scaleMode', 'scaleMode', 'wrapMode', 'wrapMode', 'setStyle', 'setSize', 'setRealSize', '_refreshPOT', 'setResolution', 'setResource', 'update', 'onError', 'destroy', 'dispose', 'castToBaseTexture', 'from', 'fromBuffer', 'addToCache', 'removeFromCache'];

function calculatePatch2Score(methods, extraPatch2Points) {
    let exportPatch2Score = 0;

    methods.forEach(property => {
        if (property.key && property.key.type === 'Identifier' && possiblePatch2Keywords.includes(property.key.name)) {
            exportPatch2Score++;
        }
    });

    exportPatch2Score += extraPatch2Points;

    return exportPatch2Score;
}

let minifiedVariableNameForPatch2 = null;

function findSecondExportFileVariableDeclarationPatchTarget(ast) {
    let highestScoreForSecondPatch = 0;
    let bestMatchForSecondPatch = null;

    for (const node of ast.body) {
        if (node.type === 'VariableDeclaration' && node.kind === 'const') {
            // then search all of the VariableDeclarator's
            for (const declaration of node.declarations) {
                if (declaration.id && declaration.id.type === 'Identifier') {
                    const currentVariableNameForPatch2 = declaration.id.name;
                    if (declaration.init && declaration.init.type === 'ClassExpression') {
                        // reset extra points per declaration (previous code accumulated across declarations)
                        let extraPatch2Points = 0;
                        if (declaration.init.superClass && declaration.init.superClass.type === 'Identifier') {
                            extraPatch2Points += 2;
                        }
                        if (declaration.init.body && declaration.init.body.type === 'ClassBody') {
                            const classBodyForPatch2 = declaration.init.body;
                            // pass extraPatch2Points into the scorer so it doesn't get added as undefined
                            const methodScoreForPatch2 = calculatePatch2Score(classBodyForPatch2.body, extraPatch2Points)
                            if (methodScoreForPatch2 > highestScoreForSecondPatch) {
                                highestScoreForSecondPatch = methodScoreForPatch2;
                                bestMatchForSecondPatch = node;
                                minifiedVariableNameForPatch2 = currentVariableNameForPatch2;
                                console.log(`Potential match for patch #2: ${currentVariableNameForPatch2} (score: ${methodScoreForPatch2})`);
                            }
                            if (highestScoreForSecondPatch / possiblePatch2Keywords.length >= 0.75) {
                                return { bestMatchForSecondPatch, minifiedVariableNameForPatch2 };
                            }
                        }
                    }
                }
            }
        }
    }

    // After all nodes are processed, log the variable names collected
    console.log('Collected variable names:', minifiedVariableNameForPatch2);

    // Log the best match details
    if (bestMatchForSecondPatch) {
        console.log('Best match found:', bestMatchForSecondPatch);
        console.log('Variable names of the best match:', minifiedVariableNameForPatch2);
    } else {
        console.log('No match found.');
    }

    return { bestMatchForSecondPatch, minifiedVariableNameForPatch2 };
}

function applySecondExportFilePatch(ast, codeToAppend) {
    const { bestMatchForSecondPatch, minifiedVariableNameForPatch2 } = findSecondExportFileVariableDeclarationPatchTarget(ast);
    const SecondPatchUpdatedAST = appendNewCodeAfter(ast, bestMatchForSecondPatch, codeToAppend);
    console.log('Second patch successfully applied? Perhaps? Who knows...');
    return SecondPatchUpdatedAST;
}

applySecondExportFilePatch(exportFileAST, `/** customskin patch #2 of 3 */ window.PIXIBaseTexture = ${minifiedVariableNameForPatch2} /** customskin patch #2 of 3 end */`);

// export patch #2 stuff end
// export patch #3 stuff start

// what can I say words are the way I guess
const possiblePatch3Keywords = ['constructor', 'update', 'onBaseTextureUpdated', 'destroy', 'clone', 'updateUvs', 'from', 'fromURL', 'fromBuffer', 'fromLoader', 'addToCache', 'removeFromCache', 'resolution', 'frame', 'frame', 'rotate', 'rotate', 'width', 'height', 'castToBaseTexture', 'EMPTY', 'WHITE'];

function calculatePatch3Score(methods, extraPatch3Points) {
    let exportPatch3Score = 0;

    methods.forEach(property => {
        if (property.key && property.key.type === 'Identifier' && possiblePatch3Keywords.includes(property.key.name)) {
            exportPatch3Score++;
        }
    });

    exportPatch3Score += extraPatch3Points;

    return exportPatch3Score;
}

let minifiedVariableNameForPatch3 = null;

function findThirdExportFileClassDeclarationPatchTarget(ast) {
    let highestScoreForThirdPatch = 0;
    let bestMatchForThirdPatch = null;

    for (const node of ast.body) {
        if (node.type === 'ClassDeclaration') {
            // get the class identifier name properly
            let currentVariableNameForPatch3 = null;
            if (node.id && node.id.type === 'Identifier') {
                currentVariableNameForPatch3 = node.id.name;
            }

            let extraPatch3Points = 0;
            if (node.superClass && node.superClass.type === 'Identifier') {
                extraPatch3Points += 2;
            }
            if (node.body && node.body.type === 'ClassBody') {
                const ClassBodyForPatch3 = node.body;
                const methodScoreForPatch3 = calculatePatch3Score(ClassBodyForPatch3.body, extraPatch3Points);
                if (methodScoreForPatch3 > highestScoreForThirdPatch) {
                    highestScoreForThirdPatch = methodScoreForPatch3;
                    bestMatchForThirdPatch = node;
                    minifiedVariableNameForPatch3 = currentVariableNameForPatch3;
                    console.log(`Potential match for patch #3: ${currentVariableNameForPatch3} (score: ${methodScoreForPatch3})`);
                }
                if (highestScoreForThirdPatch / possiblePatch3Keywords.length >= 0.75) {
                    return { bestMatchForThirdPatch, minifiedVariableNameForPatch3 };
                }
            }
        }
    }

    // After all nodes are processed, log the variable names collected
    console.log('Collected variable names:', minifiedVariableNameForPatch3);

    // Log the best match details
    if (bestMatchForThirdPatch) {
        console.log('Best match found:', bestMatchForThirdPatch);
        console.log('Variable names of the best match:', minifiedVariableNameForPatch3);
    } else {
        console.log('No match found.');
    }

    return { bestMatchForThirdPatch, minifiedVariableNameForPatch3 };

}

function applyThirdExportFilePatch(ast, codeToAppend) {
    const { bestMatchForThirdPatch, minifiedVariableNameForPatch3 } = findThirdExportFileClassDeclarationPatchTarget(ast);
    const ThirdPatchUpdatedAST = appendNewCodeAfter(ast, bestMatchForThirdPatch, codeToAppend);
    console.log('Third patch successfully applied? Perhaps? Who knows...');
    return ThirdPatchUpdatedAST;
}

applyThirdExportFilePatch(exportFileAST, `/** customskin patch #3 of 3 start */ window.PIXITexture = ${minifiedVariableNameForPatch3} /** customskin patch #3 of 3 end */`)
// finally all patches for the export file done :D 
// now just the import file and then turning both 
// of the AST's back into a minified JavaScript file...
// export patch #3 stuff end

// export file patch section end
// import file patch section start
// import file patch #1 stuff start
// this got so messy I dont want to talk about it...


// sometimes I wonder why I write this code... 
// in the end its for some random browser game and 
// I probably just gave more ideas to cheat creaters 
// as to how to essentially automate bypassing the 
// obfuscation of the source code... 
// but oh well at least I can play with custom skins while 
// doing minimal coding in the future I guess :I

// (now that I think of it though... if a cheat creater really did try using this idea its semi useless 
// unless your crazy enough to read obfuscated for a month looking for something simple...)
const possibleImportPatch1Keywords = ['__id', '__type', 'active', 'bodySprite', 'chestSprite', 'flakSprite', 'steelskinSprite', 'helmetSprite', 'visorSprite', 'backpackSprite', 'handLSprite', 'handRSprite', 'footLSprite', 'footRSprite', 'hipSprite', 'gunLSprites', 'gunRSprites', 'objectLSprite', 'objectRSprite', 'meleeSprite', 'bodySubmergeSprite', 'handLSubmergeSprite', 'handRSubmergeSprite', 'footLSubmergeSprite', 'footRSubmergeSprite', 'bodyEffectSprite', 'patchSprite', 'handLContainer', 'handRContainer', 'footLContainer', 'footRContainer', 'bodyContainer', 'container', 'nameText', 'auraContainer', 'auraCircle', 'bones', 'anim', 'perks', 'perkTypes', 'perksDirty', 'surface', 'wasInWater', 'weapTypeOld', 'visualsDirty', 'stepDistance', 'zoomFast', 'playedDryFire', 'lastSwapIdx', 'hasteSeq', 'cycleSoundInstance', 'actionSoundInstance', 'useItemEmitter', 'hasteEmitter', 'passiveHealEmitter', 'downed', 'wasDowned', 'bleedTicker', 'submersion', 'gunRecoilL', 'gunRecoilR', 'fireDelay', 'throwableState', 'lastThrowablePickupSfxTicker', 'isNearDoorError', 'doorErrorTicker', 'noCielingRevealTicker', 'frozenTicker', 'updatedFrozenImage', 'viewAabb', 'auraViewFade', 'auraPulseTicker', 'auraPulseDir', 'renderLayer', 'renderZOrd', 'renderZIdx', 'throwableStatePrev', 'posInterpTicker', 'dirInterpolationTicker', 'layer', 'isLoadoutAvatar', 'playActionStartSfx', 'isNew', 'wasInsideObstacle', 'insideObstacleType', 'lastInsideObstacleTime', 'dead', 'gunSwitchCooldown', 'constructor', 'getMeleeCollider', 'canInteract', 'render', 'updateRenderLayer', 'updateVisuals', 'updateAura', 'updateRotation', 'playActionStartEffect', 'updateActionEffect', 'playItemPickupSound', 'selectIdlePose', 'selectAnim', 'currentAnim', 'playAnim', 'updateAnim', 'animPlaySound', 'animSetThrowableState', 'animThrowableParticles', 'animMeleeCollision', 'initSubmergeSprites', 'updateSubmersion', 'updateFrozenState', 'addRecoil', 'isUnderground', 'cancelBind', 'refresh'];

function calculateImportPatch1Score(methods, extraImportPatch1Points) {
    let importPatch1Score = 0;

    methods.forEach(property => {
        if (property.key && property.key.type === 'Identifier' && possibleImportPatch1Keywords.includes(property.key.name)) {
            importPatch1Score++;
        }
    });

    importPatch1Score += extraImportPatch1Points;

    return importPatch1Score;
}

let minifiedVariableNameForImportPatch1 = null;

function findFirstImportFileClassDeclarationPatchTarget(ast) {
    let highestScoreForFirstImportPatch = 0;
    let bestMatchForFirstImportPatch = null;
    let bestMatchForFirstImportMethodDefinitionPatch = null;

    for (const node of ast.body) {
        if (node.type === 'ClassDeclaration') {
            let currentVariableNameForImportPatch1 = null;
            let extraImportPatch1Points = 0;
            // If the class does not extend another class (superClass === null) award 2 points
            if (node.superClass === null) {
                extraImportPatch1Points += 2;
            }
            if (node.id && node.id.type === 'Identifier') {
                currentVariableNameForImportPatch1 = node.id.name;
            }
            if (node.body && node.body.type === 'ClassBody') {
                const classBodyForImportPatch1 = node.body;
                let possibledirInterpolationTickerTarget = null;
                // Look for the first MethodDefinition and if it's a constructor give extra points (before scoring)
                for (const method of classBodyForImportPatch1.body) {
                    if (method && method.type === 'MethodDefinition' && method.kind === 'constructor' && method.key && method.key.type === 'Identifier' && method.key.name === 'constructor') {
                        possibledirInterpolationTickerTarget = method;
                        break;
                    }
                }
                const methodScoreForImportPatch1 = calculateImportPatch1Score(classBodyForImportPatch1.body, extraImportPatch1Points);
                if (methodScoreForImportPatch1 > highestScoreForFirstImportPatch) {
                    highestScoreForFirstImportPatch = methodScoreForImportPatch1;
                    bestMatchForFirstImportPatch = node;
                    bestMatchForFirstImportMethodDefinitionPatch = possibledirInterpolationTickerTarget;
                    minifiedVariableNameForImportPatch1 = currentVariableNameForImportPatch1;
                    console.log(`Potential match for import patch #1: ${currentVariableNameForImportPatch1} (score: ${methodScoreForImportPatch1})`);
                }
            }
        }
    }

    // After all nodes are processed, log the variable names collected
    console.log('Collected variable names:', minifiedVariableNameForImportPatch1);

    // Log the best match details
    if (bestMatchForFirstImportPatch) {
        console.log('Best parent node match found:', bestMatchForFirstImportPatch);
        console.log('Variable names of the best match:', minifiedVariableNameForImportPatch1);
        console.log('Best MethodDefinition match found:', bestMatchForFirstImportMethodDefinitionPatch);
    } else {
        console.log('No match found.');
    }

    return { bestMatchForFirstImportPatch, minifiedVariableNameForImportPatch1, bestMatchForFirstImportMethodDefinitionPatch };

}

function appendNewCodeInsideFunction(methodDefinitionNode, codeToAppend) {
    if (!methodDefinitionNode || methodDefinitionNode.type !== 'MethodDefinition' || !methodDefinitionNode.value || !methodDefinitionNode.value.body) {
        console.log('Invalid MethodDefinition passed in');
        return;
    }

    const functionBody = methodDefinitionNode.value.body.body;
    const parsed = acorn.parse(codeToAppend, { ecmaVersion: 2022, sourceType: 'module' });

    functionBody.push(...parsed.body);
    console.log('Code appended inside method successfully');
}

function applyFirstImportFilePatch(ast, codeToAppend) {
    const { bestMatchForFirstImportMethodDefinitionPatch } = findFirstImportFileClassDeclarationPatchTarget(ast);
    const FirstImportPatchUpdatedAST = appendNewCodeInsideFunction(bestMatchForFirstImportMethodDefinitionPatch, codeToAppend)
    console.log('First import patch successfully applied? Perhaps? Who knows...');
    return FirstImportPatchUpdatedAST;
}

applyFirstImportFilePatch(importFileAST, ``)

// import file patch #1 stuff end

// import file patch section end

