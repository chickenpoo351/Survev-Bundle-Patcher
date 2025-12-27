import puppeteer from 'puppeteer';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

// Function to scrape javascript files
async function scrapeJSFiles(baseURL) {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto(baseURL);

    const jsFiles = await page.$$eval('script[src], link[href]', (elements) => {
        return elements
            .map((element) => {
                const src = element.src || element.href;
                return src && src.includes('/js/') ? src : null;
            })
            .filter((src) => src !== null);
    });

    await browser.close();
    return jsFiles;
}

// Function to move old files to a backup folder upon updates
async function moveFilesToBackup(folderPath, filesToMove) {
    const backupFolderPath = path.join(folderPath, '../Old-Runtime-Bundles');

    // Create backup folder if it doesn't exist (which shouldnt ever happen but hey redundency is best ;D)
    if (!fs.existsSync(backupFolderPath)) {
        fs.mkdirSync(backupFolderPath);
    }

    // Move only the files to be backed up
    for (const file of filesToMove) {
        const currentFilePath = path.join(folderPath, file);
        const backupFilePath = path.join(backupFolderPath, file);

        try {
            fs.renameSync(currentFilePath, backupFilePath); // Move the file to the backup folder
            console.log(`Moved file: ${file} to backup folder.`);
        } catch (err) {
            console.error(`Error moving file ${file}:`, err);
        }
    }
}

// Function to download js files
async function downloadFile(url, filename, folderPath, currentRuntimeBundleNames) {
    if (url.includes('gpt.js') || url.includes('pubads_impl.js')) {
        console.log(`Skipping unwanted file: ${filename}`);
        return;
    }

    // Check if the file is already downloaded
    if (currentRuntimeBundleNames.includes(filename)) {
        console.log(`File: ${filename} is already downloaded :o`);
        return;
    }

    // Download the new file
    try {
        const response = await fetch(url);
        const buffer = await response.buffer();
        fs.writeFileSync(path.join(folderPath, filename), buffer);
        console.log(`${filename} has been downloaded!`);
    } catch (error) {
        console.error(`Error downloading ${filename}:`, error);
    }
}

async function main() {
    const url = 'https://survev.io'; // Base URL for the site
    const folderPath = '../Current-Runtime-Bundle';  // Folder where the files are downloaded

    // Create folder if it doesn't exist
    if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath);
    }

    const initialFiles = new Set(fs.readdirSync(folderPath)); // Track current files in the folder

    // Scrape JS files
    const jsFiles = await scrapeJSFiles(url);
    const filesToDownload = [];

    // Loop through all the scraped files and check if they are already downloaded
    for (const jsFile of jsFiles) {
        const filename = path.basename(jsFile);
        console.log(`Found file: ${filename}`);

        // If the file is not downloaded yet add to download list
        if (!initialFiles.has(filename)) {
            filesToDownload.push(jsFile);
        } else {
            console.log(`File ${filename} already exists. Skipping download.`);
        }
    }

    // Now download the new files
    for (const file of filesToDownload) {
        const filename = path.basename(file);
        await downloadFile(file, filename, folderPath, Array.from(initialFiles));  // Passing the current state of the files
    }

    // after downloading the new files, compare the initial files to the new ones
    const currentFiles = new Set(fs.readdirSync(folderPath));

    // if there are new files move the old files
    if (currentFiles.size > initialFiles.size) {
        const filesToMove = [...currentFiles].filter(file => !initialFiles.has(file)); // Get the old files that should be backed up
        if (filesToMove.length > 0) {
            console.log('New files detected, moving old files to backup folder.');
            await moveFilesToBackup(folderPath, [...initialFiles]); // Move old files
        }
    } else {
        console.log('No new files detected, skipping backup.');
    }
}

main();
