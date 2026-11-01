import unittest
from protocol import validate_chat_request


class ProtocolTests(unittest.TestCase):
    def test_valid_chat_request(self):
        messages, max_tokens, temperature = validate_chat_request({
            "messages": [{"role": "user", "content": "hello"}],
            "max_tokens": 64,
            "temperature": 0
        })
        self.assertEqual(messages[0]["content"], "hello")
        self.assertEqual(max_tokens, 64)
        self.assertEqual(temperature, 0)

    def test_empty_messages_rejected(self):
        with self.assertRaises(ValueError):
            validate_chat_request({"messages": []})

    def test_unknown_role_rejected(self):
        with self.assertRaises(ValueError):
            validate_chat_request({"messages": [{"role": "tool", "content": "x"}]})

    def test_non_text_content_rejected(self):
        with self.assertRaises(ValueError):
            validate_chat_request({"messages": [{"role": "user", "content": [{"type": "image"}]}]})

    def test_token_limit_rejected(self):
        with self.assertRaises(ValueError):
            validate_chat_request({"messages": [{"role": "user", "content": "x"}], "max_tokens": 99999})


if __name__ == "__main__":
    unittest.main()
