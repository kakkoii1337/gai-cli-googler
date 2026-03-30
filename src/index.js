#!/usr/bin/env node
/**
 * gai-cli-googler - CLI tool for scraping Google search results
 *
 * Usage: googler <search-string> [--result-count=10] [--headless=false]
 */

import * as cheerio from "cheerio";
import patchright from "patchright";

const DEFAULT_NUM_RESULTS = 10;
const DEFAULT_TIMEOUT = 60000;

function parseArgs() {
    const args = process.argv.slice(2);
    const options = {
        resultCount: DEFAULT_NUM_RESULTS,
        headless: false,
        query: "",
    };

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg.startsWith("--result-count=")) {
            options.resultCount = parseInt(arg.split("=")[1], 10);
        } else if (arg.startsWith("--headless=")) {
            options.headless = arg.split("=")[1] === "true";
        } else if (arg === "--help" || arg === "-h") {
            printHelp();
            process.exit(0);
        } else if (!arg.startsWith("--")) {
            options.query = arg;
        }
    }

    if (!options.query) {
        console.error("Error: Search query is required");
        printHelp();
        process.exit(1);
    }

    return options;
}

function printHelp() {
    console.log(`
googler - CLI tool for scraping Google search results

Usage: googler <search-string> [options]

Arguments:
  search-string        The search query

Options:
  --result-count=N    Number of results to return (default: 10)
  --headless=false    Use headless mode (default: false, non-headless is more reliable)
  --help, -h          Show this help message

Examples:
  googler "current singapore time"
  googler "current singapore time" --result-count=5
  googler "current singapore time" --headless=true
`);
}

async function scrapeGoogle(url, headless = true, timeout = DEFAULT_TIMEOUT) {
    const browser = await patchright.chromium.launch({
        headless,
        args: ["--no-sandbox", "--disable-dev-shm-usage"],
    });

    try {
        const context = await browser.newContext();
        const page = await context.newPage();

        await page.route("**/*", async (route) => {
            const resourceType = route.request().resourceType();
            if (["image", "stylesheet", "font"].includes(resourceType)) {
                await route.abort();
            } else {
                await route.continue();
            }
        });

        await page.goto(url, { waitUntil: "domcontentloaded", timeout });
        await page.waitForTimeout(3000);

        const html = await page.content();

        await context.close();
        await browser.close();

        return html;
    } catch (error) {
        await browser.close();
        throw error;
    }
}

async function scrapeProgressive(url, timeout = DEFAULT_TIMEOUT) {
    console.error("Attempting HTTP request first...");

    try {
        const response = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            },
        });

        if (response.ok) {
            const html = await response.text();
            const links = parseLinks(html, 10);

            if (Object.keys(links).length > 0) {
                console.error("HTTP request succeeded");
                return html;
            }
        }
        console.error("HTTP request returned no links, falling back to headless");
    } catch (e) {
        console.error(`HTTP request failed: ${e.message}`);
    }

    console.error("Attempting headless patchright...");
    try {
        const html = await scrapeGoogle(url, true, timeout);
        const links = parseLinks(html, 10);

        if (Object.keys(links).length > 0) {
            console.error("Headless patchright succeeded");
            return html;
        }
        console.error("Headless returned no links, falling back to non-headless");
    } catch (e) {
        console.error(`Headless failed: ${e.message}`);
    }

    console.error("Attempting non-headless patchright...");
    try {
        const html = await scrapeGoogle(url, false, timeout);
        const links = parseLinks(html, 10);

        if (Object.keys(links).length > 0) {
            console.error("Non-headless patchright succeeded");
            return html;
        }
        console.error("Non-headless returned no links");
    } catch (e) {
        console.error(`Non-headless failed: ${e.message}`);
    }

    return null;
}

function parseLinks(rawHtml, linkLimit = 10) {
    const $ = cheerio.load(rawHtml);
    const parsedLinks = {};

    const links = $('a[jsname="UWckNb"]');

    const cleanString = (text) => {
        if (!text) return null;
        text = text.trim();
        text = text.replace(/\xa0/g, " ");
        text = text.replace(/\s+/g, " ");
        return text || null;
    };

    links.each((i, el) => {
        const href = $(el).attr("href");
        if (!href) return;

        if (href.includes("youtube.com")) return;

        const titleTag = $(el).find("h3");
        const title = titleTag.length > 0 ? cleanString(titleTag.text()) : null;

        if (title) {
            parsedLinks[href] = title;
        }
    });

    const linkKeys = Object.keys(parsedLinks);
    if (linkLimit > 0 && linkKeys.length > linkLimit) {
        return linkKeys.slice(0, linkLimit).reduce((acc, key) => {
            acc[key] = parsedLinks[key];
            return acc;
        }, {});
    }

    return parsedLinks;
}

async function main() {
    const options = parseArgs();
    const url = `https://www.google.com/search?q=${encodeURIComponent(options.query)}`;

    let html;
    if (options.headless) {
        html = await scrapeProgressive(url);
    } else {
        html = await scrapeGoogle(url, false);
    }

    if (!html) {
        console.error("Error: Failed to scrape Google search results");
        process.exit(1);
    }

    const parsedLinks = parseLinks(html, options.resultCount);
    const results = Object.keys(parsedLinks).map((link, index) => ({
        rank: index + 1,
        title: parsedLinks[link],
        url: link,
    }));

    console.log(`\nSearch results for: "${options.query}"\n`);
    console.log(`Found ${results.length} results:\n`);

    for (const result of results) {
        console.log(`${result.rank}. ${result.title}`);
        console.log(`   ${result.url}\n`);
    }
}

main().catch((error) => {
    console.error("Error:", error.message);
    process.exit(1);
});