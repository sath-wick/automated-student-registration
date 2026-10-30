# Adobe Express Bulk Registration Automation
A Node.js and Playwright browser automation script designed to bulk-register students in Adobe Express, reducing hours of manual data entry to just a few minutes.

## Problem Statement
Registering hundreds of students into Adobe Express for classroom management required repetitive, error-prone manual data entry, taking several hours per academic term.

## The Solution
A data-driven automation framework built with Playwright and Node.js. The script parses a .csv dataset of student credentials, interacts with the Adobe Express web UI, and handles the end-to-end registration flow autonomously.

## Tech Stack

- Playwright (Browser Automation & UI Interaction)
- Node.js (Runtime Environment)
- CSV-Parser (Data Handling)

## Key Features

- Data-Driven Testing Paradigm: Loops through external CSV datasets to handle multiple registrations in a single execution.

- Robust UI Handling: Utilizes explicit waits and dynamic element locators to ensure stable execution even with network latency.