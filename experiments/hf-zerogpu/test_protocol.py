import unittest

# These tests intentionally validate the isolated experiment's input contract
# without downloading model weights or changing production benchmark code.


def validate_request(payload):
    if not isinstance(payload, dict):
        raise ValueError("payload must be an object")
    messages = payload.get("messages")
    if not isinstance(messages, list) or not messages:
        raise ValueError("messages must be a non-empty array")
    for message in messages:
        if not isinstance(message, dict):
            raise ValueError("message must be an object")
        if message.get("role") not in {"system", "user", "assistant"}:
            raise ValueError("unsupported role")
        if not isinstance(message.get("content"), str):
            raise ValueError("content must be text")
    max_tokens = int(payload.get("max_tokens", 512))
    if max_tokens < 1 or max_tokens > 2048:
        raise ValueError("max_tokens out of range")
    temperature = float(payload.get("temperature", 0.2))
    if temperature < 0 or temperature > 1.5:
        raise ValueError("temperature out of range")
    return True


class ProtocolTests(unittest.TestCase):
    def test_valid_chat_request(self):
        self.assertTrue(validate_request({
            "messages": [{"role": "user", "content": "hello"}],
            "max_tokens": 64,
            "temperature": 0
        }))

    def test_empty_messages_rejected(self):
        with self.assertRaises(ValueError):
            validate_request({"messages": []})

    def test_unknown_role_rejected(self):
        with self.assertRaises(ValueError):
            validate_request({"messages": [{"role": "tool", "content": "x"}]})

    def test_token_limit_rejected(self):
        with self.assertRaises(ValueError):
            validate_request({"messages": [{"role": "user", "content": "x"}], "max_tokens": 99999})


if __name__ == "__main__":
    unittest.main()
