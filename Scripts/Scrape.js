import puppeteer from 'puppeteer';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

// Scrapes the website for JS files
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

// Moves outdated files to a backup folder
async function moveFilesToBackup(folderPath, filesToMove) {
    const backupFolderPath = path.join(folderPath, '../Old-Runtime-Bundles');

    // Create backup folder if it doesn't exist
    if (!fs.existsSync(backupFolderPath)) {
        fs.mkdirSync(backupFolderPath);
    }

    // Move each file to backup folder
    for (const file of filesToMove) {
        const currentFilePath = path.join(folderPath, file);
        const backupFilePath = path.join(backupFolderPath, file);

        try {
            fs.renameSync(currentFilePath, backupFilePath); // Move file to backup folder
            console.log(`Moved file: ${file} to backup folder.`);
        } catch (err) {
            console.error(`Error moving file ${file}:`, err);
        }
    }
}

// Downloads new JS files to the folder
async function downloadFile(url, filename, folderPath) {
    // Skip specific unwanted files
    if (url.includes('gpt.js') || url.includes('pubads_impl.js')) {
        console.log(`Skipping unwanted file: ${filename}`);
        return false;
    }

    const filePath = path.join(folderPath, filename);

    // Download the file and save it locally
    try {
        const response = await fetch(url);
        const buffer = await response.buffer();
        fs.writeFileSync(filePath, buffer); // Save the downloaded file to disk
        console.log(`${filename} has been downloaded to: ${filePath}`);
        return true;
    } catch (error) {
        console.error(`Error downloading ${filename}:`, error);
        return false;
    }
}

async function main() {
    const url = 'https://survev.io'; // Base URL of the website to scrape
    const folderPath = '../Current-Runtime-Bundle';  // Folder where files are stored

    // Create the folder if it doesn't exist
    if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath);
    }

    const initialFiles = new Set(fs.readdirSync(folderPath)); // Current files in the folder

    // Scrape the JS files from the website
    const jsFiles = await scrapeJSFiles(url);
    const filesToDownload = [];

    // Add all the found JS files to the download list
    for (const jsFile of jsFiles) {
        const filename = path.basename(jsFile);
        console.log(`Found file: ${filename}`);
        filesToDownload.push(jsFile);
    }

    // Determine which current files are outdated or missing
    const filesToMove = [];

    // Check each current file and compare it with the new files
    for (const currentFile of initialFiles) {
        const matchedFile = filesToDownload.find((newFile) => path.basename(newFile) === currentFile);
        
        // If a file is not found in the new list, mark it for backup
        if (!matchedFile) {
            filesToMove.push(currentFile);
        }
    }

    let filesMoved = false; // Flag to check if any files were moved
    let filesDownloaded = false; // Flag to track if any files were actually downloaded

    // Now, handle moving and downloading files
    if (filesToMove.length > 0 || filesToDownload.length > 0) {

        // Move old files to backup
        if (filesToMove.length > 0) {
            console.log('Moving old files to backup folder...');
            await moveFilesToBackup(folderPath, filesToMove);
            filesMoved = true;
        }

        // Download any new files that aren't already present
        for (const file of filesToDownload) {
            const filename = path.basename(file);
            const currentFilePath = path.join(folderPath, filename);

            // Skip if the file already exists and hasn't changed
            if (fs.existsSync(currentFilePath)) {
                console.log(`File ${filename} already exists, skipping download.`);
            } else {
                const wasDownloaded = await downloadFile(file, filename, folderPath);
                if (wasDownloaded) {
                    filesDownloaded = true;
                }
            }
        }
    } else {
        // If no changes detected, say everything is up to date
        console.log('No changes detected. All files are up to date.');
    }

    // Print messages based on whether files were moved or downloaded
    if (!filesMoved && !filesDownloaded) {
        console.log('No files were moved or downloaded, all files are up to date.');
    } else if (filesMoved && !filesDownloaded) {
        console.log('Old files have been moved to the backup folder, no new downloads.');
    } else if (filesDownloaded) {
        console.log('New files have been downloaded.');
    }

    console.log('Finished processing changes.');
}

// Start the script
main();
