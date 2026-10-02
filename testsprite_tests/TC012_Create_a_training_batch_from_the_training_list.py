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
        await page.goto("http://localhost:3000")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass
        
        # -> Fill 'dzaky@bki.academy' into the Email Address field, fill 'Dzaky123' into the Password field, then click the 'Sign In' button.
        # admin@bkiacademy.edu email field
        elem = page.get_by_role("textbox", name="Email Address")
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("dzaky@bki.academy")
        
        # -> Fill 'dzaky@bki.academy' into the Email Address field, fill 'Dzaky123' into the Password field, then click the 'Sign In' button.
        # •••••••• password field
        elem = page.get_by_role("textbox", name="Password")
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("Dzaky123")
        
        # -> Fill 'dzaky@bki.academy' into the Email Address field, fill 'Dzaky123' into the Password field, then click the 'Sign In' button.
        # Sign In button
        elem = page.get_by_role("button", name="Sign In")
        await elem.click(timeout=10000)
        
        # -> Click the 'New Batch' button on the dashboard to open the new batch form.
        # add New Batch link
        elem = page.get_by_role("link", name="add New Batch")
        await elem.click(timeout=10000)
        
        # -> Fill the 'TRAINING NAME', 'BATCH CODE', 'START DATE', and 'END DATE' fields in the 'Add New Training' modal.
        # e.g. Advanced Structural Analysis text field
        elem = page.get_by_role("textbox", name="TRAINING NAME *")
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("Automated Test Training 2026-09-28 A")
        
        # -> Fill the 'TRAINING NAME', 'BATCH CODE', 'START DATE', and 'END DATE' fields in the 'Add New Training' modal.
        # e.g. BTH-2024-01 text field
        elem = page.get_by_role("textbox", name="BATCH CODE *")
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("BTH-20260928-A")
        
        # -> Fill the 'TRAINING NAME', 'BATCH CODE', 'START DATE', and 'END DATE' fields in the 'Add New Training' modal.
        # date field
        elem = page.get_by_role("textbox", name="START DATE *")
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("2026-10-01")
        
        # -> Fill the 'TRAINING NAME', 'BATCH CODE', 'START DATE', and 'END DATE' fields in the 'Add New Training' modal.
        # date field
        elem = page.get_by_role("textbox", name="END DATE *")
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("2026-10-03")
        
        # -> Fill the 'PERSON IN CHARGE (PIC)' field with 'Dzaky' and click the 'Create Training' button to submit the new training.
        # e.g. Budi Santoso text field
        elem = page.get_by_role("textbox", name="PERSON IN CHARGE (PIC) *")
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("Dzaky")
        
        # -> Fill the 'PERSON IN CHARGE (PIC)' field with 'Dzaky' and click the 'Create Training' button to submit the new training.
        # Create Training button
        elem = page.get_by_role("button", name="Create Training")
        await elem.click(timeout=10000)
        
        # --> Assertions to verify final state
        
        # --> The newly created training batch 'Automated Test Training 2026-09-28 A' is visible in the Trainings list.
        # Assert-outcome: passed
        # Assert: The Trainings list shows the created training name.
        await expect(page.locator("xpath=/html/body/div[2]/div/main/div[3]/div[1]/table/tbody/tr[1]/td[2]").nth(0)).to_have_text("Automated Test Training 2026-09-28 A", timeout=15000), "The Trainings list shows the created training name."
        await asyncio.sleep(5)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
    