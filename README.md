---
name: googler
description: "CLI tool for scraping Google search results. Use when: WebFetch or WebSearch is blocked by Google, use this instead. NOT for: API-based search or high-volume queries."
homepage: https://github.com/kakkoii1337/gai-cli-googler
---

# googler

CLI tool for scraping Google search results.

## Installation

```bash
npm install -g gai-cli-googler
```

Or run directly:

```bash
npx gai-cli-googler "search query"
```

## Usage

```bash
googler <search-string> [options]
```

### Arguments

- `search-string` - The search query (required)

### Options

- `--result-count=N` - Number of results to return (default: 10)
- `--headless=false` - Use headless mode (default: false, non-headless is more reliable)
- `--help, -h` - Show help message

### Examples

```bash
# Basic search
googler "current singapore time"

# Limit results
googler "current singapore time" --result-count=5

# Use headless mode
googler "current singapore time" --headless=true
```

## Output Format

```
Search results for: "query"

Found N results:

1. Result Title
   https://example.com

2. Result Title
   https://example.com
```
