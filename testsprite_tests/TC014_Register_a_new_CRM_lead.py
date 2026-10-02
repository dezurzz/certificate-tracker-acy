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
        
        # -> Click the 'Semua Leads' link in the left menu to open the Leads pipeline.
        # person_search Semua Leads link
        elem = page.get_by_role("link", name="person_search Semua Leads")
        await elem.click(timeout=10000)
        
        # -> Click the 'Input Lead Baru' button to open the quick lead input modal.
        # add_circle Input Lead Baru button
        elem = page.get_by_role("button", name="add_circle Input Lead Baru")
        await elem.click(timeout=10000)
        
        # -> Fill the 'Nama Kontak PIC', 'No. WhatsApp / HP', 'Perusahaan / Instansi', and 'Email Kontak (Opsional)' fields with valid test values.
        # Contoh: Budi Santoso text field
        elem = page.get_by_role("textbox", name="Contoh: Budi Santoso")
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("Test Lead QA")
        
        # -> Fill the 'Nama Kontak PIC', 'No. WhatsApp / HP', 'Perusahaan / Instansi', and 'Email Kontak (Opsional)' fields with valid test values.
        # Contoh: 08123456789 tel field
        elem = page.get_by_role("textbox", name="Contoh: 08123456789")
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("081234567890")
        
        # -> Fill the 'Nama Kontak PIC', 'No. WhatsApp / HP', 'Perusahaan / Instansi', and 'Email Kontak (Opsional)' fields with valid test values.
        # Contoh: PT Pertamina Shipping (atau Pribadi) text field
        elem = page.get_by_role("textbox", name="Contoh: PT Pertamina Shipping")
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("PT Contoh QA")
        
        # -> Fill the 'Nama Kontak PIC', 'No. WhatsApp / HP', 'Perusahaan / Instansi', and 'Email Kontak (Opsional)' fields with valid test values.
        # budi@perusahaan.com email field
        elem = page.get_by_role("textbox", name="budi@perusahaan.com")
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("test.lead.qa@example.com")
        
        # -> Type 'Test Program QA' into the 'Program Training Diminati' field and wait for suggestion options to appear.
        # Pilih atau ketik program... text field
        elem = page.get_by_role("combobox", name="Pilih atau ketik program...")
        await elem.wait_for(state="visible", timeout=10000)
        await elem.fill("Test Program QA")
        
        # -> Click the 'Simpan Lead' button to submit the new lead.
        # Simpan Lead button
        elem = page.get_by_role("button", name="Simpan Lead")
        await elem.click(timeout=10000)
        
        # -> Open the Leads pipeline page ('Semua Leads') by navigating to /crm/leads and check whether the newly created lead 'Test Lead QA' appears in the list.
        await page.goto("http://localhost:3000/crm/leads")
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=5000)
        except Exception:
            pass
        
        # --> Assertions to verify final state
        
        # --> The newly created lead 'Test Lead QA' appears in the Leads & Opportunity Pipeline table.
        # Assert-outcome: passed
        # Assert: Verifies the leads table contains a row with the contact name 'Test Lead QA'.
        await expect(page.locator("tbody").nth(0)).to_contain_text("Test Lead QA", timeout=15000), "Verifies the leads table contains a row with the contact name 'Test Lead QA'."
        await asyncio.sleep(5)

    finally:
        if context:
            await context.close()
        if browser:
            await browser.close()
        if pw:
            await pw.stop()

asyncio.run(run_test())
    