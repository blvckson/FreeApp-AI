import json, unittest
from pathlib import Path

class DatasetTests(unittest.TestCase):
    def test_exactly_50_cases(self):
        data=json.loads(Path(__file__).with_name("benchmark-50.json").read_text())
        self.assertEqual(len(data["cases"]), 50)
    def test_ten_per_category(self):
        data=json.loads(Path(__file__).with_name("benchmark-50.json").read_text())
        for category in data["categories"]:
            self.assertEqual(sum(c["category"]==category for c in data["cases"]),10)
    def test_unique_ids(self):
        data=json.loads(Path(__file__).with_name("benchmark-50.json").read_text())
        ids=[c["id"] for c in data["cases"]]
        self.assertEqual(len(ids),len(set(ids)))
    def test_rubric_complete(self):
        data=json.loads(Path(__file__).with_name("benchmark-50.json").read_text())
        for case in data["cases"]:
            self.assertEqual(len(case["rubric"]),4)
            self.assertEqual(case["max_score"],4)

if __name__=="__main__": unittest.main()
