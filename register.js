const { chromium } = require('playwright');
const fs = require('fs');

// Generate a log file
const logFileName = `registration_status.txt`;

function logStatus(name, status) {
    const logMessage = `${name} - ${status}`;
    fs.appendFileSync(logFileName, logMessage + '\n');
    console.log(`  -> ${logMessage}`);
}

async function runAutomation() {
    console.log("Loading CSV data...");
    const csvData = fs.readFileSync('student_data.csv', 'utf-8');

    const rows = csvData.split('\n').map(line => line.trim()).filter(line => line !== '');
    const students = rows.slice(1).map(row => {
        const [name, studentClass, email, password, code] = row.split(',');
        return { name, class: studentClass, email, password, code };
    });

    // Initialize the log file for this run
    fs.appendFileSync(logFileName, `--- New Run: ${new Date().toISOString()} ---\n`);

    const browser = await chromium.launch({ headless: false });

    for (const student of students) {
        if (!student.email) continue;
        console.log(`\nProcessing: ${student.email}`);

        const context = await browser.newContext();
        const page = await context.newPage();

        try {
            await page.goto('https://new.express.adobe.com/');

            // 1. Enter initial email (Standard clicks for login flow)
            await page.locator('id=EmailPage-EmailField').click();
            await page.locator('id=EmailPage-EmailField').fill(student.email);
            await page.locator('id=react-aria-11').click();
            console.log("-> Filled email field")

            // 2. Handle conditional secondary email or direct password field
            await page.waitForSelector('#i0116, #i0118', { state: 'visible', timeout: 20000 });

            if (await page.locator('#i0116').isVisible()) {
                await page.locator('#i0116').fill(student.email);
                console.log("-> Filled email field again")
                await page.locator('id=idSIButton9').click();
            }


            // 3. Enter password
            await page.waitForSelector('#i0118', { state: 'visible', timeout: 10000 });
            await page.locator('#i0118').fill(student.password);
            await page.locator('id=idSIButton9').click();
            console.log("-> Filled password")

            // Steps 7, 8, 9: Conditional KMSI (Keep Me Signed In) prompt (Forced clicks)
            try {
                const btnBack = page.locator('#idBtn_Back, input[value="No"]');
                await btnBack.waitFor({ state: 'visible', timeout: 6000 });
                await btnBack.click({ force: true });
                console.log("-> KMSI Bypassed")
            } catch (error) {
                console.log("  -> KMSI prompt skipped or not found.");
            }

            // Step 10: Wait for login & conditional customize dialog
            // Target the action button directly rather than the modal wrapper
            const ctaBtn = page.getByTestId('x-dialog-primary-cta').first();

            // Step 10: Wait for login & conditional customize dialog
            try {
                const ctaBtn = page.getByTestId('x-dialog-primary-cta').first();

                // 1. Wait for the button to be attached to DOM
                await ctaBtn.waitFor({ state: 'attached', timeout: 100000 });

                // 2. Force the browser itself to measure the element's physical screen coordinates.
                const box = await ctaBtn.evaluate(node => {
                    const rect = node.getBoundingClientRect();
                    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
                });

                if (box && box.width > 0 && box.height > 0) {
                    const centerX = box.x + (box.width / 2);
                    const centerY = box.y + (box.height / 2);

                    // 3. Move virtual mouse and perform the first hardware-level click
                    await page.mouse.move(centerX, centerY);
                    await page.mouse.down();
                    await page.mouse.up();
                    console.log("  -> Customization modal button clicked.");

                    // 4. Wait 2 seconds for the language selection modal to pop up
                    await page.waitForTimeout(2000);

                    // 5. Fire a second click in the exact same location to dismiss the new modal
                    await page.mouse.down();
                    await page.mouse.up();
                    console.log("  -> Second click executed to dismiss language modal.");

                } else {
                    console.log("  -> Button exists in DOM, but browser reports its size as 0x0.");
                }
            } catch (error) {
                console.log("  -> Customize modal did not attach to the DOM. Moving on.");
            }

            // Step 11: Navigate to Classrooms
            const classroomBtn = page.getByTestId('sidebar-button-@hz/project-x:classrooms');
            await classroomBtn.waitFor({ state: 'visible', timeout: 30000 });
            await classroomBtn.click();
            console.log("-> Navigated to Classrooms")

            // Step 12: Wait for page load and check registration status
            await page.waitForTimeout(3000);
            const joinPrompt = page.getByText('Students, ask your educator for a class code to join.');

            if (!(await joinPrompt.isVisible())) {
                logStatus(student.name, 'already registered');
                continue;
            }

            await page.locator('sp-button', { hasText: 'Enter a class code' }).click({ force: true });
            console.log("-> Making the student join the class")

            // Step 13: Handle the OTP input cells
            await page.waitForSelector('.otp-input-wrapper', { state: 'visible', timeout: 10000 });
            const otpInputs = page.getByTestId('otp-input-field');
            const codeChars = (student.code || '').trim().split('');

            for (let i = 0; i < codeChars.length; i++) {
                // Click the visual box to give it focus (force: true bypasses overlapping borders)
                await otpInputs.nth(i).click({ force: true });

                // Fire a raw keyboard event to bypass DOM restrictions
                await page.keyboard.type(codeChars[i]);

                // Brief pause to allow Adobe's React state to process the keystroke before moving to the next cell
                await page.waitForTimeout(100);
            }
            console.log("-> Entered class code")

            // Step 14: Confirm class
            const confirmBtn = page.locator('sp-button', { hasText: 'Confirm class' });
            await confirmBtn.waitFor({ state: 'visible', timeout: 5000 });
            await confirmBtn.click({ force: true });
            console.log("-> Class confirmed")

            // Step 15: Conditional Join class button
            const joinBtn = page.locator('sp-button', { hasText: 'Join class' });
            if (await joinBtn.isVisible({ timeout: 5000 })) {
                await joinBtn.click({ force: true });
                console.log("-> Joined Class")
            }

            // Step 16: Graceful finish
            await page.waitForTimeout(2000);
            logStatus(student.name, 'registeration done');

        } catch (error) {
            let shortError = error.message.split('\n')[0];
            if (shortError.includes('i0116, #i0118')) shortError = "Timeout waiting for Microsoft Login screen";
            else if (shortError.includes('project-x:classrooms')) shortError = "Timeout waiting for Adobe dashboard to load";

            logStatus(student.name, `failed (${shortError})`);
        } finally {
            await context.close();
        }
    }

    await browser.close();
    console.log("\nBulk registration complete.");
}

runAutomation();