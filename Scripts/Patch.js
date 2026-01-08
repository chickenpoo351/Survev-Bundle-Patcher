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

function findFirstAndSecondImportFileClassDeclarationPatchTarget(ast) {
    let highestScoreForFirstImportPatch = 0;
    let bestMatchForFirstImportPatch = null;
    let bestMatchForFirstImportMethodDefinitionPatch = null;
    let bestMatchForSecondImportMethodDefinitionPatch = null;

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
                let possibleUpdateVisualsTarget = null;
                for (const method of classBodyForImportPatch1.body) {
                    if (method && method.type === 'MethodDefinition' && method.kind === 'constructor' && method.key && method.key.type === 'Identifier' && method.key.name === 'constructor') {
                        possibledirInterpolationTickerTarget = method;
                        break;
                    }
                }
                for (const method of classBodyForImportPatch1.body) {
                    if (method && method.type === 'MethodDefinition' && method.kind === 'method' && method.key && method.key.type === 'Identifier' && method.key.name === 'updateVisuals') {
                        possibleUpdateVisualsTarget = method;
                        break;
                    }
                }
                const methodScoreForImportPatch1 = calculateImportPatch1Score(classBodyForImportPatch1.body, extraImportPatch1Points);
                if (methodScoreForImportPatch1 > highestScoreForFirstImportPatch) {
                    highestScoreForFirstImportPatch = methodScoreForImportPatch1;
                    bestMatchForFirstImportPatch = node;
                    bestMatchForFirstImportMethodDefinitionPatch = possibledirInterpolationTickerTarget;
                    bestMatchForSecondImportMethodDefinitionPatch = possibleUpdateVisualsTarget;
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
        console.log('Best first MethodDefinition match found:', bestMatchForFirstImportMethodDefinitionPatch);
        console.log('Best second MethodDefinition match found:', bestMatchForSecondImportMethodDefinitionPatch);
    } else {
        console.log('No match found.');
    }

    return { bestMatchForFirstImportPatch, minifiedVariableNameForImportPatch1, bestMatchForFirstImportMethodDefinitionPatch, bestMatchForSecondImportMethodDefinitionPatch };

}

function appendNewCodeInsideFunction(methodDefinitionNode, ast, codeToAppend) {
    if (!methodDefinitionNode || methodDefinitionNode.type !== 'MethodDefinition' || !methodDefinitionNode.value || !methodDefinitionNode.value.body) {
        console.log('Invalid MethodDefinition passed in');
        return ast;
    }

    const functionBody = methodDefinitionNode.value.body.body;
    const parsed = acorn.parse(codeToAppend, { ecmaVersion: 2022, sourceType: 'module' });

    functionBody.push(...parsed.body);
    console.log('Code appended inside method successfully');
    return ast;
}

const importPatchTargets = findFirstAndSecondImportFileClassDeclarationPatchTarget(importFileAST);

