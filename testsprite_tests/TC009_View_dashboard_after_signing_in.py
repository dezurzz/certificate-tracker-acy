import asyncio
import re
from playwright import async_api
from playwright.async_api import expect

async def run_test():
    pw = None
    browser = None
    context = None

    try:
        # Start a Playwright session in asynchronous mode
        pw = await async_api.async_playwright().start()

        # Launch a Chromium browser in headless mode with custom arguments
        browser = await pw.chromium.launch(
            headless=True,
            args=[
                "--window-size=1280,720",
                "--disable-dev-shm-usage",
                "--ipc=host",
                "--single-process"
            ],
        )

        # Create a new browser context (like an incognito window)
        context = await browser.new_context()
        # Wider default timeout to match the agent's DOM-stability budget;
        # auto-waiting Playwright APIs (expect, locator.wait_for) inherit this.
        context.set_default_timeout(15000)

        # Open a new page in the browser context
        page = await context.new_page()

        # Interact with the page elements to simulate user flow
        # -> navigate
        await page.goto("http://localhost:3001")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass
        
        # -> Fill the 'Email Address' field with dzaky@bki.academy, fill the 'Password' field with the provided password, then click the 'Sign In' button.
        # admin@bkiacademy.edu email field
        elem = page.locator('[id="email"]')
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("dzaky@bki.academy")
        
        # -> Fill the 'Email Address' field with dzaky@bki.academy, fill the 'Password' field with the provided password, then click the 'Sign In' button.
        # •••••••• password field
        elem = page.locator('[id="password"]')
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("Dzaky123BKI")
        
        # -> Fill the 'Email Address' field with dzaky@bki.academy, fill the 'Password' field with the provided password, then click the 'Sign In' button.
        # Sign In button
        elem = page.get_by_role('button', name='Sign In', exact=True)
        await elem.click(timeout=10000)
        
        # --> Assertions to verify final state
        
        # --> KPI summary cards are visible on the dashboard (for example the 'Training Completed' card).
        # Assert-outcome: passed
        # Assert: Verifies the 'Training Completed' KPI card is shown on the dashboard.
        await expect(page.locator("xpath=/html/body/div[2]/div/main/div[2]/a[1]").nth(0)).to_contain_text("Training Completed", timeout=15000), "Verifies the 'Training Completed' KPI card is shown on the dashboard."
        
        # --> The Recent Activity panel is visible and contains activity entries (for example a 'Certificate completed' entry).
        # Assert-outcome: passed
        # Assert: Verifies the Recent Activity list includes a 'Certificate completed' entry.
        await expect(page.locator("xpath=/html/body/div[2]/div/main/div[3]/div[2]/div[2]").nth(0)).to_contain_text("Certificate completed", timeout=15000), "Verifies the Recent Activity list includes a 'Certificate completed' entry."
        await asyncio.sleep(5)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
    