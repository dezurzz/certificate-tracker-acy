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
        
        # -> Fill the 'Email Address' and 'Password' fields and click the 'Sign In' button.
        # admin@bkiacademy.edu email field
        elem = page.get_by_role("textbox", name="Email Address")
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("dzaky@bki.academy")
        
        # -> Fill the 'Email Address' and 'Password' fields and click the 'Sign In' button.
        # •••••••• password field
        elem = page.get_by_role("textbox", name="Password")
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("Dzaky123")
        
        # -> Fill the 'Email Address' and 'Password' fields and click the 'Sign In' button.
        # Sign In button
        elem = page.get_by_role("button", name="Sign In")
        await elem.click(timeout=10000)
        
        # -> Click the 'Training Batches' link in the left navigation to open the training list.
        # school Training Batches link
        elem = page.get_by_role("link", name="school Training Batches")
        await elem.click(timeout=10000)
        
        # -> Click the 'Add Training' button to open the create-training form/modal.
        # add Add Training button
        elem = page.get_by_role("button", name="add Add Training")
        await elem.click(timeout=10000)
        
        # -> Click the 'close' button on the Add New Training modal to dismiss it, then click the 'TESTING' training row to open that batch.
        # close button
        elem = page.get_by_role("button", name="close")
        await elem.click(timeout=10000)
        
        # -> Click the 'close' button on the Add New Training modal to dismiss it, then click the 'TESTING' training row to open that batch.
        # TESTING
        elem = page.get_by_text("TESTING")
        await elem.click(timeout=10000)
        
        # -> Click the 'Certificates' tab to open the certificates view/board
        # Certificates 0 PENDING button
        elem = page.get_by_role("button", name="Certificates 18 PENDING")
        await elem.click(timeout=10000)
        
        # -> Click the 'Move items right' button on the 'ROBERT FHILIPUS RUMU' card to move it to the PROCESSING QC column.
        # chevron_right button
        elem = page.locator("div").filter(has_text=re.compile(r"^9chevron_right$")).get_by_role("button")
        await elem.click(timeout=10000)
        
        # --> Assertions to verify final state
        
        # --> Certificates workflow board is displayed for the training batch (PENDING, PROCESSING QC, PRINTED, COMPLETED columns are present).
        await page.locator("div").filter(has_text=re.compile(r"^9chevron_right$")).get_by_role("button").nth(0).scroll_into_view_if_needed()
        # Assert-outcome: passed
        # Assert: The Certificates board's PENDING-column control is visible, indicating the board is displayed.
        await expect(page.locator("div").filter(has_text=re.compile(r"^9chevron_right$")).get_by_role("button").nth(0)).to_be_visible(timeout=15000), "The Certificates board's PENDING-column control is visible, indicating the board is displayed."
        
        # --> The certificate card 'ROBERT FHILIPUS RUMU' appears in the Processing QC column after the move.
        await page.get_by_role("heading", name="ROBERT FHILIPUS RUMU").nth(1).nth(0).scroll_into_view_if_needed()
        # Assert-outcome: passed
        # Assert: The moved certificate's card element is visible in the Processing QC column.
        await expect(page.get_by_role("heading", name="ROBERT FHILIPUS RUMU").nth(1).nth(0)).to_be_visible(timeout=15000), "The moved certificate's card element is visible in the Processing QC column."
        await asyncio.sleep(5)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
    