function applyFirstImportFilePatch(ast, targets, codeToAppend) {
    const { bestMatchForFirstImportMethodDefinitionPatch } = targets;
    if (bestMatchForFirstImportMethodDefinitionPatch) {
        const FirstImportPatchUpdatedAST = appendNewCodeInsideFunction(bestMatchForFirstImportMethodDefinitionPatch, ast, codeToAppend)
        console.log('First import patch successfully applied? Perhaps? Who knows...');
        return FirstImportPatchUpdatedAST;
    } else {
        return ast;
    }
}
// hopefully this ; will correctly apply it to the end of the =0 
// which is at the end of a comma chain so if that isnt added well 
// I have to do quite a bit more work :o
applyFirstImportFilePatch(importFileAST, importPatchTargets, `;/** customskin code inject #1 of 3 */if(this.isLoadoutAvatar){/** Register loadout instance */try{if(!window.CustomSkinAPI_Loadout||!window.CustomSkinAPI_Loadout.container?.parent){window.CustomSkinAPI_Loadout=this;this.valid=true;console.log("[CustomSkinAPI] Registered loadout preview uo:",this.__id)}else console.log("[CustomSkinAPI] Another loadout instance already registered, skipping:",this.__id);/** If no active in-game instance exists, or it's invalid, prefer this loadout */const api=window.CustomSkinAPI;if(!api||!api.valid||!api.container?.parent||!api.active||api.isLoadoutAvatar){Object.defineProperty(window,"CustomSkinAPI",{value:this,writable:false,configurable:true});this.valid=true;console.log("[CustomSkinAPI] Using loadout mannequin as active API:",this.__id)}}catch(err){console.warn("[CustomSkinAPI] Could not register loadout avatar:",err)}}else{/** Safer engine player getter */const getEngineActivePlayer=()=>{try{const pa=window.CustomLocalPlayer,uo=pa?.activePlayer;if(uo&&uo.constructor?.name==="uo"){const valid=uo.active&&uo.container?.parent&&!uo.isLoadoutAvatar;if(valid)return uo}}catch{}return null};/** Mark old API invalid */if(window.CustomSkinAPI&&(!window.CustomSkinAPI.container?.parent||!window.CustomSkinAPI.active||window.CustomSkinAPI.isLoadoutAvatar)){console.log("[CustomSkinAPI] Old reference no longer valid — marking invalid");try{window.CustomSkinAPI.valid=false}catch{}}/** Register safely with smarter fallback */const tryRegister=src=>{try{const engineUo=getEngineActivePlayer();if(engineUo&&engineUo!==this){console.log("[CustomSkinAPI] Engine activePlayer verified; prioritizing engine version (source:",src,")");Object.defineProperty(window,"CustomSkinAPI",{value:engineUo,writable:false,configurable:true});engineUo.valid=true;return true}/** No valid engine player — fallback to this or the loadout one */if(!engineUo&&window.CustomSkinAPI_Loadout&&window.CustomSkinAPI_Loadout.container?.parent){console.log("[CustomSkinAPI] No engine player — reverting to loadout instance:",window.CustomSkinAPI_Loadout.__id);Object.defineProperty(window,"CustomSkinAPI",{value:window.CustomSkinAPI_Loadout,writable:false,configurable:true});window.CustomSkinAPI_Loadout.valid=true;return true}/** Otherwise, register normally */if(typeof this.__id!=="number"||this.__id<=0){console.log("[CustomSkinAPI] Invalid id; delaying registration (id:",this.__id,")");return false}Object.defineProperty(window,"CustomSkinAPI",{value:this,writable:false,configurable:true});this.valid=true;console.log("[CustomSkinAPI] Registered in-game local player uo:",this.__id,"(source:",src,")");/** Force initial visuals refresh so skin applies instantly */setTimeout(()=>{try{const api=window.CustomSkinAPI;if(api&&typeof api.updateVisuals==="function"){api.visualsDirty=true;const game=window.CustomLocalPlayer?.game,playerBarn=game?.playerBarn||null,map=game?.map||null;api.updateVisuals(playerBarn,map);console.log("[CustomSkinAPI] Forced initial visuals refresh")}}catch(err){console.warn("[CustomSkinAPI] Couldn't force visuals refresh:",err)}},150);return true}catch(err){console.error("[CustomSkinAPI] Error in tryRegister:",err);return false}};if(!tryRegister("constructor-immediate"))[0,50,200,1000].forEach((delay,idx)=>setTimeout(()=>tryRegister(\`delayed-retry-\${idx}@\${delay}ms\`),delay));if(!window.__CustomSkinAPIWatcher){window.__CustomSkinAPIWatcher=setInterval(()=>{const api=window.CustomSkinAPI,engineUo=getEngineActivePlayer();/** If the engine’s player is valid and new use it */if(engineUo&&engineUo!==api){console.log("[CustomSkinAPI] Engine player changed; re-registering:",engineUo.__id);try{Object.defineProperty(window,"CustomSkinAPI",{value:engineUo,writable:false,configurable:true});engineUo.valid=true}catch{window.CustomSkinAPI=engineUo;engineUo.valid=true}return}/** If invalid, revert to loadout mannequin */if(!api||!api.valid||!api.container?.parent||!api.active){const loadout=window.CustomSkinAPI_Loadout;if(loadout&&loadout.container?.parent){console.log("[CustomSkinAPI] In-game instance lost; reverting to loadout:",loadout.__id);try{Object.defineProperty(window,"CustomSkinAPI",{value:loadout,writable:false,configurable:true});loadout.valid=true}catch{window.CustomSkinAPI=loadout;loadout.valid=true}return}}},1e3)}}/** end customskin code inject */`)

