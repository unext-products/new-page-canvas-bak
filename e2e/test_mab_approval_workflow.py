"""Live regression check using an explicitly minted Ramya session; never changes entries."""
import json
import os
import unittest
from pathlib import Path

from playwright.sync_api import sync_playwright


class MabApprovalWorkflowTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        session_path = Path(os.environ.get(
            "APPROVAL_TEST_SESSION_FILE", "~/.cache/lovable-auth/session.json"
        )).expanduser()
        with session_path.open() as session_file:
            session = json.load(session_file)
        if session["session"]["user"]["id"] != "973ba34f-8703-4224-874c-e235050eb4d6":
            raise RuntimeError("Mint Ramya's session before running this access regression test.")
        cls.playwright = sync_playwright().start()
        cls.browser = cls.playwright.chromium.launch(headless=True)
        cls.context = cls.browser.new_context(viewport={"width": 1280, "height": 1800})
        cls.page = cls.context.new_page()
        cls.page.goto("http://localhost:8080")
        cls.page.evaluate("([k,v]) => localStorage.setItem(k,v)", [
            session["storage_key"], json.dumps(session["session"])
        ])
        cls.page.goto("http://localhost:8080/approvals")
        cls.page.get_by_text("Rajagopal A", exact=True).first.wait_for(timeout=30000)
        cls.settings = cls.page.evaluate("""async () => {
            const {supabase} = await import('/src/integrations/supabase/client.ts');
            const {data, error} = await supabase.from('organization_approval_settings')
                .select('l1_requires_approval,l1_approved_by,l2_approved_by,l3_approved_by')
                .eq('organization_id','4be340a2-38d7-4857-b797-5660c2f2258f').single();
            if (error) throw new Error(error.message);
            return data;
        }""")

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.playwright.stop()

    def test_mab_l3_can_approve_l1(self):
        self.assertTrue(self.settings["l1_requires_approval"])
        self.assertIn("l3", self.settings["l1_approved_by"])

    def test_existing_l2_approval_access_is_preserved(self):
        self.assertIn("l2", self.settings["l1_approved_by"])
        self.assertEqual(self.settings["l2_approved_by"], ["l3"])
        self.assertEqual(self.settings["l3_approved_by"], ["org_admin"])

    def test_ramya_can_read_all_three_mapped_reportees(self):
        for name in ["Latha Ub", "Rajagopal A", "Kusuma S"]:
            with self.subTest(reportee=name):
                self.assertGreater(self.page.get_by_text(name, exact=True).count(), 0)

    def test_ramya_data_access_is_direct_only(self):
        access = self.page.evaluate("""async () => {
            const {supabase} = await import('/src/integrations/supabase/client.ts');
            const out = {};
            for (const table of ['profiles','user_roles','timesheet_entries','leave_days',
                'user_verticals','user_programs','user_departments','user_batches','user_subjects','user_settings']) {
                const column = table === 'profiles' ? 'id' : 'user_id';
                const {data, error} = await supabase.from(table).select(column).limit(1000);
                if (error) throw new Error(error.message);
                out[table] = [...new Set(data.map(row => row[column]))];
            }
            const {data, error} = await supabase.from('profiles').select('id')
                .eq('id','3c4f91d3-ef37-4719-b3d4-31c4bf57f149');
            if (error) throw new Error(error.message);
            out.indirectLookup = data.map(row => row.id);
            return out;
        }""")
        allowed = {
            '973ba34f-8703-4224-874c-e235050eb4d6',
            '8e44bffa-6233-41fc-9e94-9c72862b8914',
            '2adc6890-abb7-4d2c-8ef3-85b5be1a78b5',
            '7372f1cd-c6c2-4dfe-8cb6-64a39e0668d7',
        }
        self.assertEqual(set(access['profiles']), allowed)
        self.assertEqual(access.pop('indirectLookup'), [])
        for table, ids in access.items():
            with self.subTest(table=table):
                self.assertTrue(set(ids).issubset(allowed))

    def test_ramya_selectors_exclude_indirect_reportees(self):
        self.page.goto('http://localhost:8080/approvals')
        self.page.get_by_text('Rajagopal A', exact=True).first.wait_for(timeout=30000)
        self.page.get_by_role('combobox').first.click()
        options = self.page.get_by_role('option').all_text_contents()
        self.assertEqual(len(options), 4)
        self.assertTrue(any('Kusuma S' in option for option in options))
        self.assertFalse(any('Freena Lobo' in option for option in options))
        self.page.keyboard.press('Escape')


if __name__ == "__main__":
    unittest.main()