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
        
        # -> Click the 'Training Batches' link in the left navigation to open the Trainings page.
        # school Training Batches link
        elem = page.get_by_role("link", name="school Training Batches")
        await elem.click(timeout=10000)
        
        # -> Click the 'Add Training' button to open the new training batch creation flow.
        # add Add Training button
        elem = page.get_by_role("button", name="add Add Training")
        await elem.click(timeout=10000)
        
        # -> Fill the training form fields (Training Name, Batch Code, Start Date, End Date, Person in Charge) and click the 'Create Training' button.
        # e.g. Advanced Structural Analysis text field
        elem = page.get_by_role("textbox", name="TRAINING NAME *")
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("QA Test Batch 2026-09-28")
        
        # -> Fill the training form fields (Training Name, Batch Code, Start Date, End Date, Person in Charge) and click the 'Create Training' button.
        # e.g. BTH-2024-01 text field
        elem = page.get_by_role("textbox", name="BATCH CODE *")
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("BTH-TEST-0928")
        
        # -> Fill the training form fields (Training Name, Batch Code, Start Date, End Date, Person in Charge) and click the 'Create Training' button.
        # date field
        elem = page.get_by_role("textbox", name="START DATE *")
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("2026-10-05")
        
        # -> Fill the training form fields (Training Name, Batch Code, Start Date, End Date, Person in Charge) and click the 'Create Training' button.
        # date field
        elem = page.get_by_role("textbox", name="END DATE *")
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("2026-10-07")
        
        # -> Fill the training form fields (Training Name, Batch Code, Start Date, End Date, Person in Charge) and click the 'Create Training' button.
        # e.g. Budi Santoso text field
        elem = page.get_by_role("textbox", name="PERSON IN CHARGE (PIC) *")
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("Dzaky")
        
        # -> Click the 'Create Training' button to submit the new training batch form.
        # Create Training button
        elem = page.get_by_role("button", name="Create Training")
        await elem.click(timeout=10000)
        
        # -> Navigate to the Trainings page and check that the training named 'QA Test Batch 2026-09-28' appears in the trainings list.
        await page.goto("http://localhost:3000/trainings")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass
        
        # --> Assertions to verify final state
        
        # --> Created training 'QA Test Batch 2026-09-28' appears in the Trainings list with batch code BTH-TEST-0928.
        # Assert-outcome: passed
        # Assert: The trainings list shows the created training name 'QA Test Batch 2026-09-28'.
        await expect(page.locator("xpath=/html/body/div[2]/div/main/div[3]/div[1]/table/tbody/tr[2]/td[2]/div").nth(0)).to_have_text("QA Test Batch 2026-09-28", timeout=15000), "The trainings list shows the created training name 'QA Test Batch 2026-09-28'."
        # Assert-outcome: passed
        # Assert: The trainings list shows the batch code 'BTH-TEST-0928' for the created training.
        await expect(page.locator("xpath=/html/body/div[2]/div/main/div[3]/div[1]/table/tbody/tr[2]/td[3]/div").nth(0)).to_have_text("BTH-TEST-0928", timeout=15000), "The trainings list shows the batch code 'BTH-TEST-0928' for the created training."
        await asyncio.sleep(5)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
    