// import file patch #1 stuff end
// import file patch #2 stuff start
// yup this was surprisingly easy since it piggy-backing off 
// of the other top level parent node
function applySecondImportFilePatch(ast, targets, codeToAppend) {
    const { bestMatchForSecondImportMethodDefinitionPatch } = targets;
    if (bestMatchForSecondImportMethodDefinitionPatch) {
        const SecondImportPatchUpdatedAST = appendNewCodeInsideFunction(bestMatchForSecondImportMethodDefinitionPatch, ast, codeToAppend)
        console.log('Second import patch successfully applied? Perhaps? Who knows...');
        return SecondImportPatchUpdatedAST;
    } else {
        console.log('something went wrong and stuff wasnt patched...')
        return ast;
    }
}

applySecondImportFilePatch(importFileAST, importPatchTargets, `/** customskin code inject #2 of 3 */if(window.CustomSkinAPI&&window.CustomSkinAPI===this/** <== only our player */&&window.CustomSkinAPI.enabled&&window.CustomSkinAPI.currentSkin){const s=window.CustomSkinAPI.currentSkin,c=this,T=window.PIXI?.TextureCache||{},B=window.PIXI?.BaseTextureCache||{},m=(k,src)=>{if(!src)return null;try{if(T[k])return T[k];const b=B[k]||new window.PIXI.BaseTexture(src),t=new window.PIXI.Texture(b);return T[k]=t,B[k]=b,t}catch(e){return console.warn("[CustomSkinAPI] Texture creation failed:",e),null}};try{if(s.base&&c.bodySprite){const t=m("player-base.custom",s.base);t&&(c.bodySprite.texture=t,c.bodySprite.tint=s.tints?.baseTint??16777215)}["handLSprite","handRSprite"].forEach(k=>{if(s.hands&&c[k]){const t=m("player-hands.custom",s.hands);t&&(c[k].texture=t,c[k].tint=s.tints?.handTint??16777215)}}),["footLSprite","footRSprite"].forEach(k=>{if(s.feet&&c[k]){const t=m("player-feet.custom",s.feet);t&&(c[k].texture=t,c[k].tint=s.tints?.footTint??16777215)}}),s.backpack&&c.backpackSprite&&(()=>{const t=m("player-backpack.custom",s.backpack);t&&(c.backpackSprite.texture=t,c.backpackSprite.tint=s.tints?.backpackTint??16777215)})(),void 0}catch(e){console.warn("[CustomSkinAPI] Failed to apply custom visuals:",e)}}/** end customskin code inject */`)
// import file patch #2 stuff end
// import file patch #3 stuff start
function calculateImportPatch3Score(extraPointsForImportPatch3) {
    let Score = 0;

    Score += extraPointsForImportPatch3;

    return Score;
}

