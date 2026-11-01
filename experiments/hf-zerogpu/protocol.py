def validate_chat_request(payload):
    if not isinstance(payload, dict):
        raise ValueError("request body must be an object")
    messages = payload.get("messages")
    if not isinstance(messages, list) or not messages:
        raise ValueError("messages must be a non-empty array")
    for message in messages:
        if not isinstance(message, dict):
            raise ValueError("each message must be an object")
        if message.get("role") not in {"system", "user", "assistant"}:
            raise ValueError("each message must have a supported role")
        if not isinstance(message.get("content"), str):
            raise ValueError("message content must be text")
    max_tokens = int(payload.get("max_tokens", 512))
    if not 1 <= max_tokens <= 2048:
        raise ValueError("max_tokens must be between 1 and 2048")
    temperature = float(payload.get("temperature", 0.2))
    if not 0 <= temperature <= 1.5:
        raise ValueError("temperature must be between 0 and 1.5")
    return messages, max_tokens, temperature
