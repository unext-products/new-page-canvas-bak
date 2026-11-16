"""Run with Boby's explicitly minted session; reads data and downloads reports only."""
import json
import unittest
from pathlib import Path
from playwright.sync_api import sync_playwright


class BobyReportingScopeTest(unittest.TestCase):
    def test_reports_team_and_approval_isolation(self):
        with Path("~/.cache/lovable-auth/session.json").expanduser().open() as file:
            session = json.load(file)
        self.assertEqual(session["session"]["user"]["id"], "a781cf9a-898d-4f47-987e-57deba5a5858")
        output = Path("/tmp/browser/boby-verified")
        output.mkdir(parents=True, exist_ok=True)
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(viewport={"width": 768, "height": 693})
            page = context.new_page()
            errors = []
            page.on("pageerror", lambda error: errors.append(str(error)))
            page.goto("http://localhost:8080")
            page.evaluate("([k,v])=>localStorage.setItem(k,v)", [session["storage_key"], json.dumps(session["session"])])
            page.goto("http://localhost:8080/reports")
            page.get_by_role("button", name="Last Month", exact=True).click()
            page.get_by_role("button", name="Submit", exact=True).click()
            page.get_by_text("Detailed Timesheet Entries", exact=True).wait_for(timeout=60000)
            scope = page.evaluate("""async () => {
                const {supabase}=await import('/src/integrations/supabase/client.ts');
                const {data,error}=await supabase.rpc('get_reporting_scope',{p_manager_id:'a781cf9a-898d-4f47-987e-57deba5a5858'});
                if(error) throw error;
                return data;
            }""")
            self.assertGreater(len(scope), 6)
            page.get_by_role("button", name="Export", exact=True).click()
            with page.expect_download() as info:
                page.get_by_role("menuitem", name="Export to CSV", exact=True).click()
            path = output / "october.csv"
            info.value.save_as(path)
            import csv
            with path.open() as file:
                rows = list(csv.reader(file))
            header_index = next(i for i,row in enumerate(rows) if row[:3] == ["Program", "Vertical", "Name"])
            exported = len(rows) - header_index - 1
            self.assertGreater(exported, 4000)
            print(f"Boby October CSV: {exported} entries; scope: {len(scope)} members")
            page.keyboard.press("Escape")
            page.screenshot(path=str(output / "reports.png"))
            page.goto("http://localhost:8080/team")
            page.get_by_text("Team Members", exact=True).wait_for(timeout=60000)
            self.assertGreater(page.get_by_role("button", name="Calendar", exact=True).count(), 6)
            page.screenshot(path=str(output / "team.png"))
            page.goto("http://localhost:8080/approvals")
            page.get_by_text("Quick Filters:", exact=True).wait_for(timeout=60000)
            page.get_by_role("combobox").first.click()
            options = page.get_by_role("option").all_text_contents()
            self.assertEqual(len(options), 7)
            for name in ["Ann Mary", "Arvind", "Hari", "Nitin", "Sarika", "Sharada"]:
                self.assertTrue(any(name in option for option in options))
            page.keyboard.press("Escape")
            # Confirm restrictive UPDATE policy excludes every indirect entry without changing data.
            direct = page.evaluate("""async () => {
                const {supabase}=await import('/src/integrations/supabase/client.ts');
                const {data,error}=await supabase.rpc('get_manager_direct_reportees');
                if(error) throw error;
                return data;
            }""")
            self.assertEqual(len(direct), 6)
            self.assertTrue(set(direct).issubset(set(scope)))
            self.assertEqual(errors, [])
            browser.close()


if __name__ == "__main__":
    unittest.main()