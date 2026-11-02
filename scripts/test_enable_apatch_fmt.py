"""Regression tests for the local apatch FMT configuration bootstrap."""

from pathlib import Path
import importlib.util
import tempfile
import unittest

MODULE_PATH = Path(__file__).with_name("enable-apatch-fmt.py")
SPEC = importlib.util.spec_from_file_location("enable_apatch_fmt", MODULE_PATH)
assert SPEC is not None and SPEC.loader is not None
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class EnableApatchFmtTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.config = Path(self.temp.name) / ".apatch" / "config.yaml"

    def test_new_configuration_registers_format_and_existing_check_runner(self) -> None:
        self.assertTrue(MODULE.configure(self.config))
        content = self.config.read_text()
        self.assertIn("schema_version: 1", content)
        self.assertIn('["sh", "./run-format.sh"]', content)
        self.assertIn('["sh", "./run-tests.sh"]', content)

    def test_existing_settings_are_preserved_and_repeated_install_is_noop(self) -> None:
        self.config.parent.mkdir()
        original = 'schema_version: 1\ndownloads_dir: "/tmp/example"\nchecks:\n  - ["sh", "./run-tests.sh"]\n'
        self.config.write_text(original)
        self.assertTrue(MODULE.configure(self.config))
        result = self.config.read_text()
        self.assertTrue(result.startswith(original))
        self.assertIn("format_commands:", result)
        self.assertFalse(MODULE.configure(self.config))
        self.assertEqual(self.config.read_text(), result)

    def test_conflicting_format_commands_fail_without_overwriting(self) -> None:
        self.config.parent.mkdir()
        original = 'schema_version: 1\nformat_commands:\n  - ["pnpm", "format"]\n'
        self.config.write_text(original)
        with self.assertRaisesRegex(ValueError, "reviewed manually"):
            MODULE.configure(self.config)
        self.assertEqual(self.config.read_text(), original)

    def test_existing_checks_are_not_replaced(self) -> None:
        self.config.parent.mkdir()
        original = 'schema_version: 1\nchecks:\n  - ["sh", "./custom-checks.sh"]\n'
        self.config.write_text(original)
        MODULE.configure(self.config)
        result = self.config.read_text()
        self.assertIn(original, result)
        self.assertNotIn("./run-tests.sh", result)

    def test_expected_formatter_already_present_does_not_duplicate_it(self) -> None:
        self.config.parent.mkdir()
        content = 'schema_version: 1\nformat_commands:\n  - ["sh", "./run-format.sh"]\nchecks:\n  - ["sh", "./run-tests.sh"]\n'
        self.config.write_text(content)
        self.assertFalse(MODULE.configure(self.config))
        self.assertEqual(self.config.read_text(), content)

    def test_comment_is_not_mistaken_for_a_configured_formatter(self) -> None:
        self.config.parent.mkdir()
        content = 'schema_version: 1\nformat_commands:\n  - ["pnpm", "format"] # ./run-format.sh\n'
        self.config.write_text(content)
        with self.assertRaisesRegex(ValueError, "reviewed manually"):
            MODULE.configure(self.config)
        self.assertEqual(self.config.read_text(), content)

    def test_symlink_is_refused(self) -> None:
        self.config.parent.mkdir()
        target = Path(self.temp.name) / "other.yaml"
        target.write_text("schema_version: 1\n")
        self.config.symlink_to(target)
        with self.assertRaisesRegex(ValueError, "symbolic-link"):
            MODULE.configure(self.config)
        self.assertEqual(target.read_text(), "schema_version: 1\n")


if __name__ == "__main__":
    unittest.main()
