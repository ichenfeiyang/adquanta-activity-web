import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from scripts import deploy_static


class RecordingClient:
    def __init__(self):
        self.calls = []

    def put_object(self, **kwargs):
        kwargs["Body"] = kwargs["Body"].read()
        self.calls.append(kwargs)


class DeployStaticTest(unittest.TestCase):
    def test_iter_upload_files_publishes_index_last(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            dist_dir = Path(temp_dir)
            (dist_dir / "assets").mkdir()
            (dist_dir / "assets" / "app.js").write_text("app", encoding="utf-8")
            (dist_dir / "favicon.svg").write_text("icon", encoding="utf-8")
            (dist_dir / "index.html").write_text("index", encoding="utf-8")

            relative_keys = [
                relative_key
                for _, relative_key in deploy_static.iter_upload_files(dist_dir)
            ]

        self.assertEqual(relative_keys[-1], "index.html")
        self.assertCountEqual(
            relative_keys,
            ["assets/app.js", "favicon.svg", "index.html"],
        )

    def test_upload_file_sets_object_metadata_and_prefix(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            path = Path(temp_dir) / "index.html"
            path.write_text("<main>Activity</main>", encoding="utf-8")
            client = RecordingClient()

            object_key = deploy_static.upload_file(
                client,
                "activity-test",
                "/preview/",
                path,
                "index.html",
            )

        self.assertEqual(object_key, "preview/index.html")
        self.assertEqual(len(client.calls), 1)
        self.assertEqual(client.calls[0]["Bucket"], "activity-test")
        self.assertEqual(client.calls[0]["Key"], "preview/index.html")
        self.assertEqual(client.calls[0]["Body"], b"<main>Activity</main>")
        self.assertEqual(client.calls[0]["ContentType"], "text/html")
        self.assertEqual(client.calls[0]["CacheControl"], "no-cache")

    def test_non_html_assets_use_long_lived_cache(self):
        self.assertEqual(
            deploy_static.get_cache_control(Path("assets/app.123.js")),
            "public, max-age=31536000, immutable",
        )

    def test_rejects_invalid_addressing_style(self):
        with patch.dict(
            "os.environ",
            {"STORAGE_ADDRESSING_STYLE": "unsupported"},
            clear=False,
        ):
            with self.assertRaisesRegex(RuntimeError, "Invalid STORAGE_ADDRESSING_STYLE"):
                deploy_static.get_addressing_style()


if __name__ == "__main__":
    unittest.main()