function findThirdImportFileClassDeclarationPatchTarget(ast) {
    let highestScoreForThirdImportPatch = 0;
    let bestMatchForThirdImportAssignmentExpression = null;
    let bestMatchForThirdImportAssignmentExpressionVariable = null;
    let bestMatchForThirdImportClassDeclaration = null;
    let bestMatchForThirdImportClassDeclarationVariable = null;

    for (const node of ast.body) {
        let extraPointsForImportPatch3 = 0;
        let currentImportClassDeclarationVariable = null;
        if (node.type === 'ClassDeclaration' && node.id.type === 'Identifier' && node.superClass === null) {
            currentImportClassDeclarationVariable = node.id.name;
            if (node.body.type === 'ClassBody' && node.body.body) {
                const innerBodyForThirdImportPatch = node.body.body;
                for (const MethodDefiniton of innerBodyForThirdImportPatch) {
                    let importantExtraParamPointsForImportPatch3 = 0;
                    if (MethodDefiniton.type === 'MethodDefinition' && MethodDefiniton.key.type === 'Identifier' && MethodDefiniton.key.name === 'constructor') {
                        if (MethodDefiniton.value.type === 'FunctionExpression' && MethodDefiniton.value.id === null) {
                            for (const paramsArray of MethodDefiniton.value.params) {
                                if (paramsArray.type === 'Identifier') {
                                    importantExtraParamPointsForImportPatch3++
                                    if (importantExtraParamPointsForImportPatch3 >= 8 && importantExtraParamPointsForImportPatch3 <= 14) {
                                        extraPointsForImportPatch3 += 3;
                                        if (importantExtraParamPointsForImportPatch3 === 11) {
                                            extraPointsForImportPatch3 += 2;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
                for (const MethodDefinition2 of innerBodyForThirdImportPatch) {
                    let currentAssignmentExpressionVariableName = null;
                    let currentAssignmentExpressionNode = null;
                    if (MethodDefinition2.type === 'MethodDefinition' && MethodDefinition2.key.type === 'Identifier' && MethodDefinition2.key.name === 'init' && MethodDefinition2.kind === 'method' && MethodDefinition2.value) {
                        const currentInitMethodDefinition = MethodDefinition2;
                        if (currentInitMethodDefinition.value.type === 'FunctionExpression' && currentInitMethodDefinition.value.id === null && currentInitMethodDefinition.value.expression === false && currentInitMethodDefinition.value.async === false) {
                            const currentFunctionExpression = currentInitMethodDefinition.value;
                            if (currentFunctionExpression.body.type === 'BlockStatement' && currentFunctionExpression.body.body) {
                                const expressionStatementArray = currentFunctionExpression.body.body;
                                for (const ExpressionStatement of expressionStatementArray) {
                                    if (ExpressionStatement.type === 'ExpressionStatement' && ExpressionStatement.expression.type === 'SequenceExpression' && ExpressionStatement.expression.expressions) {
                                        const expressionsArray = ExpressionStatement.expression.expressions;
                                        for (const assignmentExpression of expressionsArray) {
                                            if (assignmentExpression.type === 'AssignmentExpression' && assignmentExpression.operator === '=') {
                                                currentAssignmentExpressionNode = assignmentExpression;
                                                if (assignmentExpression.left.type === 'MemberExpression' && assignmentExpression.left.property.type === 'Identifier') {
                                                    currentAssignmentExpressionVariableName = assignmentExpression.left.property.name;
                                                }
                                                if (assignmentExpression.right.type === 'NewExpression' && assignmentExpression.right.arguments) {
                                                    // Count member expressions for THIS assignment only (avoid leaking counts across assignments)
                                                    let memberExpressionCountForThisAssignment = 0;
                                                    const memberExpressionArray = assignmentExpression.right.arguments;
                                                    for (const memberExpression of memberExpressionArray) {
                                                        if (memberExpression.type === 'MemberExpression' && memberExpression.property.type === 'Identifier' && memberExpression.object.type === 'ThisExpression') {
                                                            memberExpressionCountForThisAssignment++;
                                                        }
                                                    }
                                                    // Convert count into member-specific points (do NOT mutate outer extraPointsForImportPatch3)
                                                    let memberPoints = 0;
                                                    if (memberExpressionCountForThisAssignment === 5) {
                                                        memberPoints = 3;
                                                    } else if (memberExpressionCountForThisAssignment === 3 || memberExpressionCountForThisAssignment === 4) {
                                                        memberPoints = 2;
                                                    }
                                                    const candidateExtraPoints = extraPointsForImportPatch3 + memberPoints;
                                                    const importPatch3Score = calculateImportPatch3Score(candidateExtraPoints);
                                                    if (importPatch3Score > highestScoreForThirdImportPatch) {
                                                        highestScoreForThirdImportPatch = importPatch3Score;
                                                        bestMatchForThirdImportAssignmentExpression = currentAssignmentExpressionNode;
                                                        bestMatchForThirdImportAssignmentExpressionVariable = currentAssignmentExpressionVariableName;
                                                        bestMatchForThirdImportClassDeclaration = node;
                                                        bestMatchForThirdImportClassDeclarationVariable = currentImportClassDeclarationVariable;
                                                        console.log(`Potential match for import patch #3: ${currentAssignmentExpressionVariableName}, Score: ${importPatch3Score}`)
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    if (bestMatchForThirdImportAssignmentExpression) {
        console.log('Best match found for AssignmentExpression Variable:', bestMatchForThirdImportAssignmentExpressionVariable, 'with a score of', highestScoreForThirdImportPatch);
        console.log('Best match found for AssignmentExpression:', bestMatchForThirdImportAssignmentExpression);
        console.log('Best match found for ClassDeclaration', bestMatchForThirdImportClassDeclaration, 'with a variable name', bestMatchForThirdImportClassDeclarationVariable);
    } else {
        console.log('time to cry :[');
    }

    return { bestMatchForThirdImportAssignmentExpression, bestMatchForThirdImportAssignmentExpressionVariable, bestMatchForThirdImportClassDeclaration, bestMatchForThirdImportClassDeclarationVariable };
}

findThirdImportFileClassDeclarationPatchTarget(importFileAST);
// import file patch #3 stuff end
// import file patch section end

