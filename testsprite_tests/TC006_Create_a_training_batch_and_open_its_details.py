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
        
        # -> Fill 'dzaky@bki.academy' into the Email Address field and 'Dzaky123' into the Password field, then click the 'Sign In' button.
        # admin@bkiacademy.edu email field
        elem = page.get_by_role("textbox", name="Email Address")
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("dzaky@bki.academy")
        
        # -> Fill 'dzaky@bki.academy' into the Email Address field and 'Dzaky123' into the Password field, then click the 'Sign In' button.
        # •••••••• password field
        elem = page.get_by_role("textbox", name="Password")
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("Dzaky123")
        
        # -> Fill 'dzaky@bki.academy' into the Email Address field and 'Dzaky123' into the Password field, then click the 'Sign In' button.
        # Sign In button
        elem = page.get_by_role("button", name="Sign In")
        await elem.click(timeout=10000)
        
        # -> Click the 'Training Batches' link in the left sidebar to open the Trainings list page.
        # school Training Batches link
        elem = page.get_by_role("link", name="school Training Batches")
        await elem.click(timeout=10000)
        
        # -> Click the 'Add Training' button on the Trainings page to open the create-batch form.
        # add Add Training button
        elem = page.get_by_role("button", name="add Add Training")
        await elem.click(timeout=10000)
        
        # -> Fill 'Batch QA 01' into the TRAINING NAME field, set a batch code, set valid START DATE and END DATE, then click the 'Create Training' button.
        # e.g. Advanced Structural Analysis text field
        elem = page.get_by_role("textbox", name="TRAINING NAME *")
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("Batch QA 01")
        
        # -> Fill 'Batch QA 01' into the TRAINING NAME field, set a batch code, set valid START DATE and END DATE, then click the 'Create Training' button.
        # e.g. BTH-2024-01 text field
        elem = page.get_by_role("textbox", name="BATCH CODE *")
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("BTH-QA-01")
        
        # -> Fill 'Batch QA 01' into the TRAINING NAME field, set a batch code, set valid START DATE and END DATE, then click the 'Create Training' button.
        # date field
        elem = page.get_by_role("textbox", name="START DATE *")
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("2026-10-05")
        
        # -> Fill 'Batch QA 01' into the TRAINING NAME field, set a batch code, set valid START DATE and END DATE, then click the 'Create Training' button.
        # date field
        elem = page.get_by_role("textbox", name="END DATE *")
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("2026-10-07")
        
        # -> Fill 'Batch QA 01' into the TRAINING NAME field, set a batch code, set valid START DATE and END DATE, then click the 'Create Training' button.
        # Create Training button
        elem = page.get_by_role("button", name="Create Training")
        await elem.click(timeout=10000)
        
        # -> Fill 'Dzaky' into the 'PERSON IN CHARGE (PIC)' field in the Add New Training modal.
        # e.g. Budi Santoso text field
        elem = page.get_by_role("textbox", name="PERSON IN CHARGE (PIC) *")
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("Dzaky")
        
        # -> Click the 'Create Training' button to submit the new training form.
        # Create Training button
        elem = page.get_by_role("button", name="Create Training")
        await elem.click(timeout=10000)
        
        # -> Open the Trainings list page and locate the 'Batch QA 01' entry, then open it to view the batch detail page.
        await page.goto("http://localhost:3000/trainings")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass
        
        # -> Click the 'Batch QA 01' row in the Trainings list to open its batch detail page.
        # Batch QA 01
        elem = page.get_by_text("Batch QA")
        await elem.click(timeout=10000)
        
        # --> Assertions to verify final state
        
        # --> The batch detail page for the created training is open.
        # Assert-outcome: passed
        # Assert: URL contains '/trainings/' confirming the batch detail page is open.
        await expect(page).to_have_url(re.compile("/trainings/"), timeout=15000), "URL contains '/trainings/' confirming the batch detail page is open."
        
        # --> Participants and Certificates workflow controls are visible on the batch detail page.
        # Assert-outcome: passed
        # Assert: Participants tab is visible.
        await expect(page.locator("xpath=/html/body/div[3]/div/main/div[1]/button[2]").nth(0)).to_have_text("Participants", timeout=15000), "Participants tab is visible."
        # Assert-outcome: passed
        # Assert: Certificates tab shows a PENDING badge.
        await expect(page.locator("xpath=/html/body/div[3]/div/main/div[1]/button[3]").nth(0)).to_contain_text("PENDING", timeout=15000), "Certificates tab shows a PENDING badge."
        await asyncio.sleep(5)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
    