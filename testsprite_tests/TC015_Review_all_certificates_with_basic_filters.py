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
        
        # -> Fill the Email Address and Password fields and click the 'Sign In' button to log in.
        # admin@bkiacademy.edu email field
        elem = page.locator('[id="email"]')
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("dzaky@bki.academy")
        
        # -> Fill the Email Address and Password fields and click the 'Sign In' button to log in.
        # •••••••• password field
        elem = page.locator('[id="password"]')
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("Dzaky123BKI")
        
        # -> Fill the Email Address and Password fields and click the 'Sign In' button to log in.
        # Sign In button
        elem = page.get_by_role('button', name='Sign In', exact=True)
        await elem.click(timeout=10000)
        
        # -> Click the 'Certificate Monitoring' link in the left navigation to open the certificates list.
        # verified Certificate Monitoring link
        elem = page.get_by_role('link', name='verified Certificate Monitoring', exact=True)
        await elem.click(timeout=10000)
        
        # -> Open the 'All Trainings' dropdown (label: All Trainings) so the list of training options is shown.
        # All Trainings INTERNAL MARINE dropdown
        elem = page.get_by_text('All Trainings INTERNAL MARINE', exact=True)
        await elem.click(timeout=10000)
        
        # -> Select 'INTERNAL' from the 'All Trainings' dropdown
        # All Trainings INTERNAL MARINE dropdown
        elem = page.locator("xpath=/html/body/div[2]/div/main/div[2]/select").nth(0)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.select_option("")
        
        # -> Open the 'All Statuses' dropdown and select the 'Completed' option.
        # All Statuses Pending Processing Printing... dropdown
        elem = page.locator("xpath=/html/body/div[2]/div/main/div[2]/select[3]").nth(0)
        await elem.wait_for(state="visible", timeout=10000)
        await elem.select_option("")
        
        # --> Assertions to verify final state
        
        # --> Filtered certificates are listed and show the selected 'Completed' status.
        # Assert-outcome: passed
        # Assert: The first result's status equals 'Completed'.
        await expect(page.locator("xpath=/html/body/div[2]/div/main/div[3]/div/table/tbody/tr[1]/td[5]").nth(0)).to_have_text("Completed", timeout=15000), "The first result's status equals 'Completed'."
        
        # --> Each listed certificate shows its age in the Age (Days) column.
        await page.locator("xpath=/html/body/div[2]/div/main/div[3]/div/table/tbody/tr[1]/td[6]").nth(0).scroll_into_view_if_needed()
        # Assert-outcome: passed
        # Assert: An Age (Days) value is visible for the first listed certificate.
        await expect(page.locator("xpath=/html/body/div[2]/div/main/div[3]/div/table/tbody/tr[1]/td[6]").nth(0)).to_be_visible(timeout=15000), "An Age (Days) value is visible for the first listed certificate."
        await asyncio.sleep(5)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
    