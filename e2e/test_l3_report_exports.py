"""Verify real L3-scoped reports download through the administrator's View as flow."""
import json
import os
import unittest
from pathlib import Path
from playwright.sync_api import sync_playwright


class L3ReportExportTest(unittest.TestCase):
    def test_l3_member_and_department_downloads(self):
        if os.environ.get("LOVABLE_BROWSER_AUTH_STATUS") != "injected":
            self.skipTest("A signed-in administrator session is required.")
        output = Path("/tmp/browser/l3-export")
        output.mkdir(parents=True, exist_ok=True)
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True)
            context = browser.new_context(viewport={"width": 1280, "height": 1800})
            page = context.new_page()
            errors = []
            page.on("pageerror", lambda error: errors.append(str(error)))
            page.goto("http://localhost:8080")
            page.evaluate("([k,v]) => localStorage.setItem(k,v)", [
                os.environ["LOVABLE_BROWSER_SUPABASE_STORAGE_KEY"],
                os.environ["LOVABLE_BROWSER_SUPABASE_SESSION_JSON"],
            ])
            page.goto("http://localhost:8080/users")
            page.get_by_placeholder("Search by name or email...").fill("Ramya")
            page.get_by_role("button", name="View as Ramya Tauh", exact=True).click()
            page.get_by_text("Viewing as", exact=False).first.wait_for()
            page.get_by_role("link", name="Reports", exact=True).click()
            self.assertTrue(page.get_by_role("button", name="Export", exact=True).is_disabled())
            for view in ["Member View", "Department View"]:
                page.get_by_role("tab", name=view, exact=True).click()
                page.get_by_role("button", name="Submit", exact=True).click()
                page.get_by_text("Detailed Timesheet Entries" if view == "Member View" else "Faculty Breakdown", exact=True).first.wait_for(timeout=60000)
                export = page.get_by_role("button", name="Export", exact=True)
                self.assertTrue(export.is_enabled())
                for kind in ["CSV", "PDF"]:
                    export.click()
                    with page.expect_download() as download_info:
                        page.get_by_role("menuitem", name=f"Export to {kind}", exact=True).click()
                    download = download_info.value
                    destination = output / download.suggested_filename
                    download.save_as(destination)
                    self.assertGreater(destination.stat().st_size, 100)
                    if kind == "CSV":
                        content = destination.read_text()
                        self.assertIn("Rajagopal A", content)
                        self.assertNotIn("Freena Lobo", content)
                    print(f"Verified L3 {view}: {kind} download")
                page.screenshot(path=str(output / f"{view.replace(' ', '_')}.png"))
            self.assertEqual(errors, [])
            browser.close()


if __name__ == "__main__":
    unittest.main()